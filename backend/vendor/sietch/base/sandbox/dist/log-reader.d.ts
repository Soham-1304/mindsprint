import { SietchError } from "@sietch/core";
import type { CommandRunner } from "./docker.js";
export type LogReadErrorCode = "TRACE_MISSING" | "TRACE_AMBIGUOUS" | "TRACE_TOO_LARGE" | "LOG_REMOVE_FAILED";
export declare class LogReadError extends SietchError {
    constructor(code: LogReadErrorCode, message: string, options?: {
        cause?: unknown;
    });
}
export interface LogReader {
    /** The text of the container's strace log. Throws `LogReadError`. */
    readStraceLog(containerId: string): Promise<string>;
    /** Deletes the container's log directory (and nothing else). Throws `LogReadError` on failure. */
    remove(containerId: string): Promise<void>;
    /**
     * The current size in bytes of the container's strace log, readable while the container runs. gVisor
     * writes the log on the host with no total cap, so the runner polls this during the wall clock and
     * force-removes the container (`forceRemove`) when it throws `TRACE_TOO_LARGE` (the size passed
     * `MAX_LOG_BYTES`). Other `LogReadError` codes: `TRACE_MISSING` while no log file exists yet (the
     * caller decides whether that means "not started"), and `TRACE_AMBIGUOUS`.
     */
    logSize(containerId: string): Promise<number>;
}
export interface ColimaLogReaderDeps {
    /** The injected command runner (the real one carries a minimal child environment). */
    readonly run: CommandRunner;
}
/**
 * Reads through `colima ssh -p sietch -- sudo ...`.
 *
 * `ssh` joins its arguments into ONE command line for the remote shell. This is safe only because every
 * argument is a constant, the container id after it matched `^[0-9a-f]{64}$`, or a file name that fully
 * matched `BOOT_LOG_PATTERN` (characters `[A-Za-z0-9._-]` only). No other value may ever be added here.
 */
export declare function createColimaLogReader(deps: ColimaLogReaderDeps): LogReader;
export interface LogFileHandle {
    read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{
        bytesRead: number;
    }>;
    stat(): Promise<{
        isFile(): boolean;
    }>;
    close(): Promise<void>;
}
/** The file-system calls the direct reader needs. Injected so tests never touch a disk. */
export interface LogFs {
    readdir(path: string): Promise<readonly string[]>;
    /** Does not follow a final symbolic link. `size` is in bytes. */
    lstat(path: string): Promise<{
        isFile(): boolean;
        readonly size: number;
    }>;
    /** Opens read-only and refuses a final symbolic link (`O_NOFOLLOW`). */
    openNoFollow(path: string): Promise<LogFileHandle>;
    /** Recursive and forced. Must not follow symbolic links. */
    rm(path: string): Promise<void>;
}
export declare function createNodeLogFs(): LogFs;
export interface DirectLogReaderDeps {
    readonly fs: LogFs;
}
/** Reads the file on the machine that runs gVisor (the cloud VM). */
export declare function createDirectLogReader(deps: DirectLogReaderDeps): LogReader;
//# sourceMappingURL=log-reader.d.ts.map