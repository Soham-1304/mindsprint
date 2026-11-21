// Every size limit and threshold the rules engine uses. Inputs over a limit are rejected (ERROR),
// never truncated, so hostile input can't make the engine slow or drop evidence quietly.
export const MAX_EVENTS = 50_000;
export const MAX_SEQ = 2 ** 31 - 1;
export const MAX_PID = 2 ** 31 - 1;
export const MAX_TIME_MS = 1e12;
export const MAX_PATH = 4096;
export const MAX_ARGV = 256;
export const MAX_ARG = 8192;
export const MAX_HEADERS = 100;
export const MAX_HEADER_NAME = 256;
export const MAX_HEADER_VALUE = 8192;
export const MAX_HTTP_PATH = 8192;
export const MAX_HOST = 255;
export const MAX_DNS_NAME = 1024;
export const MAX_BODY = 1024 * 1024;
export const MAX_TOTAL_BODY = 16 * 1024 * 1024;
/** All text R1 scans: http hosts, paths, headers, and bodies, plus DNS names. Bounds judging time. */
export const MAX_TOTAL_SCANNED_TEXT = 24 * 1024 * 1024;
export const MAX_SIGNAL = 32;
export const MAX_QTYPE = 16;
export const MAX_ADDRESS = 64;
export const MAX_HONEYTOKENS = 16;
export const MIN_HONEYTOKEN = 16;
export const MAX_HONEYTOKEN = 512;
export const MAX_ALLOWLIST = 500;
export const MAX_TMP_DIRS = 8;
export const MAX_SINK_ADDRESSES = 8;
export const MAX_EXTRA_CREDENTIAL_PATHS = 64;
export const MAX_NAME = 214;
export const MAX_VERSION = 256;
export const MAX_EVIDENCE_PER_FINDING = 20;
export const MAX_FINDINGS_PER_RULE = 25;
export const MAX_QUOTE = 200;
export const MAX_REASON = 300;
export const WIPER_THRESHOLD = 20;
/** Ports the capture sink records (DNS, HTTP, HTTPS). Traffic to the sink on any other port is unseen. */
export const SINK_RECORDED_PORTS = new Set([53, 80, 443]);
/** How many symlink hops R4 follows when checking what an exec really ran. */
export const MAX_SYMLINK_HOPS = 8;
/** npm-style Subresource Integrity, SHA-512 only. */
export const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]{86}==$/;
//# sourceMappingURL=limits.js.map