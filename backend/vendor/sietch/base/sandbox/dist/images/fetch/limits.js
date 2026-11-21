/**
 * Constants of the fetch image. Kept here (not in the shared `limits.ts`) so the image's own numbers sit
 * next to its code. Byte sizes are in bytes, times in milliseconds.
 */
/** The project directory npm works in. On the fetch container's `/tmp` tmpfs. */
export const FETCH_PROJECT_DIR = "/tmp/proj";
/** npm's cache. Only its `_cacache` directory is archived. */
export const FETCH_CACHE_DIR = "/tmp/cache";
/** `HOME` for npm. */
export const FETCH_HOME_DIR = "/tmp";
/**
 * Empty files used as npm's user and global config, so no `.npmrc` (and no token) is ever read. They must
 * be two different paths: npm refuses to load one file as both ("double-loading config").
 */
export const FETCH_EMPTY_USER_NPMRC = "/tmp/empty-user.npmrc";
export const FETCH_EMPTY_GLOBAL_NPMRC = "/tmp/empty-global.npmrc";
/** The cache archive is written here first, because its frame length must be sent before its bytes. */
export const FETCH_CACHE_TAR = "/tmp/cache.tar";
/** The only directory of the cache that is archived. */
export const CACHE_ARCHIVE_ROOT = "_cacache";
export const NPM_PROGRAM = "/usr/local/bin/npm";
export const TAR_PROGRAM = "/bin/tar";
/** Directories only, all read-only in the image. */
export const FETCH_CHILD_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
/** The request frame (JSON) on stdin is tiny. */
export const MAX_REQUEST_FRAME_BYTES = 4096;
/** A package's `package.json` is read up to this size; a larger one fails the stage. */
export const MAX_PACKAGE_JSON_BYTES = 1024 * 1024;
/** Lifecycle script text in the report is cut at this many UTF-8 bytes (`MAX_SCRIPT_TEXT` of the report). */
export const MAX_REPORT_SCRIPT_BYTES = 512;
/** How long the entrypoint waits for the proxy to accept connections before it starts npm. */
export const PROXY_WAIT_MS = 10_000;
export const PROXY_WAIT_INTERVAL_MS = 250;
/** Exit codes of the entrypoint. 0 is success; each failure has its own code and nothing is written to stdout. */
export const FETCH_EXIT = {
    badStage: 2,
    badInput: 3,
    npmFailed: 4,
    proxyNotReady: 5,
    reportFailed: 6,
    tarFailed: 7,
    outputFailed: 8,
};
//# sourceMappingURL=limits.js.map