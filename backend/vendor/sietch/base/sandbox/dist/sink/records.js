import { SietchError } from "@sietch/core";
import { z } from "zod";
import { MAX_SINK_BODY_BYTES, MAX_SINK_LINE_BYTES, MAX_SINK_TOTAL_BYTES } from "../limits.js";
/**
 * The capture sink's record channel (design D6, Requirement 6.10): one JSON object per line on the sink's
 * stdout, ending with `{"type":"end","count":N}`. The sink emits it with `encodeSinkRecord`; the runner
 * reads it with `parseSinkStream`. Everything that comes out of the sink is untrusted: sizes are checked
 * before `JSON.parse`, every line goes through a zod `.strict()` schema, and the end record's count must
 * equal the number of records before it. Pure: no I/O.
 *
 * Bodies travel as base64. A JSON string of raw bytes can grow to six times its size (`\u00XX`), which
 * would not fit the line cap for a body of the maximum size. Base64 is at most 4/3 of it.
 *
 * Messages carry fixed text and counts only, never record contents.
 */
/** Most data records (everything but the end record) in one stream. Equal to the engine's event cap. */
export const MAX_SINK_RECORDS = 50_000;
/** Largest timestamp a record may carry (year 2096, in wall-clock milliseconds). */
export const MAX_SINK_TS_MS = 4_000_000_000_000;
// Mirrors of the engine's event limits (base/core limits.ts). `to-events.test.ts` and the property tests
// run every mapped event through the engine's own validation, so a drift fails there.
export const MAX_RECORD_HEADERS = 100;
export const MAX_RECORD_HEADER_NAME = 256;
export const MAX_RECORD_HEADER_VALUE = 8192;
export const MAX_RECORD_PATH = 8192;
export const MAX_RECORD_HOST = 255;
export const MAX_RECORD_DNS_NAME = 1024;
/** A host name, as a Host header or an SNI value can be recorded: letters, digits, and `._:[]-`. */
export const HOST_NAME_PATTERN = /^[A-Za-z0-9._:[\]-]{1,255}$/;
/** The value if it can be recorded as a host name, else `null`. */
export function sanitiseHostName(value) {
    return typeof value === "string" && HOST_NAME_PATTERN.test(value) ? value : null;
}
/** Number of base64 characters that hold `bytes` bytes. */
const base64Length = (bytes) => 4 * Math.ceil(bytes / 3);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** How many bytes a (well-formed) base64 string holds. */
function base64DecodedLength(value) {
    const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    return (value.length / 4) * 3 - padding;
}
const wellFormed = (s) => s.isWellFormed() && !s.includes("\u0000");
const text = (max) => z.string().max(max).refine(wellFormed, { message: "malformed" });
const hostName = z.string().regex(HOST_NAME_PATTERN);
const ts = z.int().min(0).max(MAX_SINK_TS_MS);
const bodyBase64 = z
    .string()
    .max(base64Length(MAX_SINK_BODY_BYTES))
    .regex(BASE64)
    .refine((s) => base64DecodedLength(s) <= MAX_SINK_BODY_BYTES, { message: "body too large" });
const dnsRecord = z.strictObject({
    type: z.literal("dns"),
    ts,
    proto: z.enum(["udp", "tcp"]),
    /** The name in presentation form (see `parseDns`), at most 1024 characters. */
    qname: text(MAX_RECORD_DNS_NAME).min(1),
    /** The numeric query type. `to-events.ts` names it. */
    qtype: z.int().min(0).max(65535),
});
const httpRecord = z.strictObject({
    type: z.literal("http"),
    ts,
    scheme: z.enum(["http", "https"]),
    /** The Host header, or null if it was missing or not a clean host name. */
    host: hostName.nullable(),
    /** The TLS server name for https, else null. */
    sni: hostName.nullable(),
    method: z.string().regex(/^[A-Z]{1,16}$/),
    path: text(MAX_RECORD_PATH),
    headers: z
        .array(z.tuple([text(MAX_RECORD_HEADER_NAME), text(MAX_RECORD_HEADER_VALUE)]))
        .max(MAX_RECORD_HEADERS),
    bodyBase64,
    bodyTruncated: z.boolean(),
});
/**
 * Bytes on port 80, or decrypted bytes on port 443, that are not a request the parser accepts, or a DNS
 * packet (port 53, UDP or TCP) that `parseDns` refuses. The sink emits one for every such packet, so nothing
 * the client sent is dropped.
 */
