/**
 * The syscalls the detonation container traces on x86-64: the ARM64 list plus the legacy calls that
 * x86-64 still has (design D11, and `mknod` from review F-4).
 *
 * This list must equal the `--strace-syscalls` value declared for the `runsc-trace-min` runtime in the
 * Docker daemon configuration. Data only: the architecture picker lives in `docker.ts`.
 */
import { TRACED_SYSCALLS_ARM64 } from "./syscalls-arm64.js";
/** Calls that exist on x86-64 but not on ARM64. */
export const LEGACY_SYSCALLS_X86_64 = [
    "open",
    "creat",
    "unlink",
    "rename",
    "symlink",
    "link",
    "chmod",
    "mkdir",
    "fork",
    "vfork",
    "mknod",
];
export const TRACED_SYSCALLS_X86_64 = [...TRACED_SYSCALLS_ARM64, ...LEGACY_SYSCALLS_X86_64];
//# sourceMappingURL=syscalls-x86-64.js.map