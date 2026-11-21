/** Largest strace log the runner reads. Aligned with the trace normaliser's 64 MiB input cap. */
export declare const MAX_LOG_BYTES: number;
/** The resolve stage's lockfile JSON. */
export declare const MAX_LOCKFILE_BYTES: number;
/** The download stage's script report JSON. */
export declare const MAX_REPORT_BYTES: number;
/** The dependency-cache tar. Opaque to the host: counted and forwarded, never parsed. */
export declare const MAX_DEPS_BYTES: number;
/** The fake-home tar. */
export declare const MAX_HOME_BYTES: number;
/** npm's own stderr during fetch, kept only up to this many bytes and then discarded. */
export declare const MAX_FETCH_STDERR_BYTES: number;
/** One recorded HTTP body. A longer body is cut and flagged `bodyTruncated`. */
export declare const MAX_SINK_BODY_BYTES: number;
/** One JSON-lines record on the sink's stdout. */
export declare const MAX_SINK_LINE_BYTES: number;
/** Everything the sink records in one scan. */
export declare const MAX_SINK_TOTAL_BYTES: number;
/** How long the entrypoint watches after install and load have both exited. */
export declare const OBSERVATION_WINDOW_MS = 60000;
/** Wall-clock limit on the detonation container: install, load, and the observation window. */
export declare const WALL_CLOCK_LIMIT_MS = 180000;
/** Wall-clock limit on each fetch stage (resolve, download). */
export declare const FETCH_STAGE_TIMEOUT_MS = 120000;
/** Timeout on every single `docker` call. */
export declare const DOCKER_CALL_TIMEOUT_MS = 30000;
/** A sink event this close to an install/load exit gets the later phase (clock skew between logs). */
export declare const CLOCK_TOLERANCE_MS = 500;
export interface ContainerLimits {
    readonly pids: number;
    readonly memoryBytes: number;
    readonly cpus: number;
}
export declare const DETONATION_LIMITS: ContainerLimits;
export declare const FETCH_LIMITS: ContainerLimits;
export declare const SINK_LIMITS: ContainerLimits;
export declare const PROXY_LIMITS: ContainerLimits;
/** Fake home. Holds the planted files plus whatever the package writes. */
export declare const TMPFS_HOME_BYTES: number;
/** Project directory and npm cache. Above MAX_DEPS_BYTES so a legitimate install fits. */
export declare const TMPFS_PROJECT_BYTES: number;
/** /tmp for the detonation container. */
export declare const TMPFS_TMP_BYTES: number;
/** Scratch space for the fetch container's npm cache and project. Above MAX_DEPS_BYTES. */
export declare const TMPFS_FETCH_BYTES: number;
/** Scratch space for the sink and the proxy. */
export declare const TMPFS_SERVICE_BYTES: number;
//# sourceMappingURL=limits.d.ts.map