const rawRecord = z.strictObject({
    type: z.literal("raw"),
    ts,
    port: z.union([z.literal(53), z.literal(80), z.literal(443)]),
    sni: hostName.nullable(),
    bodyBase64,
    bodyTruncated: z.boolean(),
});
/** A TLS handshake on port 443 that failed (pinning, not TLS). `bodyBase64` holds the bytes received. */
const tlsFailRecord = z.strictObject({
    type: z.literal("tlsfail"),
    ts,
    sni: hostName.nullable(),
    bodyBase64,
    bodyTruncated: z.boolean(),
});
const endRecord = z.strictObject({
    type: z.literal("end"),
    count: z.int().min(0).max(MAX_SINK_RECORDS),
});
const dataRecord = z.discriminatedUnion("type", [dnsRecord, httpRecord, rawRecord, tlsFailRecord]);
const anyRecord = z.discriminatedUnion("type", [dnsRecord, httpRecord, rawRecord, tlsFailRecord, endRecord]);
/** The record could not be encoded: it does not match the schema or is over the line cap. */
export class SinkRecordError extends SietchError {
    constructor(message) {
        super("SINK_RECORD_INVALID", message);
    }
}
/** Base64 for a body, as `bodyBase64` carries it. */
export function bytesToBase64(bytes) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}
/**
 * The engine's "byte string" for a `bodyBase64` value: one character (code 0 to 255) per byte. The value must
 * come from a validated record, so it is well-formed base64.
 */
export function base64ToByteString(value) {
    return Buffer.from(value, "base64").toString("latin1");
}
/**
 * One JSON line (with the final newline) for a record or the end record. Throws `SinkRecordError` if the
 * record does not match the schema or the line would be over `MAX_SINK_LINE_BYTES`, so the sink can never
 * write a line the runner would refuse.
 */
export function encodeSinkRecord(record) {
    const parsed = anyRecord.safeParse(record);
    if (!parsed.success)
        throw new SinkRecordError("the record does not match the sink record schema");
    const line = JSON.stringify(parsed.data);
    if (Buffer.byteLength(line, "utf8") + 1 > MAX_SINK_LINE_BYTES) {
        throw new SinkRecordError("the record is over the line cap");
    }
    return `${line}\n`;
}
const lost = (reason) => ({ ok: false, code: "SINK_LOST", reason });
const NEWLINE = 0x0a;
/**
 * Parse the sink's whole stdout. Never throws. Fails closed with `SINK_LOST` (design, error table) for:
 * a stream over `MAX_SINK_TOTAL_BYTES`, a line over `MAX_SINK_LINE_BYTES` (checked before `JSON.parse`),
 * an empty line, bytes after the last newline, invalid UTF-8 or JSON, a line the strict schema refuses,
 * more than `MAX_SINK_RECORDS` records, a missing end record, anything after the end record, and an end
 * count that is not the number of records before it. On success `records` excludes the end record.
 */
export function parseSinkStream(bytes) {
    try {
        if (bytes.length > MAX_SINK_TOTAL_BYTES)
            return lost("the sink stream is over the byte cap");
        if (bytes.length === 0)
            return lost("the sink stream is empty, so it has no end record");
        if (bytes[bytes.length - 1] !== NEWLINE)
            return lost("the sink stream does not end with a newline");
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const records = [];
        let end = null;
        let start = 0;
        let lineNumber = 0;
        while (start < bytes.length) {
            lineNumber++;
            const stop = bytes.indexOf(NEWLINE, start);
            // The stream ends with a newline, so a line always has one.
            if (stop < 0)
                return lost("the sink stream has an unterminated line");
            if (end !== null)
                return lost("the sink stream has data after the end record");
            if (stop - start > MAX_SINK_LINE_BYTES)
                return lost(`line ${lineNumber} is over the line cap`);
            if (stop === start)
                return lost(`line ${lineNumber} is empty`);
            let json;
            try {
                json = JSON.parse(decoder.decode(bytes.subarray(start, stop)));
            }
            catch {
                return lost(`line ${lineNumber} is not valid UTF-8 JSON`);
            }
            const parsed = anyRecord.safeParse(json);
            if (!parsed.success)
                return lost(`line ${lineNumber} does not match the sink record schema`);
            const record = parsed.data;
            if (record.type === "end") {
                end = record;
            }
            else {
                if (records.length >= MAX_SINK_RECORDS)
                    return lost("the sink stream has too many records");
                records.push(record);
            }
            start = stop + 1;
        }
        if (end === null)
            return lost("the sink stream has no end record");
        if (end.count !== records.length)
            return lost("the end record's count does not match the records");
        return { ok: true, records };
    }
    catch {
        return lost("the sink stream could not be read");
    }
}
//# sourceMappingURL=records.js.map