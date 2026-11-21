import { MAX_SINK_BODY_BYTES } from "../../limits.js";
import { parseDns } from "../../sink/parse-dns.js";
import { bytesToBase64 } from "../../sink/records.js";
import { DNS_ANSWER_TTL_SECONDS } from "./limits.js";
/**
 * The sink's DNS side. Pure: bytes in, a response and records out; no sockets and no clock.
 *
 * Every A query for the Internet class is answered with the sink's own address, so a client that resolves a
 * name then connects to the sink. Every other type (AAAA included) gets NOERROR with zero answers (NODATA), so
 * a dual-stack client falls back to IPv4 at once instead of waiting for a timeout. An opcode other than
 * QUERY gets NOTIMP. The response echoes the id, the opcode, the RD flag and the question section, and
 * answers an EDNS OPT record (accepted by `parseDns`) with an empty OPT. A packet `parseDns` refuses gets no
 * response (the caller closes a TCP connection) and is recorded whole as a `raw` record on port 53, so the
 * bytes still reach rule R1.
 */
const HEADER_BYTES = 12;
const TYPE_A = 1;
const CLASS_IN = 1;
const RCODE_NOTIMP = 4;
const FLAG_RESPONSE = 0x8000;
const FLAG_AUTHORITATIVE = 0x0400;
const FLAG_RECURSION_DESIRED = 0x0100;
const FLAG_RECURSION_AVAILABLE = 0x0080;
/** The empty OPT record the sink answers with: root name, type 41, payload size 1232, TTL 0, no RDATA. */
const EMPTY_OPT = Uint8Array.of(0, 0, 41, 0x04, 0xd0, 0, 0, 0, 0, 0, 0);
/** Parse the dotted IPv4 address into four bytes, or throw: the caller validates it first (see `config.ts`). */
function ipv4Bytes(address) {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        throw new TypeError("not an IPv4 address");
    }
    return parts;
}
/** Offsets and ends of each question's name in a query that `parseDns` accepted (no compression). */
function questionSpans(query, count) {
    const spans = [];
    let pos = HEADER_BYTES;
    for (let q = 0; q < count; q++) {
        const start = pos;
        while (query[pos] !== 0)
            pos += 1 + query[pos];
        pos += 1 + 4; // the zero byte, then type and class
        spans.push({ start, end: pos });
    }
    return spans;
}
const u16 = (bytes, at) => (bytes[at] << 8) | bytes[at + 1];
/**
 * Handle one DNS packet (a UDP datagram, or one TCP message without its length prefix) received from a
 * client. `sinkAddress` is the IPv4 address handed out in A answers. Never throws for any `packet`.
 */
