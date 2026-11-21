/**
 * Parse a DNS query packet (RFC 1035) into its questions. Pure, and it never throws: any bytes give either a
 * query or a typed "unparsable" result. For TCP, the caller strips the two-byte length prefix first.
 *
 * Only what the sink needs is read: the id (to answer), the opcode, and the question section. A query
 * name can carry data (DNS exfiltration), so the name is returned in presentation form with every byte
 * kept: a byte outside `!` to `~` is written as `\DDD` (decimal, three digits, RFC 1035 section 5.1).
 * Anything the result could not show is refused, so the caller records the packet whole as `RAW`:
 * - Name pointers (compression): a client has no earlier name to point at in a plain query, and a pointer
 *   is the usual way to build a loop.
 * - A dot or backslash byte inside a label: its `\046` form would not match a value in rule R1.
 * - Answer and authority records, and bytes after the last question: nothing reads them, so a value there
 *   would never reach rule R1.
 * - Additional records, with one exception: a single EDNS OPT record (RFC 6891) that is the root name,
 *   type 41, with empty RDATA or exactly one COOKIE option (code 10) of 8 bytes. Real resolvers (musl,
 *   c-ares) send exactly this. Eight bytes cannot hold a registered honeytoken (at least 16 characters),
 *   so the sink loses nothing rule R1 could find by not recording them. Every other OPT shape (a longer
 *   cookie, several options, two OPT records, a named OPT, any other additional record) stays
 *   unparsable and is recorded whole as `RAW` (README, known limits).
 *
 * Caps (Requirement 6.1): at most 16 questions, a name of at most 255 bytes on the wire (so at most 1012
 * characters in presentation form, inside the engine's 1024), a packet of at most 65535 bytes.
 */
export declare const MAX_DNS_PACKET_BYTES = 65535;
export declare const MAX_DNS_QUESTIONS = 16;
export interface DnsQuestion {
    /** Presentation form: labels joined by `.`, special bytes as `\DDD`; `.` alone for the root. */
    readonly name: string;
    readonly qtype: number;
    readonly qclass: number;
}
export type DnsUnparsableReason = "TOO_LARGE" | "TOO_SHORT" | "NOT_A_QUERY" | "NO_QUESTION" | "TOO_MANY_QUESTIONS" | "COMPRESSED_NAME" | "NAME_TOO_LONG" | "BAD_LABEL" | "TRAILING_DATA" | "TRUNCATED" | "INTERNAL";
export type DnsParse = {
    readonly kind: "dns";
    readonly id: number;
    readonly opcode: number;
    readonly questions: readonly DnsQuestion[];
    /** True if the query carried the one accepted EDNS OPT record. */
    readonly hasOpt: boolean;
} | {
    readonly kind: "unparsable";
    readonly reason: DnsUnparsableReason;
};
export declare function parseDns(bytes: Uint8Array): DnsParse;
//# sourceMappingURL=parse-dns.d.ts.map