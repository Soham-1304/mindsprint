/**
 * The capture sink's own limits (the shared caps for bodies, lines and the stream are in `../../limits.ts`).
 * Sizes are in bytes, times in milliseconds. The sink container has 256 MiB of memory and 64 processes.
 */
const KIB = 1024;
const MIB = 1024 * KIB;
/** Most bytes the sink reads from one HTTP or HTTPS connection. More are cut and flagged `bodyTruncated`. */
export const MAX_CONN_INPUT_BYTES = 2 * MIB;
/** Most connections open at once, over TCP 53, 80 and 443 together. One more sets overflow (no end record). */
export const MAX_SINK_CONNECTIONS = 256;
/** A connection with no bytes for this long is closed, and counts as cut. */
export const CONN_IDLE_MS = 10_000;
/** A connection open this long is closed, and counts as cut. */
export const CONN_TOTAL_MS = 30_000;
/** A TLS handshake that has not finished this long after the connection opened is a `tlsfail`. */
export const TLS_HANDSHAKE_MS = 10_000;
/** Most bytes read from one DNS-over-TCP connection (several queries may share it). */
export const MAX_TCP_DNS_BYTES = 256 * KIB;
/** A connection that goes quiet this long after a request that has no length information is answered. */
export const SETTLE_MS = 50;
/** Smallest growth in buffered bytes before an incomplete request is parsed again (see `http-connection`). */
export const REPARSE_MIN_GROWTH_BYTES = 256;
/** Time to live of the one address the sink hands out, in seconds. */
export const DNS_ANSWER_TTL_SECONDS = 5;
//# sourceMappingURL=limits.js.map