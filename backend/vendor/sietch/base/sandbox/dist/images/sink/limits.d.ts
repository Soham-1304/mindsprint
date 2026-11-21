/** Most bytes the sink reads from one HTTP or HTTPS connection. More are cut and flagged `bodyTruncated`. */
export declare const MAX_CONN_INPUT_BYTES: number;
/** Most connections open at once, over TCP 53, 80 and 443 together. One more sets overflow (no end record). */
export declare const MAX_SINK_CONNECTIONS = 256;
/** A connection with no bytes for this long is closed, and counts as cut. */
export declare const CONN_IDLE_MS = 10000;
/** A connection open this long is closed, and counts as cut. */
export declare const CONN_TOTAL_MS = 30000;
/** A TLS handshake that has not finished this long after the connection opened is a `tlsfail`. */
export declare const TLS_HANDSHAKE_MS = 10000;
/** Most bytes read from one DNS-over-TCP connection (several queries may share it). */
export declare const MAX_TCP_DNS_BYTES: number;
/** A connection that goes quiet this long after a request that has no length information is answered. */
export declare const SETTLE_MS = 50;
/** Smallest growth in buffered bytes before an incomplete request is parsed again (see `http-connection`). */
export declare const REPARSE_MIN_GROWTH_BYTES = 256;
/** Time to live of the one address the sink hands out, in seconds. */
export declare const DNS_ANSWER_TTL_SECONDS = 5;
//# sourceMappingURL=limits.d.ts.map