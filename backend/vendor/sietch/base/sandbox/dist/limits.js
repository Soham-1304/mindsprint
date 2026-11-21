// Every size, time, and count limit the runner uses, as named constants. Going over a limit that makes
// the trace or the delivery unreliable is an ERROR (fail closed), never a silent truncation.
// Byte sizes are in bytes, times in milliseconds.
const KIB = 1024;
const MIB = 1024 * KIB;
// --- Raw gVisor log -------------------------------------------------------------------------------
/** Largest strace log the runner reads. Aligned with the trace normaliser's 64 MiB input cap. */
export const MAX_LOG_BYTES = 64 * MIB;
// --- Fetch output and delivery stream (framed, checked before the body is read) ------------------
/** The resolve stage's lockfile JSON. */
export const MAX_LOCKFILE_BYTES = 4 * MIB;
/** The download stage's script report JSON. */
export const MAX_REPORT_BYTES = 1 * MIB;
/** The dependency-cache tar. Opaque to the host: counted and forwarded, never parsed. */
export const MAX_DEPS_BYTES = 128 * MIB;
/** The fake-home tar. */
export const MAX_HOME_BYTES = 1 * MIB;
/** npm's own stderr during fetch, kept only up to this many bytes and then discarded. */
export const MAX_FETCH_STDERR_BYTES = 64 * KIB;
// --- Capture sink ---------------------------------------------------------------------------------
// The per-body cap equals the engine's MAX_BODY, and the total cap its MAX_TOTAL_BODY (base/core limits.ts).
// limits.test.ts keeps the two in step by value.
/** One recorded HTTP body. A longer body is cut and flagged `bodyTruncated`. */
export const MAX_SINK_BODY_BYTES = 1 * MIB;
/** One JSON-lines record on the sink's stdout. */
export const MAX_SINK_LINE_BYTES = 2 * MIB;
/** Everything the sink records in one scan. */
export const MAX_SINK_TOTAL_BYTES = 16 * MIB;
// --- Time -----------------------------------------------------------------------------------------
/** How long the entrypoint watches after install and load have both exited. */
export const OBSERVATION_WINDOW_MS = 60_000;
/** Wall-clock limit on the detonation container: install, load, and the observation window. */
export const WALL_CLOCK_LIMIT_MS = 180_000;
/** Wall-clock limit on each fetch stage (resolve, download). */
export const FETCH_STAGE_TIMEOUT_MS = 120_000;
/** Timeout on every single `docker` call. */
export const DOCKER_CALL_TIMEOUT_MS = 30_000;
/** A sink event this close to an install/load exit gets the later phase (clock skew between logs). */
export const CLOCK_TOLERANCE_MS = 500;
export const DETONATION_LIMITS = { pids: 256, memoryBytes: 1024 * MIB, cpus: 1 };
export const FETCH_LIMITS = { pids: 128, memoryBytes: 512 * MIB, cpus: 1 };
export const SINK_LIMITS = { pids: 64, memoryBytes: 256 * MIB, cpus: 0.5 };
export const PROXY_LIMITS = { pids: 32, memoryBytes: 128 * MIB, cpus: 0.5 };
// --- tmpfs sizes (writable space exists only as size-capped tmpfs) --------------------------------
/** Fake home. Holds the planted files plus whatever the package writes. */
export const TMPFS_HOME_BYTES = 16 * MIB;
/** Project directory and npm cache. Above MAX_DEPS_BYTES so a legitimate install fits. */
export const TMPFS_PROJECT_BYTES = 512 * MIB;
/** /tmp for the detonation container. */
export const TMPFS_TMP_BYTES = 64 * MIB;
/** Scratch space for the fetch container's npm cache and project. Above MAX_DEPS_BYTES. */
export const TMPFS_FETCH_BYTES = 512 * MIB;
/** Scratch space for the sink and the proxy. */
export const TMPFS_SERVICE_BYTES = 16 * MIB;
//# sourceMappingURL=limits.js.map