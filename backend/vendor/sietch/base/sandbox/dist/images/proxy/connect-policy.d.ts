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
export declare const MAX_HEAD_BYTES: number;
export type RefusalReason = "head-too-large" | "malformed-request" | "method-not-allowed" | "target-not-allowed";
export type ConnectDecision = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly status: 400 | 403 | 405 | 431;
    readonly reason: RefusalReason;
};
/** The status line and headers of a refusal. Fixed text, no body. */
export declare function refusalResponse(status: 400 | 403 | 405 | 431 | 502 | 503): string;
/** The success response that starts the tunnel. */
export declare const CONNECT_ESTABLISHED = "HTTP/1.1 200 Connection Established\r\n\r\n";
/**
 * The index just past the first blank line (`CRLF CRLF`) in `bytes`, or -1 when there is none yet.
 * Only the first `MAX_HEAD_BYTES` bytes are searched, so a caller can't be made to scan a huge buffer.
 */
export declare function findHeadEnd(bytes: Uint8Array): number;
/**
 * Decides on one request head: the bytes up to and including the blank line (see `findHeadEnd`).
 * `registryHost` is the configured lower-case registry name.
 */
export declare function decideConnect(head: Uint8Array, registryHost: string): ConnectDecision;
//# sourceMappingURL=connect-policy.d.ts.map