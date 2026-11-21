import { base64ToByteString } from "./records.js";
/**
 * Sink records to engine `dns` and `http` events (design D6, Requirement 6.9). Pure.
 *
 * The result has no `seq`, `t`, or `phase` yet: the time comes from the sink's own wall clock (`atMs`),
 * the phase from `phases.ts`, and `seq` from `merge.ts`.
 *
 * Non-HTTP traffic is mapped to an `http` event so that its bytes still reach rule R1 and its destination
 * still reaches R3 (design D6 table):
 *
 * | Record | `method` | `scheme` | `host` |
 * |---|---|---|---|
 * | `raw` on port 53 (a DNS packet `parseDns` refused) | `RAW` | `http` | `raw.sink.invalid` |
 * | `raw` on port 80 | `RAW` | `http` | `raw.sink.invalid` |
 * | `raw` on port 443 (decrypted bytes that are not HTTP) | `RAW` | `https` | the SNI, else `raw.sink.invalid` |
 * | `tlsfail` (port 443, handshake failed) | `TLSFAIL` | `https` | the SNI, else `raw.sink.invalid` |
 *
 * For a parsed request the host is the SNI on https (it is what the client asked to reach, before any
 * header), else the Host header, else `raw.sink.invalid`. `raw.sink.invalid` is never on an allowlist and
 * is not a sink address, so R3 flags it.
 */
/** The host used when the traffic names none. Reserved by RFC 2606, so it never resolves. */
export const SINK_RAW_HOST = "raw.sink.invalid";
/** Query types the engine events name. Anything else is `TYPE<number>`. */
const QTYPE_NAMES = new Map([
    [1, "A"],
    [2, "NS"],
    [5, "CNAME"],
    [6, "SOA"],
    [12, "PTR"],
    [15, "MX"],
    [16, "TXT"],
    [28, "AAAA"],
    [33, "SRV"],
    [35, "NAPTR"],
    [43, "DS"],
    [46, "RRSIG"],
    [48, "DNSKEY"],
    [64, "SVCB"],
    [65, "HTTPS"],
    [252, "AXFR"],
    [255, "ANY"],
    [257, "CAA"],
]);
/** The name for a numeric query type, for example `A` for 1 and `TYPE999` for 999. */
export function qtypeName(qtype) {
    return QTYPE_NAMES.get(qtype) ?? `TYPE${qtype}`;
}
function toEvent(record) {
    switch (record.type) {
        case "dns":
            return { type: "dns", name: record.qname, qtype: qtypeName(record.qtype) };
        case "http":
            return {
                type: "http",
                method: record.method,
                scheme: record.scheme,
                host: (record.scheme === "https" ? (record.sni ?? record.host) : record.host) ?? SINK_RAW_HOST,
                path: record.path,
                headers: record.headers.map(([name, value]) => [name, value]),
                body: base64ToByteString(record.bodyBase64),
                bodyTruncated: record.bodyTruncated,
            };
        case "raw":
            return {
                type: "http",
                method: "RAW",
                scheme: record.port === 443 ? "https" : "http",
                host: (record.port === 443 ? record.sni : null) ?? SINK_RAW_HOST,
                path: "",
                headers: [],
                body: base64ToByteString(record.bodyBase64),
                bodyTruncated: record.bodyTruncated,
            };
        case "tlsfail":
            return {
                type: "http",
                method: "TLSFAIL",
                scheme: "https",
                host: record.sni ?? SINK_RAW_HOST,
                path: "",
                headers: [],
                body: base64ToByteString(record.bodyBase64),
                bodyTruncated: record.bodyTruncated,
            };
        default: {
            const unreachable = record;
            return unreachable;
        }
    }
}
/** One timed event per record, in the order given. */
export function sinkRecordsToEvents(records) {
    return records.map((record) => ({ atMs: record.ts, event: toEvent(record) }));
}
//# sourceMappingURL=to-events.js.map