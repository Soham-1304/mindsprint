import type { Event } from "../schema.js";
import { type NormaliseErrorCode } from "./errors.js";
export type { NormaliseErrorCode } from "./errors.js";
export interface RunnerLayout {
    /** The container's init process (the runner's entrypoint), normally 1. */
    readonly initPid: number;
    /**
     * Absolute path that only the runner's entrypoint execs, as the first execve of one direct child of
     * init, to start the install step (design D13). That process, and its descendants, are the install role.
     */
    readonly installExec: string;
    /** Same as installExec, for the load harness (the load role). */
    readonly loadExec: string;
    /** Exactly the --strace-syscalls list the sandbox used. */
    readonly tracedSyscalls: readonly string[];
}
export type NormaliseResult = {
    readonly ok: true;
    readonly events: Event[];
    readonly packageManagerPid: number;
    readonly eventsTruncated: boolean;
    /** Wall-clock time (ms since the epoch) of the first strace record. Every event's `t` is relative to it. */
    readonly originMs: number;
} | {
    readonly ok: false;
    readonly code: NormaliseErrorCode;
    readonly reason: string;
};
export declare function normaliseTrace(log: string, layout: RunnerLayout): NormaliseResult;
//# sourceMappingURL=index.d.ts.map