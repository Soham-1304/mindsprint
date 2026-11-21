import { spawn as nodeSpawn } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { posix } from "node:path";
import { SietchError } from "@sietch/core";
import { assertSafeArgv, infoArchitectureArgs, inspectArgs, rmArgs } from "./docker-args.js";
import { DOCKER_CALL_TIMEOUT_MS } from "./limits.js";
import { CONTAINER_ID_PATTERN } from "./scan-id.js";
import { TRACED_SYSCALLS_ARM64 } from "./syscalls-arm64.js";
import { TRACED_SYSCALLS_X86_64 } from "./syscalls-x86-64.js";
/**
 * The Docker client: the only code that starts a `docker` process, and it does so through injected
 * runners, so unit tests never start one.
 *
 * Every call takes a `DockerArgv` and re-runs `assertSafeArgv` on it before anything is spawned, so a
 * hand-built array (or one cast to the brand) is refused here even if a builder is bypassed. The
 * program is always `docker`, the arguments are always an array, and `shell` is never set. Every call has
 * a timeout and output caps. A child that goes over a cap or the timeout is killed (SIGKILL). The child
 * environment holds `PATH` (absolute directories only) and `HOME`, so nothing secret from the worker's
 * environment (and no `DOCKER_HOST`) reaches it. Each child leads its own process group, and a kill
 * signals the whole group; a call settles a short grace period after a kill even if a surviving process
 * still holds a pipe. No method mounts a volume, copies files, or commits an image.
 *
 * Killing the `docker` CLI does not stop a container. After a timeout or an output overflow on a `run`
 * command, the caller must call `forceRemove`.
 *
 * The child environment also holds `DOCKER_CONFIG`, a directory Sietch owns (see `minimalChildEnv`). The
 * Docker CLI therefore never reads `~/.docker/config.json`, whose `proxies` block would add proxy
 * variables to every container the CLI starts, where the argument check can't see them. `HOME` is kept
 * only for tools the CLI starts (Colima's ssh). The opt-in integration test still asserts the detonation
 * container's environment holds only the image's own variables.
 *
 * On the Mac, `context` (for example `colima-sietch`) selects the Colima VM's Docker daemon.
 */
