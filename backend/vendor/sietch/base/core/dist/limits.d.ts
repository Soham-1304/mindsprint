export declare const MAX_EVENTS = 50000;
export declare const MAX_SEQ: number;
export declare const MAX_PID: number;
export declare const MAX_TIME_MS = 1000000000000;
export declare const MAX_PATH = 4096;
export declare const MAX_ARGV = 256;
export declare const MAX_ARG = 8192;
export declare const MAX_HEADERS = 100;
export declare const MAX_HEADER_NAME = 256;
export declare const MAX_HEADER_VALUE = 8192;
export declare const MAX_HTTP_PATH = 8192;
export declare const MAX_HOST = 255;
export declare const MAX_DNS_NAME = 1024;
export declare const MAX_BODY: number;
export declare const MAX_TOTAL_BODY: number;
/** All text R1 scans: http hosts, paths, headers, and bodies, plus DNS names. Bounds judging time. */
export declare const MAX_TOTAL_SCANNED_TEXT: number;
export declare const MAX_SIGNAL = 32;
export declare const MAX_QTYPE = 16;
export declare const MAX_ADDRESS = 64;
export declare const MAX_HONEYTOKENS = 16;
export declare const MIN_HONEYTOKEN = 16;
export declare const MAX_HONEYTOKEN = 512;
export declare const MAX_ALLOWLIST = 500;
export declare const MAX_TMP_DIRS = 8;
export declare const MAX_SINK_ADDRESSES = 8;
export declare const MAX_EXTRA_CREDENTIAL_PATHS = 64;
export declare const MAX_NAME = 214;
export declare const MAX_VERSION = 256;
export declare const MAX_EVIDENCE_PER_FINDING = 20;
export declare const MAX_FINDINGS_PER_RULE = 25;
export declare const MAX_QUOTE = 200;
export declare const MAX_REASON = 300;
export declare const WIPER_THRESHOLD = 20;
/** Ports the capture sink records (DNS, HTTP, HTTPS). Traffic to the sink on any other port is unseen. */
export declare const SINK_RECORDED_PORTS: ReadonlySet<number>;
/** How many symlink hops R4 follows when checking what an exec really ran. */
export declare const MAX_SYMLINK_HOPS = 8;
/** npm-style Subresource Integrity, SHA-512 only. */
export declare const INTEGRITY_PATTERN: RegExp;
//# sourceMappingURL=limits.d.ts.map