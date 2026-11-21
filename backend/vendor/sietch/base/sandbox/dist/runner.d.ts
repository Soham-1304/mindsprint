import { type ScanInput } from "@sietch/core";
import { type CaDeps } from "./ca.js";
import { type DockerClient } from "./docker.js";
import type { LogReader } from "./log-reader.js";
import { type ScanRequest } from "./request.js";
import type { Rng } from "./rng.js";
import { type ScriptReport } from "./script-report.js";
import type { SelfCheckResult } from "./self-check.js";
/**
 * `runScan` (Task 13): one package version, end to end, fail closed (design "Error handling").
 *
 * Every failure, throw or timeout becomes `{ ok: false, code, reason }`, which the worker turns into an
 * ERROR verdict (BLOCK). `finally` always removes the scan's containers, network and gVisor log. Reasons are
 * fixed text and codes: no package text, no container output, no honeytoken. The attached containers'
 * stdout and stderr are hostile; only the sink's stdout is read, and only by `parseSinkStream`.
 */
export type RunScanErrorCode = "BAD_REQUEST" | "HOST_EXPOSED" | "SOURCE_MISMATCH" | "FETCH_FAILED" | "SINK_START_FAILED" | "SINK_LOST" | "DETONATION_FAILED" | "TIMEOUT" | "TRACE_TOO_LARGE" | "TRACE_FAILED" | "INSTALL_FAILED" | "SCRIPTS_NOT_RUN" | "MISSING_PHASE_BOUNDARY" | "INVALID_SCAN_INPUT" | "INTERNAL";
/** What a source hands the runner: the checked lockfile, the script report and the opaque cache tar. */
export interface Fetched {
    readonly lockfile: Uint8Array;
    readonly report: ScriptReport;
    readonly cacheTar: Uint8Array;
}
export type FetchOutcome = ({
    readonly ok: true;
} & Fetched) | {
    readonly ok: false;
    readonly code: string;
    readonly reason: string;
};
/**
 * Where the package comes from. `registry` is the fetch step behind the proxy (sandbox mode). `fixture`
 * packs one of our own `demo/` fixtures (dev mode). The runner refuses a source that doesn't match the mode.
 */
export interface ScanSource {
    readonly kind: "registry" | "fixture";
    fetch(request: ScanRequest, scanId: string): Promise<FetchOutcome>;
}
export interface RunnerImages {
    readonly detonation: string;
    readonly sink: string;
}
export interface RunnerDeps {
    readonly docker: DockerClient;
    readonly logReader: LogReader;
    readonly source: ScanSource;
    readonly images: RunnerImages;
    /** The host check (runtime list, firewall). The worker runs it before each batch; the runner checks again. */
    readonly selfCheck: () => Promise<SelfCheckResult>;
    readonly rng: Rng;
    readonly randomBytes: (length: number) => Uint8Array;
    readonly clock: () => number;
    readonly caDeps: CaDeps;
    readonly sleep: (ms: number) => Promise<void>;
    /** Seconds to keep watching after load exits. Defaults to the 60 s window. */
    readonly observeSeconds?: number;
    /** Wall-clock limit of the detonation container. Defaults to 180 s. */
    readonly wallClockMs?: number;
    /** How long the sink gets to bind its ports. */
    readonly sinkReadyMs?: number;
    /** How often the gVisor log size is checked while the container runs. */
    readonly logPollMs?: number;
}
export interface ScanMeta {
    readonly scanId: string;
    /** True in the local fixture-only mode. Shown in logs and results. */
    readonly dev: boolean;
}
export type ScanResult = {
    readonly ok: true;
    readonly scanInput: ScanInput;
    readonly meta: ScanMeta;
} | {
    readonly ok: false;
    readonly code: RunScanErrorCode;
    readonly reason: string;
    readonly meta?: ScanMeta;
};
export declare function runScan(input: unknown, deps: RunnerDeps): Promise<ScanResult>;
//# sourceMappingURL=runner.d.ts.map