const DOCKER_PROGRAM = "docker";
const CONTEXT_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
/** Largest value `setTimeout` accepts (larger values fire immediately). */
const MAX_TIMEOUT_MS = 2_147_483_647;
const MAX_ENV_VALUE_LENGTH = 4096;
const MAX_MESSAGE_STDERR_CHARS = 200;
export const DEFAULT_MAX_STDOUT_BYTES = 1024 * 1024;
export const DEFAULT_MAX_STDERR_BYTES = 64 * 1024;
/** A docker call failed. The message holds the subcommand, the exit code, and a short sanitised stderr. */
export class DockerError extends SietchError {
    constructor(code, message, options) {
        super(code, message, options);
    }
}
/** The Docker daemon reports an architecture the runner has no syscall list for. */
export class UnsupportedArchError extends SietchError {
    constructor(message) {
        super("UNSUPPORTED_ARCH", message);
    }
}
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
export function minimalChildEnv(source, dockerConfigDir) {
    const home = pickEnv(source, "HOME");
    return {
        PATH: pickEnv(source, "PATH"),
        HOME: home,
        DOCKER_CONFIG: checkDockerConfigDir(dockerConfigDir, home),
    };
}
function checkDockerConfigDir(dir, home) {
    if (typeof dir !== "string" ||
        dir.length === 0 ||
        dir.length > MAX_ENV_VALUE_LENGTH ||
        dir.includes("\0")) {
        throw new DockerError("DOCKER_FAILED", "the docker config directory is invalid");
    }
    if (!posix.isAbsolute(dir)) {
        throw new DockerError("DOCKER_FAILED", "the docker config directory must be an absolute path");
    }
    // The user's own config is the thing this setting exists to avoid.
    if (posix.resolve(dir) === posix.resolve(home, ".docker")) {
        throw new DockerError("DOCKER_FAILED", "the docker config directory must not be the user's ~/.docker");
    }
    return dir;
}
const MAX_CONFIG_JSON_BYTES = 1024;
function isNotFound(error) {
    return error?.code === "ENOENT";
}
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
export async function verifyDockerConfigDir(dockerConfigDir, home) {
    const refuse = (message, cause) => {
        throw new DockerError("DOCKER_FAILED", message, cause === undefined ? undefined : { cause });
    };
    checkDockerConfigDir(dockerConfigDir, home);
    try {
        const info = await lstat(dockerConfigDir);
        if (info.isSymbolicLink())
            refuse("the docker config directory must not be a symbolic link");
        if (!info.isDirectory())
            refuse("the docker config directory is not a directory");
    }
    catch (error) {
        if (error instanceof SietchError)
            throw error;
        return refuse("the docker config directory could not be read", error);
    }
    try {
        const userConfig = await realpath(posix.join(home, ".docker"));
        if ((await realpath(dockerConfigDir)) === userConfig) {
            refuse("the docker config directory must not be the user's ~/.docker");
        }
    }
    catch (error) {
        if (error instanceof SietchError)
            throw error;
        if (!isNotFound(error))
            refuse("the docker config directory could not be resolved", error);
    }
    const file = posix.join(dockerConfigDir, "config.json");
    let text;
    try {
        const info = await lstat(file);
        if (!info.isFile())
            refuse("the docker config.json must be a regular file");
        if (info.size > MAX_CONFIG_JSON_BYTES)
            refuse("the docker config.json is too large");
        text = await readFile(file, "utf8");
    }
    catch (error) {
        if (error instanceof SietchError)
            throw error;
        if (isNotFound(error))
            return;
        return refuse("the docker config.json could not be read", error);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        return refuse("the docker config.json is not valid JSON", error);
    }
    if (typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed) ||
        Object.keys(parsed).length !== 0) {
        refuse("the docker config.json must be an empty object");
    }
}
function pickEnv(source, name) {
    const value = source[name];
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_ENV_VALUE_LENGTH) {
        throw new DockerError("DOCKER_FAILED", `the child environment needs a usable ${name}`);
    }
    if (value.includes("\0"))
        throw new DockerError("DOCKER_FAILED", `the child environment ${name} is invalid`);
    // `docker` and `colima` are found through PATH. An empty entry or a relative one (such as `.`) means
    // the current directory, where a planted program would see every argument, so refuse it.
    if (name === "PATH" && !value.split(":").every((entry) => entry.startsWith("/"))) {
        throw new DockerError("DOCKER_FAILED", "the child environment PATH must hold absolute directories only");
    }
    return value;
}
// `shell` is deliberately absent: the file and each argument go to the OS as they are.
const nodeSpawnFn = (file, args, options) => nodeSpawn(file, [...args], {
    env: options.env,
    stdio: "pipe",
    windowsHide: true,
    detached: options.detached,
});
const nodeKillProcessGroup = (pid, signal) => {
    process.kill(-pid, signal);
};
/** How long after a kill the runner waits for the child's `close` before it settles on its own. */
export const KILL_GRACE_MS = 2000;
/** Collects bytes up to a cap. `push` returns false once a chunk did not fit. */
class CappedBuffer {
    cap;
    chunks = [];
    size = 0;
    overflowed = false;
    constructor(cap) {
        this.cap = cap;
    }
    push(chunk) {
        if (this.overflowed)
            return false;
        const room = this.cap - this.size;
        if (chunk.length > room) {
            if (room > 0)
                this.chunks.push(chunk.subarray(0, room));
            this.size = this.cap;
            this.overflowed = true;
            return false;
        }
        this.chunks.push(chunk);
        this.size += chunk.length;
        return true;
    }
    bytes() {
        const out = new Uint8Array(this.size);
        let offset = 0;
        for (const chunk of this.chunks) {
            out.set(chunk, offset);
            offset += chunk.length;
        }
        return out;
    }
}
function checkCallLimits(timeoutMs, maxStdoutBytes, maxStderrBytes) {
    const ok = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max;
    if (!ok(timeoutMs, MAX_TIMEOUT_MS) || !ok(maxStdoutBytes, 2 ** 31) || !ok(maxStderrBytes, 2 ** 31)) {
        throw new DockerError("DOCKER_FAILED", "invalid timeout or output limit for a command");
    }
}
function startChild(spawn, file, args, env) {
    try {
        return spawn(file, args, { env, detached: true });
    }
    catch (cause) {
        throw new DockerError("DOCKER_FAILED", "could not start the command", { cause });
    }
}
/** Signals the child's process group (so `ssh`, `cat` and the like die with it), then the child itself. */
function terminate(child, signal, killGroup) {
    const { pid } = child;
    if (typeof pid === "number" && Number.isInteger(pid) && pid > 1) {
        try {
            killGroup(pid, signal);
        }
        catch {
            // The group is already gone.
        }
    }
    try {
        child.kill(signal);
    }
    catch {
        // The child is already gone.
    }
}
/** Closes the pipes, so a surviving grandchild that still holds one can't keep the call open. */
function destroyStreams(child) {
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
        try {
            stream.destroy();
        }
        catch {
            // Already closed.
        }
    }
}
export function createNodeRunners(deps) {
    const env = { PATH: deps.env.PATH, HOME: deps.env.HOME, DOCKER_CONFIG: deps.env.DOCKER_CONFIG };
    const spawn = deps.spawn ?? nodeSpawnFn;
    const killGroup = deps.killProcessGroup ?? nodeKillProcessGroup;
    const graceMs = deps.killGraceMs ?? KILL_GRACE_MS;
    const run = (file, args, options) => new Promise((resolve, reject) => {
        try {
            checkCallLimits(options.timeoutMs, options.maxStdoutBytes, options.maxStderrBytes);
        }
        catch (error) {
            reject(error);
            return;
        }
        let child;
        try {
            child = startChild(spawn, file, args, env);
        }
        catch (error) {
            reject(error);
            return;
        }
        const stdout = new CappedBuffer(options.maxStdoutBytes);
        const stderr = new CappedBuffer(options.maxStderrBytes);
        let timedOut = false;
        let settled = false;
        let graceTimer;
        const finishRun = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            clearTimeout(graceTimer);
            resolve(result);
        };
        const killChild = () => {
            terminate(child, "SIGKILL", killGroup);
            // A grandchild that holds a pipe open would keep `close` from firing. After a short grace the call
            // settles anyway, as a timeout or overflow, which the caller treats as a failure.
            graceTimer ??= setTimeout(() => {
                destroyStreams(child);
                finishRun({
                    code: null,
                    signal: "SIGKILL",
                    stdout: stdout.bytes(),
                    stderr: stderr.bytes(),
                    timedOut,
                    overflowed: stdout.overflowed || stderr.overflowed,
                });
            }, graceMs);
        };
        const timer = setTimeout(() => {
            timedOut = true;
            killChild();
        }, options.timeoutMs);
        child.stdout.on("data", (chunk) => {
            if (!stdout.push(chunk))
                killChild();
        });
        child.stderr.on("data", (chunk) => {
            if (!stderr.push(chunk))
                killChild();
        });
        // A child that exits before reading stdin makes the write fail with EPIPE. The exit code reports it.
        child.stdin.on("error", () => undefined);
        child.once("error", (cause) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            clearTimeout(graceTimer);
            reject(new DockerError("DOCKER_FAILED", "could not run the command", { cause }));
        });
        child.once("close", (code, signal) => {
            finishRun({
                code,
                signal,
                stdout: stdout.bytes(),
                stderr: stderr.bytes(),
                timedOut,
                overflowed: stdout.overflowed || stderr.overflowed,
            });
        });
        child.stdin.end(options.stdin);
    });
    const spawnAttached = (file, args, options) => {
        const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;
        checkCallLimits(options.timeoutMs, options.maxStdoutBytes, maxStderrBytes);
        const child = startChild(spawn, file, args, env);
        const stderr = new CappedBuffer(maxStderrBytes);
        let timedOut = false;
        let overflowed = false;
        let stdinError = null;
        let graceTimer;
        let forceSettle;
        const killChild = (signal) => {
            terminate(child, signal, killGroup);
            if (signal === "SIGKILL") {
                // See `run`: settle after a grace period even when a surviving process holds a pipe open.
                graceTimer ??= setTimeout(() => {
                    destroyStreams(child);
                    forceSettle?.();
                }, graceMs);
            }
        };
        const timer = setTimeout(() => {
            timedOut = true;
            killChild("SIGKILL");
        }, options.timeoutMs);
        child.stderr.on("data", (chunk) => {
            if (!stderr.push(chunk)) {
                overflowed = true;
                killChild("SIGKILL");
            }
        });
        child.stdin.on("error", (error) => {
            stdinError = error;
        });
        const exited = new Promise((resolve, reject) => {
            let settled = false;
            const settle = (exit) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                clearTimeout(graceTimer);
                resolve(exit);
            };
            forceSettle = () => settle({ code: null, signal: "SIGKILL", timedOut, overflowed, stderr: stderr.bytes() });
            child.once("error", (cause) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                clearTimeout(graceTimer);
                reject(new DockerError("DOCKER_FAILED", "could not run the command", { cause }));
            });
            child.once("close", (code, signal) => {
                settle({ code, signal, timedOut, overflowed, stderr: stderr.bytes() });
            });
        });
        // A caller that never awaits `exited` must not crash the process on a spawn failure.
        exited.catch(() => undefined);
        async function* cappedStdout() {
            let total = 0;
            try {
                for await (const chunk of child.stdout) {
                    total += chunk.length;
                    if (total > options.maxStdoutBytes) {
                        overflowed = true;
                        killChild("SIGKILL");
                        throw new DockerError("DOCKER_FAILED", "the command wrote more output than its limit");
                    }
                    yield chunk;
                }
            }
            catch (error) {
                // A pipe closed by the grace-period cleanup ends the stream with a plain Error.
                if (error instanceof SietchError)
                    throw error;
                throw new DockerError("DOCKER_FAILED", "the command output stream failed", { cause: error });
            }
        }
        return {
            stdin: {
                write: (chunk) => new Promise((resolve, reject) => {
                    if (stdinError !== null) {
                        reject(new DockerError("DOCKER_FAILED", "the command closed its input", { cause: stdinError }));
                        return;
                    }
                    child.stdin.write(chunk, (error) => {
                        if (error)
                            reject(new DockerError("DOCKER_FAILED", "could not write to the command", { cause: error }));
                        else
                            resolve();
                    });
                }),
                end: () => {
                    child.stdin.end();
                },
            },
            stdout: cappedStdout(),
            exited,
            kill: (signal) => killChild(signal),
        };
    };
    return { run, spawnAttached };
}
// --- Error text -----------------------------------------------------------------------------------
function isFormatOrBidi(code) {
    return ((code >= 0x200b && code <= 0x200f) ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069) ||
        code === 0xfeff);
}
/** Index of the last character of the escape sequence that starts at `start` (an ESC character). */
function escapeEnd(chars, start) {
    const last = chars.length - 1;
    const kind = chars[start + 1];
    if (kind === "[") {
        for (let index = start + 2; index <= last; index += 1) {
            const code = chars[index]?.codePointAt(0) ?? 0;
            if (code >= 0x40 && code <= 0x7e)
                return index;
        }
        return last;
    }
    if (kind === "]") {
        for (let index = start + 2; index <= last; index += 1) {
            if (chars[index] === "\u0007")
                return index;
            if (chars[index] === "\u001b" && chars[index + 1] === "\\")
                return index + 1;
        }
        return last;
    }
    return Math.min(start + 1, last);
}
/** Drops ANSI escape sequences, replaces control and bidi characters with a space, and cuts the text. */
function sanitiseText(text, maxChars) {
    const chars = Array.from(text);
    let out = "";
    let count = 0;
    for (let index = 0; index < chars.length && count < maxChars; index += 1) {
        const char = chars[index] ?? "";
        const code = char.codePointAt(0) ?? 0;
        if (code === 0x1b) {
            index = escapeEnd(chars, index);
            continue;
        }
        out += code < 0x20 || (code >= 0x7f && code <= 0x9f) || isFormatOrBidi(code) ? " " : char;
        count += 1;
    }
    return out.trim();
}
function subcommandLabel(argv) {
    return argv[0] === "network" ? `network ${argv[1] ?? ""}` : (argv[0] ?? "");
}
const decoder = new TextDecoder("utf-8");
/**
 * Subcommands whose stderr can be the container's own (hostile code writes it, and it may hold a full
 * honeytoken). A `DockerError` message is logged by callers, so for these only the label and the exit
 * code go in. Other subcommands report the daemon's or the CLI's own text, which `forceRemove` reads.
 */
