import { type DockerClient } from "./docker.js";
/**
 * The daemon runtime check (review CR-1). The recording is only as complete as the `--strace-syscalls`
 * list the Docker daemon gives `runsc-trace-min`. If the daemon still has an older list, or a list typed
 * wrong for the architecture, a syscall such as `openat2` leaves no record and the verdict can be SAFE for
 * a package that read a honeytoken. `syscallsFor(arch)` is the list the rules engine expects, so the two
 * must be equal. This check reads the daemon's own `info` output and refuses on any difference.
 *
 * It requires, and refuses (`HOST_EXPOSED`) unless it finds all of:
 * - both runtimes, `runsc` and `runsc-trace-min`;
 * - exactly one `--strace-syscalls=` argument on `runsc-trace-min`, with no empty and no repeated name,
 *   and the same set of names as `syscallsFor(arch)` (a missing name and an extra name both fail);
 * - exactly one each of `--strace`, `--debug`, `--debug-log-format=json` and
 *   `--debug-log=/var/log/runsc/%ID%/`, with no other form of those options (`--strace=false` fails).
 * Any Docker failure, an output over the cap, text that is not JSON, or JSON of another shape is also
 * `HOST_EXPOSED`. A reason holds counts and constant labels only, never daemon text.
 *
 * It tests the daemon at one moment. Run it with `selfCheck` before each batch of scans, and on the cloud
 * VM at deploy time, where the list is typed again for x86-64.
 */
export type RuntimeCheckResult = {
    ok: true;
} | {
    ok: false;
    code: "HOST_EXPOSED";
    reason: string;
};
/** The real `info` output is about 30 KiB (the runc entry carries its feature list). */
export declare const RUNTIME_INFO_MAX_BYTES: number;
/** Reads the daemon's runtimes and compares them with what the recording needs. */
export declare function checkRuntimes(deps: {
    readonly docker: Pick<DockerClient, "exec" | "hostArchitecture">;
}): Promise<RuntimeCheckResult>;
//# sourceMappingURL=runtime-check.d.ts.map