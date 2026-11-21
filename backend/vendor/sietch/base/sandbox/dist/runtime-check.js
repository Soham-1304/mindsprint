import { SietchError } from "@sietch/core";
import { z } from "zod";
import { syscallsFor } from "./docker.js";
import { infoRuntimesArgs, RUNTIME_PLAIN, RUNTIME_TRACED } from "./docker-args.js";
import { RUNSC_LOG_ROOT } from "./scan-id.js";
/** The real `info` output is about 30 KiB (the runc entry carries its feature list). */
export const RUNTIME_INFO_MAX_BYTES = 256 * 1024;
const STRACE_SYSCALLS_PREFIX = "--strace-syscalls=";
const REQUIRED_DEBUG_LOG = `--debug-log=${RUNSC_LOG_ROOT}/%ID%/`;
const REQUIRED_DEBUG_LOG_FORMAT = "--debug-log-format=json";
const runtimesSchema = z.record(z.string(), z.looseObject({ path: z.string().optional(), runtimeArgs: z.array(z.string()).optional() }));
function exposed(reason) {
    return { ok: false, code: "HOST_EXPOSED", reason: `runtime check: ${reason}` };
}
/** The arguments that start with `name` as a whole option: `name`, or `name=` and a value. */
function optionArgs(args, name) {
    return args.filter((arg) => arg === name || arg.startsWith(`${name}=`));
}
/** The one argument for `name` must be `required` itself: one copy, and no other form of the option. */
function requireExactly(args, name, required) {
    const found = optionArgs(args, name);
    if (found.length === 0)
        return `runsc-trace-min has no ${name} argument`;
    if (found.length > 1)
        return `runsc-trace-min repeats ${name}`;
    if (found[0] !== required)
        return `runsc-trace-min has a wrong ${name} argument`;
    return null;
}
function checkSyscallList(args, expected) {
    const found = args.filter((arg) => arg.startsWith(STRACE_SYSCALLS_PREFIX));
    if (found.length === 0)
        return "runsc-trace-min has no --strace-syscalls argument";
    if (found.length > 1)
        return "runsc-trace-min repeats --strace-syscalls";
    const names = (found[0] ?? "").slice(STRACE_SYSCALLS_PREFIX.length).split(",");
    if (names.some((name) => name.length === 0))
        return "the traced syscall list has an empty name";
    const daemon = new Set(names);
    if (daemon.size !== names.length)
        return "the traced syscall list has a repeated name";
    const wanted = new Set(expected);
    const missing = [...wanted].filter((name) => !daemon.has(name)).length;
    const extra = [...daemon].filter((name) => !wanted.has(name)).length;
    if (missing > 0 || extra > 0) {
        return `the traced syscall list differs from the expected list (${missing} missing, ${extra} extra)`;
    }
    return null;
}
/** Reads the daemon's runtimes and compares them with what the recording needs. */
export async function checkRuntimes(deps) {
    try {
        const arch = await deps.docker.hostArchitecture();
        const expected = syscallsFor(arch);
        const { stdout } = await deps.docker.exec(infoRuntimesArgs(), { maxStdoutBytes: RUNTIME_INFO_MAX_BYTES });
        let json;
        try {
            json = JSON.parse(stdout);
        }
        catch {
            return exposed("the daemon runtimes output is not JSON");
        }
        const parsed = runtimesSchema.safeParse(json);
        if (!parsed.success)
            return exposed("the daemon runtimes output has an unexpected shape");
        const runtimes = parsed.data;
        if (!Object.hasOwn(runtimes, RUNTIME_PLAIN))
            return exposed(`the ${RUNTIME_PLAIN} runtime is missing`);
        const traced = Object.hasOwn(runtimes, RUNTIME_TRACED) ? runtimes[RUNTIME_TRACED] : undefined;
        if (traced === undefined)
            return exposed(`the ${RUNTIME_TRACED} runtime is missing`);
        const args = traced.runtimeArgs ?? [];
        const problem = checkSyscallList(args, expected) ??
            requireExactly(args, "--strace", "--strace") ??
            requireExactly(args, "--debug", "--debug") ??
            requireExactly(args, "--debug-log-format", REQUIRED_DEBUG_LOG_FORMAT) ??
            requireExactly(args, "--debug-log", REQUIRED_DEBUG_LOG);
        return problem === null ? { ok: true } : exposed(problem);
    }
    catch (error) {
        const code = error instanceof SietchError ? error.code : "UNKNOWN";
        return exposed(`the daemon could not be read (${code})`);
    }
}
//# sourceMappingURL=runtime-check.js.map