const CONTAINER_OUTPUT_SUBCOMMANDS = new Set(["run", "create", "start"]);
function failureMessage(argv, label, result) {
    const detail = CONTAINER_OUTPUT_SUBCOMMANDS.has(argv[0] ?? "")
        ? ""
        : sanitiseText(decoder.decode(result.stderr), MAX_MESSAGE_STDERR_CHARS);
    const how = result.code === null ? `signal ${result.signal ?? "unknown"}` : `exit ${result.code}`;
    return detail.length > 0 ? `docker ${label} failed (${how}): ${detail}` : `docker ${label} failed (${how})`;
}
/** `--context=` first, then the checked argument vector. */
function commandArgs(context, argv) {
    const checked = assertSafeArgv(argv);
    return context === undefined ? [...checked] : [`--context=${context}`, ...checked];
}
export function createDockerClient(deps) {
    const { context } = deps;
    if (context !== undefined && (typeof context !== "string" || !CONTEXT_PATTERN.test(context))) {
        throw new DockerError("DOCKER_FAILED", "invalid docker context name");
    }
    async function exec(argv, options = {}) {
        const args = commandArgs(context, argv);
        const label = subcommandLabel(argv);
        const call = {
            timeoutMs: options.timeoutMs ?? DOCKER_CALL_TIMEOUT_MS,
            maxStdoutBytes: options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES,
            maxStderrBytes: options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES,
            ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
        };
        checkCallLimits(call.timeoutMs, call.maxStdoutBytes, call.maxStderrBytes);
        let result;
        try {
            result = await deps.run(DOCKER_PROGRAM, args, call);
        }
        catch (error) {
            if (error instanceof SietchError)
                throw error;
            throw new DockerError("DOCKER_FAILED", `docker ${label} could not run`, { cause: error });
        }
        if (result.timedOut)
            throw new DockerError("DOCKER_TIMEOUT", `docker ${label} timed out after ${call.timeoutMs} ms`);
        if (result.overflowed ||
            result.stdout.length > call.maxStdoutBytes ||
            result.stderr.length > call.maxStderrBytes) {
            throw new DockerError("DOCKER_FAILED", `docker ${label} wrote more output than its limit`);
        }
        if (result.code !== 0)
            throw new DockerError("DOCKER_FAILED", failureMessage(argv, label, result));
        return { stdout: decoder.decode(result.stdout), stderr: decoder.decode(result.stderr) };
    }
    function attach(argv, options) {
        const args = commandArgs(context, argv);
        if (typeof options !== "object" || options === null) {
            throw new DockerError("DOCKER_FAILED", "attach needs an explicit timeout and output limit");
        }
        checkCallLimits(options.timeoutMs, options.maxStdoutBytes, options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES);
        return deps.spawnAttached(DOCKER_PROGRAM, args, options);
    }
    async function containerId(name) {
        const { stdout } = await exec(inspectArgs(name, "id"));
        const id = stdout.trim();
        if (!CONTAINER_ID_PATTERN.test(id)) {
            throw new DockerError("DOCKER_FAILED", "docker inspect did not return a container id");
        }
        return id;
    }
    async function hostArchitecture() {
        const { stdout } = await exec(infoArchitectureArgs());
        return mapArchitecture(stdout.trim());
    }
    return { exec, attach, containerId, hostArchitecture };
}
function mapArchitecture(reported) {
    if (reported === "aarch64" || reported === "arm64")
        return "arm64";
    if (reported === "x86_64" || reported === "amd64")
        return "x64";
    throw new UnsupportedArchError("the Docker daemon reports an architecture the runner does not support");
}
/**
 * Removes a scan container (and its anonymous volumes) with `rm --force --volumes`. Only "no such
 * container" is ignored; every other failure is thrown, so a container that could not be removed is
 * never reported as gone.
 *
 * The caller MUST run this after `attach` or `exec` of a `run` command when `exited` reports `timedOut`
 * or `overflowed`, when `stdout` throws, or when the call throws `DOCKER_TIMEOUT`. Killing the `docker`
 * CLI does not stop the container: it keeps running in the daemon until it is removed.
 */
export async function forceRemove(client, name) {
    const argv = rmArgs(name);
    try {
        await client.exec(argv);
    }
    catch (error) {
        if (error instanceof DockerError &&
            error.code === "DOCKER_FAILED" &&
            /no such container/i.test(error.message)) {
            return;
        }
        throw error;
    }
}
/** The syscall list for `RunnerLayout.tracedSyscalls`. It must equal the daemon's `runsc-trace-min` list. */
export function syscallsFor(arch) {
    if (arch === "arm64")
        return TRACED_SYSCALLS_ARM64;
    if (arch === "x64")
        return TRACED_SYSCALLS_X86_64;
    throw new UnsupportedArchError("no syscall list for this architecture");
}
//# sourceMappingURL=docker.js.map