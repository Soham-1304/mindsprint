import { type CacheTarDeps } from "./cache-tar.js";
import { type NpmEnvInput } from "./npm-argv.js";
import type { FetchRequest } from "./request-frame.js";
import { type PackageFiles } from "./script-report-builder.js";
/**
 * The two stages of the fetch image, as functions of injected effects. They return a result and write
 * nothing to stdout, so a failure leaves stdout empty; `main.ts` prints the frames only after a stage
 * succeeded.
 *
 * resolve:  write the synthetic `package.json`, run `npm install --package-lock-only`, return the lockfile.
 * download: write the same `package.json` and the host-checked lockfile, run `npm ci`, build the script
 *           report from the extracted packages, archive `_cacache`.
 *
 * Both wait (up to `PROXY_WAIT_MS`) for the proxy to accept connections before npm starts, so a proxy
 * that is still starting is not a failed fetch.
 */
export interface StageDeps {
    mkdir(path: string): Promise<void>;
    writeFile(path: string, bytes: Uint8Array): Promise<void>;
    /** Reads a file up to `maxBytes`. Returns null when it does not exist. Throws when it is larger. */
    readFile(path: string, maxBytes: number): Promise<Uint8Array | null>;
    files: PackageFiles;
    tar: CacheTarDeps;
    /** Runs npm with `args` in `cwd` with exactly `env`. npm's output goes to stderr, never stdout. */
    runNpm(args: readonly string[], cwd: string, env: Readonly<Record<string, string>>): Promise<number | null>;
    waitForProxy(): Promise<boolean>;
}
export type StageFailure = {
    readonly ok: false;
    readonly exitCode: number;
    readonly reason: string;
};
export type ResolveResult = {
    readonly ok: true;
    readonly lockfile: Uint8Array;
} | StageFailure;
export type DownloadResult = {
    readonly ok: true;
    readonly report: Uint8Array;
    readonly cacheTarPath: string;
    readonly cacheTarSize: number;
} | StageFailure;
export declare function runResolve(deps: StageDeps, request: FetchRequest, env: NpmEnvInput): Promise<ResolveResult>;
export declare function runDownload(deps: StageDeps, request: FetchRequest, lockfile: Uint8Array, env: NpmEnvInput): Promise<DownloadResult>;
/**
 * The 8-byte big-endian length that starts a frame. The cache archive is streamed from a file, so its
 * header is written separately from its bytes (see `framing.ts` for the format the host decodes).
 */
export declare function frameHeader(length: number): Uint8Array;
export interface ProxyEndpoint {
    readonly host: string;
    readonly port: number;
}
/** Reads `http://<ipv4>:<port>` (the form `docker-args.ts` sets). Null for anything else. */
export declare function parseProxyUrl(url: string | undefined): ProxyEndpoint | null;
export interface WaitDeps {
    /** True when a TCP connection to `endpoint` was accepted (and closed again). */
    tryConnect(endpoint: ProxyEndpoint): Promise<boolean>;
    sleep(ms: number): Promise<void>;
    now(): number;
}
/** Polls the proxy port until it accepts a connection or `timeoutMs` has passed. */
export declare function waitForPort(deps: WaitDeps, endpoint: ProxyEndpoint, timeoutMs?: number, intervalMs?: number): Promise<boolean>;
//# sourceMappingURL=stages.d.ts.map