/**
 * Parse the bytes the sink received on one HTTP connection (port 80, or port 443 after TLS) into one
 * request. Pure, and it never throws: any input gives either a request or a typed "unparsable" result.
 * The sink records unparsable bytes as a `RAW` event (design D6), so nothing the client sent is dropped.
 *
 * The parser is deliberately stricter than a server. Whatever a real server would argue about is
 * unparsable: a bare LF, a folded header, a duplicate or conflicting length, a duplicate Host, a method that
 * is not upper-case letters, an HTTP version other than 1.0 or 1.1, more headers or longer values than the
 * engine's event can hold. The bytes then still reach rule R1 as a raw body, which is always better than a
 * request that the engine would have to cut.
 *
 * Caps (Requirement 6.3): the body is cut at `maxBodyBytes`, the head (request line and headers) must fit
 * `maxHeadBytes`. `bodyTruncated` is true exactly when a body byte the client sent is missing from `body`,
 * either because of the body cap or because the caller's own input was cut (`inputTruncated`). A client that
 * sends fewer bytes than it announced and then hangs up has lost nothing to us, so that is not truncation.
 *
 * `consumed` is how many input bytes the request took. A keep-alive connection can hold more requests, so
 * the caller parses `bytes.subarray(consumed)` again until the input is used up. A request without length
 * information takes everything that follows, unless the rest starts like another request.
 */
export declare const DEFAULT_MAX_HEAD_BYTES: number;
export interface HttpParseOptions {
    /** Body cap in bytes. At most `MAX_SINK_BODY_BYTES`, which is also the default. */
    readonly maxBodyBytes?: number;
    /** Cap on the request line and headers. Default 64 KiB. */
    readonly maxHeadBytes?: number;
    /** The caller stopped reading at its own cap, so more bytes existed than `bytes` holds. */
    readonly inputTruncated?: boolean;
}
export type HttpUnparsableReason = "EMPTY" | "NO_HEAD_END" | "HEAD_TOO_LARGE" | "BAD_REQUEST_LINE" | "BAD_HEADER" | "TOO_MANY_HEADERS" | "BAD_FRAMING" | "BAD_CHUNK" | "INTERNAL";
export interface ParsedHttpRequest {
    readonly kind: "http";
    readonly method: string;
    readonly path: string;
    /** The Host header if it is a clean host name, else null. */
    readonly host: string | null;
    /** Header names as sent. Values are byte strings (one character per byte). */
    readonly headers: [string, string][];
    readonly body: Uint8Array;
    readonly bodyTruncated: boolean;
    /** Input bytes this request used (1 to `bytes.length`). */
    readonly consumed: number;
    /**
     * True if the request ended inside the input: all announced body bytes are present, the chunked body has
     * its last chunk, or (for a request with no length information) the next request already follows. A
     * connection that is still open should wait for more bytes while this is false.
     */
    readonly complete: boolean;
    /** True if the request announced its body with `Content-Length` or `Transfer-Encoding: chunked`. */
    readonly framed: boolean;
    /**
     * A lower bound on how many more input bytes are needed before `complete` can become true: exact for
     * `Content-Length`, 1 otherwise. 0 when `complete`.
     */
    readonly missing: number;
}
export type HttpParse = ParsedHttpRequest | {
    readonly kind: "unparsable";
    readonly reason: HttpUnparsableReason;
};
/**
 * Cut `bytes` to at most `max` bytes (copying), and say whether anything was lost: true if `bytes` was
 * longer than `max` or the caller already knew the input was cut. For recording non-HTTP bytes as `RAW` or
 * `TLSFAIL`.
 */
export declare function capBytes(bytes: Uint8Array, max?: number, alreadyTruncated?: boolean): {
    readonly body: Uint8Array;
    readonly bodyTruncated: boolean;
};
export declare function parseHttp(bytes: Uint8Array, options?: HttpParseOptions): HttpParse;
//# sourceMappingURL=parse-http.d.ts.map