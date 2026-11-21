import type { Readable, Writable } from "node:stream";
import { SietchError } from "@sietch/core";
import { type DockerArgv } from "./docker-args.js";
import type { RequestArch } from "./request.js";
export declare const DEFAULT_MAX_STDOUT_BYTES: number;
export declare const DEFAULT_MAX_STDERR_BYTES: number;
export type DockerErrorCode = "DOCKER_FAILED" | "DOCKER_TIMEOUT";
/** A docker call failed. The message holds the subcommand, the exit code, and a short sanitised stderr. */
export declare class DockerError extends SietchError {
    constructor(code: DockerErrorCode, message: string, options?: {
        cause?: unknown;
    });
}
/** The Docker daemon reports an architecture the runner has no syscall list for. */
export declare class UnsupportedArchError extends SietchError {
    constructor(message: string);
}
export interface RunOptions {
    readonly timeoutMs: number;
    readonly maxStdoutBytes: number;
    readonly maxStderrBytes: number;
    readonly stdin?: Uint8Array;
}
export interface RunResult {
    readonly code: number | null;
    readonly signal: string | null;
    readonly stdout: Uint8Array;
    readonly stderr: Uint8Array;
    /** The runner killed the child because `timeoutMs` passed. */
    readonly timedOut: boolean;
    /** The runner killed the child because it wrote more than a cap. The kept output is cut at the cap. */
    readonly overflowed: boolean;
}
/** Runs `file args...` to completion. Implementations must not use a shell. */
export type CommandRunner = (file: string, args: readonly string[], options: RunOptions) => Promise<RunResult>;
export interface AttachOptions {
    readonly timeoutMs: number;
    readonly maxStdoutBytes: number;
    readonly maxStderrBytes?: number;
}
export interface AttachedExit {
    readonly code: number | null;
    readonly signal: string | null;
    readonly timedOut: boolean;
    readonly overflowed: boolean;
    /**
     * UNTRUSTED. For a `run` that is attached, this is the container's own stderr, written by hostile code,
     * and it may hold a full honeytoken or terminal escapes. Never log it, never put it in an error or a
     * verdict reason, and never print it without escaping. Parse it as data only.
     */
    readonly stderr: Uint8Array;
}
/** A running child with an open stdin and a capped stdout stream. */
export interface AttachedProcess {
    readonly stdin: {
        /** Resolves when the chunk has been flushed to the child. */
        write(chunk: Uint8Array): Promise<void>;
        end(): void;
    };
    /**
     * UNTRUSTED. For a `run` that is attached, this is the container's own stdout, written by hostile code,
     * and it may hold a full honeytoken. Never log it, never put it in an error or a verdict reason, and
     * never print it without escaping. Parse it as data only.
     *
     * Single-use. Throws `DockerError` when the child writes more than `maxStdoutBytes` (and kills it).
     */
    readonly stdout: AsyncIterable<Uint8Array>;
    /** Resolves when the child has exited (also after a timeout or overflow kill). */
    readonly exited: Promise<AttachedExit>;
    kill(signal: "SIGTERM" | "SIGKILL"): void;
}
export type SpawnAttached = (file: string, args: readonly string[], options: AttachOptions) => AttachedProcess;
/** The minimal environment a child gets. */
export type ChildEnv = Readonly<{
    PATH: string;
    HOME: string;
    DOCKER_CONFIG: string;
}>;
/**
 * Picks `PATH` and `HOME` out of an injected environment object and adds `DOCKER_CONFIG`, a directory the
 * caller owns (review L-5). Nothing else is ever copied.
 *
 * With `DOCKER_CONFIG` set, the Docker CLI reads `<dockerConfigDir>/config.json` and
 * `<dockerConfigDir>/contexts` and never `~/.docker/config.json`, so a `proxies` block in the user's
 * file cannot add proxy variables to a detonation container. The directory must be absolute, must not be
 * `$HOME/.docker`, and should hold only what the runner needs: an empty or absent `config.json`, and a
 * `contexts` directory (or a link to the one that defines `colima-sietch`). The composition root creates
 * it. This function checks the path text only; the composition root must also run
 * `verifyDockerConfigDir` once at start-up for the checks that need the file system (a link, the content
 * of `config.json`).
 */
export declare function minimalChildEnv(source: Readonly<Record<string, string | undefined>>, dockerConfigDir: string): ChildEnv;
/**
 * The on-disk check that `minimalChildEnv` (string checks only) cannot do. Call it once at start-up,
 * before the first Docker call, with the same `dockerConfigDir` and `HOME`. It refuses, with `DockerError`:
 * - a directory that is a symbolic link, or is not a directory (a link could point at `~/.docker`);
 * - a directory whose real path is the user's `~/.docker`;
 * - a `config.json` that is a link or not a regular file, is over 1 KiB, is not valid JSON, or is anything
 *   other than an empty object `{}` (a `proxies` block would add proxy variables to every container,
 *   where the argument check can't see them). A missing `config.json` is fine.
 *
 * The `contexts` entry may be a link: the Docker CLI needs it to find `colima-sietch`, and it holds no
 * environment. The check is made once, so the directory must be writable only by the runner's user.
 */
