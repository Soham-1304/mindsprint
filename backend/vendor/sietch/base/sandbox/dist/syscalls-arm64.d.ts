/**
 * The syscalls the detonation container traces on ARM64: the 22 of design D11, plus `openat2` and
 * `mknodat` (review F-4).
 *
 * `openat2` opens files like `openat` and `mknodat` creates file nodes, and the pinned runsc
 * (release-20261116.0) fully supports both, so a package could use them to touch files without a record.
 * They are traced so a use is seen. The trace normaliser has no parser for them yet and fails the trace
 * on a record (`UNPARSED_TRACED_SYSCALLS` in base/core), so a use blocks the scan until it is written.
 * `open_by_handle_at` and `name_to_handle_at` are Unimplemented in runsc (they return an error and open
 * nothing), and `fchmodat2` is not in its table at all, so none of them is listed (a name runsc rejects
 * would stop the sandbox from starting).
 *
 * This list must equal the `--strace-syscalls` value declared for the `runsc-trace-min` runtime in the
 * Docker daemon configuration. If they differ, the recording misses events or the daemon rejects the run.
 * ARM64 has no `open`, `creat`, `unlink`, `rename`, `symlink`, `link`, `chmod`, `mkdir`, `fork`, or `vfork`
 * syscall, so none of them appear here. Data only: the architecture picker lives in `docker.ts`.
 */
export declare const TRACED_SYSCALLS_ARM64: readonly ["execve", "execveat", "openat", "unlinkat", "renameat", "renameat2", "symlinkat", "linkat", "fchmodat", "mkdirat", "connect", "sendto", "sendmsg", "clone", "clone3", "exit_group", "wait4", "waitid", "kill", "tgkill", "chdir", "fchdir", "openat2", "mknodat"];
//# sourceMappingURL=syscalls-arm64.d.ts.map