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
export const MAX_DNS_PACKET_BYTES = 65_535;
export const MAX_DNS_QUESTIONS = 16;
const MAX_NAME_WIRE_BYTES = 255;
const HEADER_BYTES = 12;
const TYPE_OPT = 41;
const EDNS_COOKIE_CODE = 10;
const EDNS_COOKIE_BYTES = 8;
/** Root name (1) + type (2) + class (2) + ttl (4) + rdlength (2). */
const OPT_FIXED_BYTES = 11;
const unparsable = (reason) => ({ kind: "unparsable", reason });
export function parseDns(bytes) {
    try {
        return parse(bytes);
    }
    catch {
        // Not expected: the property test asserts this branch is never taken. Fail closed to "unparsable".
        return unparsable("INTERNAL");
    }
}
const u16 = (bytes, at) => (bytes[at] << 8) | bytes[at + 1];
function hasDotOrBackslash(bytes, start, end) {
    for (let i = start; i < end; i++)
        if (bytes[i] === 0x2e || bytes[i] === 0x5c)
            return true;
    return false;
}
function escapeLabel(bytes, start, end) {
    let out = "";
    for (let i = start; i < end; i++) {
        const b = bytes[i];
        if (b > 0x20 && b < 0x7f)
            out += String.fromCharCode(b);
        else
            out += `\\${String(b).padStart(3, "0")}`;
    }
    return out;
}
function parse(bytes) {
    if (bytes.length > MAX_DNS_PACKET_BYTES)
        return unparsable("TOO_LARGE");
    if (bytes.length < HEADER_BYTES)
        return unparsable("TOO_SHORT");
    const flags = u16(bytes, 2);
    if ((flags & 0x8000) !== 0)
        return unparsable("NOT_A_QUERY");
    const count = u16(bytes, 4);
    if (count === 0)
        return unparsable("NO_QUESTION");
    if (count > MAX_DNS_QUESTIONS)
        return unparsable("TOO_MANY_QUESTIONS");
    // Answer and authority counts must be zero, and the additional count is zero or one (the OPT record).
    const additional = u16(bytes, 10);
    if (u16(bytes, 6) !== 0 || u16(bytes, 8) !== 0 || additional > 1)
        return unparsable("TRAILING_DATA");
    const questions = [];
    let pos = HEADER_BYTES;
    for (let q = 0; q < count; q++) {
        const labels = [];
        let wire = 1; // the terminating zero byte
        for (;;) {
            if (pos >= bytes.length)
                return unparsable("TRUNCATED");
            const length = bytes[pos];
            pos++;
            if (length === 0)
                break;
            if ((length & 0xc0) !== 0)
                return unparsable("COMPRESSED_NAME");
            wire += 1 + length;
            if (wire > MAX_NAME_WIRE_BYTES)
                return unparsable("NAME_TOO_LONG");
            if (pos + length > bytes.length)
                return unparsable("TRUNCATED");
            if (hasDotOrBackslash(bytes, pos, pos + length))
                return unparsable("BAD_LABEL");
            labels.push(escapeLabel(bytes, pos, pos + length));
            pos += length;
        }
        if (pos + 4 > bytes.length)
            return unparsable("TRUNCATED");
        questions.push({
            name: labels.length === 0 ? "." : labels.join("."),
            qtype: u16(bytes, pos),
            qclass: u16(bytes, pos + 2),
        });
        pos += 4;
    }
    if (additional === 1) {
        if (!isAcceptedOpt(bytes, pos))
            return unparsable("TRAILING_DATA");
    }
    else if (pos !== bytes.length) {
        return unparsable("TRAILING_DATA");
    }
    return {
        kind: "dns",
        id: u16(bytes, 0),
        opcode: (flags >> 11) & 0x0f,
        questions,
        hasOpt: additional === 1,
    };
}
/** True if `bytes` from `pos` to the end is exactly one OPT record with empty RDATA or one 8-byte cookie. */
function isAcceptedOpt(bytes, pos) {
    if (bytes.length - pos < OPT_FIXED_BYTES)
        return false;
    if (bytes[pos] !== 0 || u16(bytes, pos + 1) !== TYPE_OPT)
        return false;
    const rdLength = u16(bytes, pos + 9);
    const rdStart = pos + OPT_FIXED_BYTES;
    if (bytes.length - rdStart !== rdLength)
        return false;
    if (rdLength === 0)
        return true;
    return (rdLength === 4 + EDNS_COOKIE_BYTES &&
        u16(bytes, rdStart) === EDNS_COOKIE_CODE &&
        u16(bytes, rdStart + 2) === EDNS_COOKIE_BYTES);
}
//# sourceMappingURL=parse-dns.js.map