export declare function verifyDockerConfigDir(dockerConfigDir: string, home: string): Promise<void>;
/** The part of a child process the runners use. `ChildProcessWithoutNullStreams` fits it. */
export interface ChildLike {
    readonly stdin: Writable;
    readonly stdout: Readable;
    readonly stderr: Readable;
    /** Set once the process has started. The child leads its own process group (`detached`), so it is the group id. */
    readonly pid?: number | undefined;
    kill(signal: NodeJS.Signals): boolean;
    once(event: "error", listener: (error: Error) => void): unknown;
    once(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}
export interface SpawnFnOptions {
    readonly env: ChildEnv;
    /** Always true: the child leads its own process group, so a timeout can kill the whole group. */
    readonly detached: true;
}
export type SpawnFn = (file: string, args: readonly string[], options: SpawnFnOptions) => ChildLike;
/** Sends `signal` to every process in the group that `pid` leads. */
export type KillProcessGroup = (pid: number, signal: NodeJS.Signals) => void;
/** How long after a kill the runner waits for the child's `close` before it settles on its own. */
export declare const KILL_GRACE_MS = 2000;
export interface NodeRunners {
    readonly run: CommandRunner;
    readonly spawnAttached: SpawnAttached;
}
/**
 * The real `CommandRunner` and `SpawnAttached`. `env` comes from `minimalChildEnv(process.env)` at the
 * composition root. `spawn` is injectable for tests.
 */
export interface NodeRunnerDeps {
    readonly env: ChildEnv;
    readonly spawn?: SpawnFn;
    /** Kills the child's whole process group. Injected so a test never signals a real group. */
    readonly killProcessGroup?: KillProcessGroup;
    /** Defaults to `KILL_GRACE_MS`. */
    readonly killGraceMs?: number;
}
export declare function createNodeRunners(deps: NodeRunnerDeps): NodeRunners;
export interface ExecOptions {
    /** Defaults to `DOCKER_CALL_TIMEOUT_MS`. */
    readonly timeoutMs?: number;
    /** Defaults to `DEFAULT_MAX_STDOUT_BYTES`. */
    readonly maxStdoutBytes?: number;
    /** Defaults to `DEFAULT_MAX_STDERR_BYTES`. */
    readonly maxStderrBytes?: number;
    readonly stdin?: Uint8Array;
}
/** For a `run` of a scan container both fields are UNTRUSTED container output: never log or quote them. */
export interface ExecResult {
    readonly stdout: string;
    readonly stderr: string;
}
export interface DockerClient {
    /** Runs one docker command to completion. Throws `DockerError` on a non-zero exit, a timeout, or a cap. */
    exec(argv: DockerArgv, options?: ExecOptions): Promise<ExecResult>;
    /** Starts one docker command with an open stdin and a capped stdout stream. `timeoutMs` has no default. */
    attach(argv: DockerArgv, options: AttachOptions): AttachedProcess;
    /** The full 64-hex id of a scan container. */
    containerId(name: string): Promise<string>;
    /** The Docker daemon's CPU architecture as the runner names it. */
    hostArchitecture(): Promise<RequestArch>;
}
export interface DockerClientDeps {
    readonly run: CommandRunner;
    readonly spawnAttached: SpawnAttached;
    /** A docker context name such as `colima-sietch`. Becomes `--context=<name>`. */
    readonly context?: string;
}
export declare function createDockerClient(deps: DockerClientDeps): DockerClient;
/**
 * Removes a scan container (and its anonymous volumes) with `rm --force --volumes`. Only "no such
 * container" is ignored; every other failure is thrown, so a container that could not be removed is
 * never reported as gone.
 *
 * The caller MUST run this after `attach` or `exec` of a `run` command when `exited` reports `timedOut`
 * or `overflowed`, when `stdout` throws, or when the call throws `DOCKER_TIMEOUT`. Killing the `docker`
 * CLI does not stop the container: it keeps running in the daemon until it is removed.
 */
export declare function forceRemove(client: Pick<DockerClient, "exec">, name: string): Promise<void>;
/** The syscall list for `RunnerLayout.tracedSyscalls`. It must equal the daemon's `runsc-trace-min` list. */
export declare function syscallsFor(arch: RequestArch): readonly string[];
//# sourceMappingURL=docker.d.ts.map