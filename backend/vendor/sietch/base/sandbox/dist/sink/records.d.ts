import { SietchError } from "@sietch/core";
import { z } from "zod";
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
export declare const MAX_SINK_RECORDS = 50000;
/** Largest timestamp a record may carry (year 2096, in wall-clock milliseconds). */
export declare const MAX_SINK_TS_MS = 4000000000000;
export declare const MAX_RECORD_HEADERS = 100;
export declare const MAX_RECORD_HEADER_NAME = 256;
export declare const MAX_RECORD_HEADER_VALUE = 8192;
export declare const MAX_RECORD_PATH = 8192;
export declare const MAX_RECORD_HOST = 255;
export declare const MAX_RECORD_DNS_NAME = 1024;
/** A host name, as a Host header or an SNI value can be recorded: letters, digits, and `._:[]-`. */
export declare const HOST_NAME_PATTERN: RegExp;
/** The value if it can be recorded as a host name, else `null`. */
export declare function sanitiseHostName(value: string | null | undefined): string | null;
declare const dnsRecord: z.ZodObject<{
    type: z.ZodLiteral<"dns">;
    ts: z.ZodInt;
    proto: z.ZodEnum<{
        tcp: "tcp";
        udp: "udp";
    }>;
    qname: z.ZodString;
    qtype: z.ZodInt;
}, z.core.$strict>;
declare const httpRecord: z.ZodObject<{
    type: z.ZodLiteral<"http">;
    ts: z.ZodInt;
    scheme: z.ZodEnum<{
        http: "http";
        https: "https";
    }>;
    host: z.ZodNullable<z.ZodString>;
    sni: z.ZodNullable<z.ZodString>;
    method: z.ZodString;
    path: z.ZodString;
    headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>;
/**
 * Bytes on port 80, or decrypted bytes on port 443, that are not a request the parser accepts, or a DNS
 * packet (port 53, UDP or TCP) that `parseDns` refuses. The sink emits one for every such packet, so nothing
 * the client sent is dropped.
 */
declare const rawRecord: z.ZodObject<{
    type: z.ZodLiteral<"raw">;
    ts: z.ZodInt;
    port: z.ZodUnion<readonly [z.ZodLiteral<53>, z.ZodLiteral<80>, z.ZodLiteral<443>]>;
    sni: z.ZodNullable<z.ZodString>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>;
/** A TLS handshake on port 443 that failed (pinning, not TLS). `bodyBase64` holds the bytes received. */
declare const tlsFailRecord: z.ZodObject<{
    type: z.ZodLiteral<"tlsfail">;
    ts: z.ZodInt;
    sni: z.ZodNullable<z.ZodString>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>;
declare const endRecord: z.ZodObject<{
    type: z.ZodLiteral<"end">;
    count: z.ZodInt;
}, z.core.$strict>;
declare const dataRecord: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"dns">;
    ts: z.ZodInt;
    proto: z.ZodEnum<{
        tcp: "tcp";
        udp: "udp";
    }>;
    qname: z.ZodString;
    qtype: z.ZodInt;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    ts: z.ZodInt;
    scheme: z.ZodEnum<{
        http: "http";
        https: "https";
    }>;
    host: z.ZodNullable<z.ZodString>;
    sni: z.ZodNullable<z.ZodString>;
    method: z.ZodString;
    path: z.ZodString;
    headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"raw">;
    ts: z.ZodInt;
    port: z.ZodUnion<readonly [z.ZodLiteral<53>, z.ZodLiteral<80>, z.ZodLiteral<443>]>;
    sni: z.ZodNullable<z.ZodString>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"tlsfail">;
    ts: z.ZodInt;
    sni: z.ZodNullable<z.ZodString>;
    bodyBase64: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>], "type">;
export type SinkDnsRecord = z.infer<typeof dnsRecord>;
export type SinkHttpRecord = z.infer<typeof httpRecord>;
export type SinkRawRecord = z.infer<typeof rawRecord>;
export type SinkTlsFailRecord = z.infer<typeof tlsFailRecord>;
export type SinkEndRecord = z.infer<typeof endRecord>;
/** A record that describes traffic (everything but the end record). */
export type SinkRecord = z.infer<typeof dataRecord>;
/** The record could not be encoded: it does not match the schema or is over the line cap. */
export declare class SinkRecordError extends SietchError {
    constructor(message: string);
}
/** Base64 for a body, as `bodyBase64` carries it. */
export declare function bytesToBase64(bytes: Uint8Array): string;
/**
 * The engine's "byte string" for a `bodyBase64` value: one character (code 0 to 255) per byte. The value must
 * come from a validated record, so it is well-formed base64.
 */
export declare function base64ToByteString(value: string): string;
/**
 * One JSON line (with the final newline) for a record or the end record. Throws `SinkRecordError` if the
 * record does not match the schema or the line would be over `MAX_SINK_LINE_BYTES`, so the sink can never
 * write a line the runner would refuse.
 */
export declare function encodeSinkRecord(record: SinkRecord | SinkEndRecord): string;
export type SinkStreamResult = {
    readonly ok: true;
    readonly records: SinkRecord[];
} | {
    readonly ok: false;
    readonly code: "SINK_LOST";
    readonly reason: string;
};
/**
 * Parse the sink's whole stdout. Never throws. Fails closed with `SINK_LOST` (design, error table) for:
 * a stream over `MAX_SINK_TOTAL_BYTES`, a line over `MAX_SINK_LINE_BYTES` (checked before `JSON.parse`),
 * an empty line, bytes after the last newline, invalid UTF-8 or JSON, a line the strict schema refuses,
 * more than `MAX_SINK_RECORDS` records, a missing end record, anything after the end record, and an end
 * count that is not the number of records before it. On success `records` excludes the end record.
 */
export declare function parseSinkStream(bytes: Uint8Array): SinkStreamResult;
export {};
//# sourceMappingURL=records.d.ts.map