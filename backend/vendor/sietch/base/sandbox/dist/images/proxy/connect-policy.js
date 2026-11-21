/**
 * The proxy's request policy. Pure: bytes in, a decision out, never throws.
 *
 * The proxy answers exactly one request: `CONNECT <registryHost>:443 HTTP/1.1`, in that exact text. The
 * host is compared as a string against the configured registry name, so a different host, another
 * port, a trailing dot, an upper-case letter, an IP literal, a userinfo prefix, or an absolute-form
 * target all fail the comparison. Any other method is refused with 405 (a plain GET is the usual one).
 * The request head must be printable ASCII with CRLF line ends, at most `MAX_HEAD_BYTES` long, and every
 * header line must be a plain `name: value` pair, so nothing odd is parsed leniently.
 *
 * Refusal texts are fixed and never contain request bytes.
 */
export const MAX_HEAD_BYTES = 8 * 1024;
const MAX_HEADER_LINES = 64;
const HEAD_END = [0x0d, 0x0a, 0x0d, 0x0a];
const HEADER_LINE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}:[\t\x20-\x7e]{0,2048}$/;
const PRINTABLE_ASCII_OR_CRLF = /^[\x20-\x7e\r\n\t]*$/;
const METHOD = /^[A-Z]{1,16}$/;
/** The status line and headers of a refusal. Fixed text, no body. */
export function refusalResponse(status) {
    const text = {
        400: "Bad Request",
        403: "Forbidden",
        405: "Method Not Allowed",
        431: "Request Header Fields Too Large",
        502: "Bad Gateway",
        503: "Service Unavailable",
    };
    return `HTTP/1.1 ${status} ${text[status] ?? "Error"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`;
}
/** The success response that starts the tunnel. */
export const CONNECT_ESTABLISHED = "HTTP/1.1 200 Connection Established\r\n\r\n";
/**
 * The index just past the first blank line (`CRLF CRLF`) in `bytes`, or -1 when there is none yet.
 * Only the first `MAX_HEAD_BYTES` bytes are searched, so a caller can't be made to scan a huge buffer.
 */
export function findHeadEnd(bytes) {
    const limit = Math.min(bytes.length, MAX_HEAD_BYTES);
    for (let index = 0; index + HEAD_END.length <= limit; index += 1) {
        if (bytes[index] === HEAD_END[0] &&
            bytes[index + 1] === HEAD_END[1] &&
            bytes[index + 2] === HEAD_END[2] &&
            bytes[index + 3] === HEAD_END[3]) {
            return index + HEAD_END.length;
        }
    }
    return -1;
}
function refuse(status, reason) {
    return { ok: false, status, reason };
}
/**
 * Decides on one request head: the bytes up to and including the blank line (see `findHeadEnd`).
 * `registryHost` is the configured lower-case registry name.
 */
export function decideConnect(head, registryHost) {
    if (!(head instanceof Uint8Array) || head.length > MAX_HEAD_BYTES)
        return refuse(431, "head-too-large");
    const text = String.fromCharCode(...head);
    if (!PRINTABLE_ASCII_OR_CRLF.test(text) || !text.endsWith("\r\n\r\n")) {
        return refuse(400, "malformed-request");
    }
    const lines = text.slice(0, -4).split("\r\n");
    if (lines.length > MAX_HEADER_LINES)
        return refuse(431, "head-too-large");
    const requestLine = lines[0] ?? "";
    if (/[\r\n]/.test(requestLine))
        return refuse(400, "malformed-request");
    for (const line of lines.slice(1)) {
        if (!HEADER_LINE.test(line))
            return refuse(400, "malformed-request");
    }
    const method = requestLine.split(" ")[0] ?? "";
    if (!METHOD.test(method))
        return refuse(400, "malformed-request");
    if (method !== "CONNECT")
        return refuse(405, "method-not-allowed");
    if (requestLine !== `CONNECT ${registryHost}:443 HTTP/1.1`)
        return refuse(403, "target-not-allowed");
    return { ok: true };
}
//# sourceMappingURL=connect-policy.js.map