export function handleDnsPacket(packet, proto, sinkAddress) {
    const parsed = parseDns(packet);
    if (parsed.kind !== "dns") {
        const kept = packet.subarray(0, MAX_SINK_BODY_BYTES);
        return {
            response: null,
            records: [
                {
                    type: "raw",
                    port: 53,
                    sni: null,
                    bodyBase64: bytesToBase64(kept),
                    bodyTruncated: packet.length > kept.length,
                },
            ],
        };
    }
    const records = parsed.questions.map((question) => ({
        type: "dns",
        proto,
        qname: question.name,
        qtype: question.qtype,
    }));
    const spans = questionSpans(packet, parsed.questions.length);
    const questionBytes = packet.subarray(HEADER_BYTES, spans[spans.length - 1]?.end ?? HEADER_BYTES);
    const answerable = parsed.opcode === 0;
    const address = ipv4Bytes(sinkAddress);
    const answers = [];
    let answerCount = 0;
    if (answerable) {
        parsed.questions.forEach((question, index) => {
            if (question.qtype !== TYPE_A || question.qclass !== CLASS_IN)
                return;
            const span = spans[index];
            // A pointer to the question's name, type A, class IN, the TTL, and the four address bytes.
            answers.push(0xc0 | (span.start >> 8), span.start & 0xff, 0, TYPE_A, 0, CLASS_IN, (DNS_ANSWER_TTL_SECONDS >>> 24) & 0xff, (DNS_ANSWER_TTL_SECONDS >>> 16) & 0xff, (DNS_ANSWER_TTL_SECONDS >>> 8) & 0xff, DNS_ANSWER_TTL_SECONDS & 0xff, 0, 4, ...address);
            answerCount++;
        });
    }
    const requestFlags = u16(packet, 2);
    const flags = FLAG_RESPONSE |
        FLAG_AUTHORITATIVE |
        FLAG_RECURSION_AVAILABLE |
        (requestFlags & FLAG_RECURSION_DESIRED) |
        (parsed.opcode << 11) |
        (answerable ? 0 : RCODE_NOTIMP);
    const additional = parsed.hasOpt ? EMPTY_OPT : new Uint8Array(0);
    const header = Uint8Array.of(packet[0], packet[1], flags >> 8, flags & 0xff, 0, parsed.questions.length, 0, answerCount, 0, 0, 0, parsed.hasOpt ? 1 : 0);
    const response = new Uint8Array(header.length + questionBytes.length + answers.length + additional.length);
    response.set(header, 0);
    response.set(questionBytes, header.length);
    response.set(answers, header.length + questionBytes.length);
    response.set(additional, header.length + questionBytes.length + answers.length);
    return { response, records };
}
/**
 * Splits a DNS-over-TCP byte stream (RFC 1035 section 4.2.2: a two-byte length, then the message) into
 * messages. Several can share a connection. `ok: false` means the stream is no longer usable: a zero length,
 * or more than `maxBytes` read in total. Messages found before the problem are still returned. Never throws.
 */
export function createTcpDnsSplitter(maxBytes) {
    /** Received bytes not yet turned into messages, as the chunks that came in (joined only when a message is whole). */
    let chunks = [];
    let pendingLength = 0;
    /** How many pending bytes the next message needs before it can be cut out: 2, then 2 plus its length. */
    let needed = 2;
    let total = 0;
    let failed = false;
    const joinPending = () => {
        const joined = new Uint8Array(pendingLength);
        let at = 0;
        for (const piece of chunks) {
            joined.set(piece, at);
            at += piece.length;
        }
        return joined;
    };
    return {
        push(chunk) {
            const messages = [];
            if (failed)
                return { ok: false, messages };
            total += chunk.length;
            if (total > maxBytes) {
                failed = true;
                return { ok: false, messages };
            }
            chunks.push(chunk.slice());
            pendingLength += chunk.length;
            // Join only when a whole message is there, so a message dribbled in one byte at a time costs a linear total.
            if (pendingLength < needed)
                return { ok: true, messages };
            const joined = joinPending();
            let pos = 0;
            while (joined.length - pos >= 2) {
                const length = u16(joined, pos);
                if (length === 0) {
                    failed = true;
                    chunks = [joined.slice(pos)]; // kept, so the caller can record the bytes of the bad frame
                    pendingLength = chunks[0]?.length ?? 0;
                    return { ok: false, messages };
                }
                if (joined.length - pos - 2 < length)
                    break;
                messages.push(joined.slice(pos + 2, pos + 2 + length));
                pos += 2 + length;
            }
            const rest = joined.slice(pos);
            chunks = [rest];
            pendingLength = rest.length;
            needed = rest.length >= 2 ? 2 + u16(rest, 0) : 2;
            return { ok: true, messages };
        },
        remainder: () => joinPending(),
    };
}
/** A DNS response with the two-byte length prefix TCP needs. */
export function withTcpLength(message) {
    const out = new Uint8Array(2 + message.length);
    out[0] = message.length >> 8;
    out[1] = message.length & 0xff;
    out.set(message, 2);
    return out;
}
//# sourceMappingURL=dns-responder.js.map