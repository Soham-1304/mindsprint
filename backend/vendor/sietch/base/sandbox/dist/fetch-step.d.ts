import { SietchError } from "@sietch/core";
import { type DockerClient } from "./docker.js";
import { type EgressNetwork } from "./docker-args.js";
import type { ScanRequest } from "./request.js";
import { type ScriptReport } from "./script-report.js";
/**
 * The impure fetch step of a scan: it starts the registry proxy and runs the two fetch stages, with
 * the host-side lockfile check between them (design D1). Everything reaches Docker through the injected
 * `DockerClient`, and every argument vector comes from `docker-args.ts`.
 *
 * Order: the fetch network, the egress network, the proxy (create, connect the egress network, start);
 * then stage `resolve` (stdin `[request]`, stdout `[lockfile]`); `checkLockfile`; then stage `download`
 * (stdin `[request][lockfile]`, stdout `[script report][cache tar]`); `parseScriptReport` against the
 * lockfile's package paths. The download stage never starts after a rejected lockfile. The fetch
 * container is force-removed after each stage (it is attached, not `--rm`, and killing the CLI does not
 * stop it). The proxy and the networks are left for the runner's cleanup (Task 12).
 *
 * The cache tar is hostile bytes. It is counted against its cap and handed on; this code never parses
 * it. The container's stderr (hostile text, may hold npm output) is never returned, logged, or put in a
 * reason. Reasons are fixed text built from stage names and numbers only.
 */
export type FetchStepErrorCode = "NON_REGISTRY_SOURCE" | "INTEGRITY_MISMATCH" | "FETCH_OUTPUT_INVALID" | "FETCH_LIMIT" | "PROXY_START_FAILED" | "NETWORK_FAILED";
export interface FetchStepInput {
    /** A valid scan id (the builders re-validate it). */
    readonly id: string;
    /** Digest-pinned image references (`name@sha256:<id>`). */
    readonly images: {
        readonly fetch: string;
        readonly proxy: string;
    };
    readonly request: Pick<ScanRequest, "name" | "version" | "integrity">;
    /** The registry host name (no scheme or port), such as `registry.npmjs.org`. */
    readonly registryHost: string;
    /** One to four IPv4 addresses of DNS servers the proxy resolves the registry name with. */
    readonly dnsServers: readonly string[];
    readonly egress: EgressNetwork;
}
export interface FetchStepDeps {
    readonly docker: DockerClient;
    /** Wall-clock limit of each stage. Defaults to `FETCH_STAGE_TIMEOUT_MS`. */
    readonly stageTimeoutMs?: number;
}
export type FetchStepResult = {
    readonly ok: true;
    readonly lockfile: Uint8Array;
    readonly report: ScriptReport;
    /** The lockfile's non-root keys, for `parseScriptReport`-style checks later. */
    readonly packagePaths: readonly string[];
    /** The lockfile key of the requested package. */
    readonly requestedPath: string;
    /** Opaque archive of npm's `_cacache`. Counted and forwarded, never parsed here. */
    readonly cacheTar: Uint8Array;
} | {
    readonly ok: false;
    readonly code: FetchStepErrorCode;
    readonly reason: string;
};
/** The step was called with input its builders refuse. A caller bug, not a fetch failure. */
export declare class FetchStepInputError extends SietchError {
    constructor(message: string);
}
export declare function fetchStep(deps: FetchStepDeps, input: FetchStepInput): Promise<FetchStepResult>;
//# sourceMappingURL=fetch-step.d.ts.map