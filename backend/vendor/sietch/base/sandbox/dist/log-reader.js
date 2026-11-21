import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, rm } from "node:fs/promises";
import { SietchError } from "@sietch/core";
import { DOCKER_CALL_TIMEOUT_MS, MAX_LOG_BYTES } from "./limits.js";
import { runscLogDir } from "./scan-id.js";
/**
 * Reads, and then deletes, the raw gVisor strace log of one container (design D15).
 *
 * gVisor writes the log on the Docker host. On the cloud VM the worker runs on that host and reads the
 * file directly. On the Mac the host is the Colima VM, reached with `colima ssh`.
 *
 * Both readers use the same steps: validate the container id (64 lowercase hex characters, before any
 * call), list the directory, require exactly one file named like the `boot` log, read at most
 * `MAX_LOG_BYTES + 1` bytes, and fail when the extra byte arrives. Raw log text holds full honeytokens in
 * `execve` environments, so it is never logged and never placed in an error message.
 */
/** The one file that holds strace records (spike 4, question 6). The other four log files are ignored. */
const BOOT_LOG_PATTERN = /^runsc\.log\.\d{8}-\d{6}\.\d{6}\.boot\.txt$/;
/** The directory listing of one container is five short names. Anything near this size is wrong. */
const MAX_LISTING_BYTES = 16 * 1024;
const LISTING_TIMEOUT_MS = DOCKER_CALL_TIMEOUT_MS;
const REMOVE_TIMEOUT_MS = DOCKER_CALL_TIMEOUT_MS;
/** Moving 64 MiB through `colima ssh` takes longer than a control call. */
const READ_TIMEOUT_MS = 2 * DOCKER_CALL_TIMEOUT_MS;
const READ_CHUNK_BYTES = 1024 * 1024;
/** `stat -c %s` prints one number and a newline. */
const MAX_SIZE_OUTPUT_BYTES = 64;
const SIZE_PATTERN = /^[0-9]{1,15}$/;
const COLIMA_PROGRAM = "colima";
const SSH_PREFIX = ["ssh", "-p", "sietch", "--", "sudo"];
export class LogReadError extends SietchError {
    constructor(code, message, options) {
        super(code, message, options);
    }
}
const decoder = new TextDecoder("utf-8");
/** The names in a listing that are a `boot` log. Other names are ignored and never reach an argv or a path. */
function selectBootLog(names) {
    const matches = names.filter((name) => BOOT_LOG_PATTERN.test(name));
    const [only] = matches;
    if (only === undefined)
        throw new LogReadError("TRACE_MISSING", "no strace log file in the container's log directory");
    if (matches.length > 1)
        throw new LogReadError("TRACE_AMBIGUOUS", "more than one strace log file in the log directory");
    return only;
}
function parseSize(text) {
    const digits = text.endsWith("\n") ? text.slice(0, -1) : text;
    if (!SIZE_PATTERN.test(digits))
        throw new LogReadError("TRACE_MISSING", "the strace log size is not a number");
    return checkLogSize(Number(digits));
}
/** A log over the read cap is already a failure: it can only get larger. */
function checkLogSize(size) {
    if (size > MAX_LOG_BYTES)
        throw new LogReadError("TRACE_TOO_LARGE", "the strace log is larger than the limit");
    return size;
}
function parseListing(text) {
    const names = text.split("\n");
    if (names[names.length - 1] === "")
        names.pop();
    return names;
}
/**
 * Reads through `colima ssh -p sietch -- sudo ...`.
 *
 * `ssh` joins its arguments into ONE command line for the remote shell. This is safe only because every
 * argument is a constant, the container id after it matched `^[0-9a-f]{64}$`, or a file name that fully
 * matched `BOOT_LOG_PATTERN` (characters `[A-Za-z0-9._-]` only). No other value may ever be added here.
 */
export function createColimaLogReader(deps) {
    const { run } = deps;
    async function call(args, timeoutMs, maxStdoutBytes) {
        try {
            return await run(COLIMA_PROGRAM, args, { timeoutMs, maxStdoutBytes, maxStderrBytes: 4096 });
        }
        catch (cause) {
            // The runner rejects (a missing program, a bad limit). Callers match on `LogReadError` codes only.
            throw new LogReadError("TRACE_MISSING", "the log command could not run", { cause });
        }
    }
    /** The directory and the one boot log file in it. */
    async function locate(directory) {
        const listing = await call([...SSH_PREFIX, "ls", "-1", directory], LISTING_TIMEOUT_MS, MAX_LISTING_BYTES);
        if (listing.overflowed)
            throw new LogReadError("TRACE_AMBIGUOUS", "the log directory listing is too large");
        if (listing.code !== 0 || listing.timedOut) {
            throw new LogReadError("TRACE_MISSING", "the container's log directory could not be listed");
        }
        return { directory, file: selectBootLog(parseListing(decoder.decode(listing.stdout))) };
    }
    async function logSize(containerId) {
        const { directory, file } = await locate(runscLogDir(containerId));
        const size = await call([...SSH_PREFIX, "stat", "-c", "%s", `${directory}/${file}`], LISTING_TIMEOUT_MS, MAX_SIZE_OUTPUT_BYTES);
        if (size.code !== 0 || size.timedOut || size.overflowed) {
            throw new LogReadError("TRACE_MISSING", "the strace log size could not be read");
        }
        return parseSize(decoder.decode(size.stdout));
    }
    async function readStraceLog(containerId) {
        const { directory, file } = await locate(runscLogDir(containerId));
        const content = await call([...SSH_PREFIX, "cat", `${directory}/${file}`], READ_TIMEOUT_MS, MAX_LOG_BYTES + 1);
        if (content.overflowed || content.stdout.length > MAX_LOG_BYTES) {
            throw new LogReadError("TRACE_TOO_LARGE", "the strace log is larger than the limit");
        }
        if (content.code !== 0 || content.timedOut) {
            throw new LogReadError("TRACE_MISSING", "the strace log could not be read");
        }
        return decoder.decode(content.stdout);
    }
    async function remove(containerId) {
        const directory = runscLogDir(containerId);
        let outcome;
        try {
            outcome = await call([...SSH_PREFIX, "rm", "-rf", directory], REMOVE_TIMEOUT_MS, 4096);
        }
        catch (cause) {
            throw new LogReadError("LOG_REMOVE_FAILED", "the log directory could not be removed", { cause });
        }
        if (outcome.code !== 0 || outcome.timedOut || outcome.overflowed) {
            throw new LogReadError("LOG_REMOVE_FAILED", "the log directory could not be removed");
        }
    }
    return { readStraceLog, remove, logSize };
}
export function createNodeLogFs() {
    return {
        readdir: (path) => readdir(path),
        lstat: (path) => lstat(path),
        openNoFollow: async (path) => {
            const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
            return {
                read: (buffer, offset, length, position) => handle.read(buffer, offset, length, position),
                stat: () => handle.stat(),
                close: () => handle.close(),
            };
        },
        rm: (path) => rm(path, { recursive: true, force: true }),
    };
}
/** Reads the file on the machine that runs gVisor (the cloud VM). */
export function createDirectLogReader(deps) {
    const { fs } = deps;
    async function readFileCapped(path) {
        const handle = await fs.openNoFollow(path);
        try {
            if (!(await handle.stat()).isFile()) {
                throw new LogReadError("TRACE_MISSING", "the strace log is not a regular file");
            }
            const limit = MAX_LOG_BYTES + 1;
            const chunks = [];
            let total = 0;
            while (total < limit) {
                const chunk = new Uint8Array(Math.min(READ_CHUNK_BYTES, limit - total));
                const { bytesRead } = await handle.read(chunk, 0, chunk.length, total);
                if (bytesRead === 0)
                    break;
                chunks.push(chunk.subarray(0, bytesRead));
                total += bytesRead;
            }
            if (total > MAX_LOG_BYTES)
                throw new LogReadError("TRACE_TOO_LARGE", "the strace log is larger than the limit");
            const whole = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
                whole.set(chunk, offset);
                offset += chunk.length;
            }
            return decoder.decode(whole);
        }
        finally {
            await handle.close();
        }
    }
    async function readStraceLog(containerId) {
        const directory = runscLogDir(containerId);
        let names;
        try {
            names = await fs.readdir(directory);
        }
        catch (cause) {
            throw new LogReadError("TRACE_MISSING", "the container's log directory could not be listed", { cause });
        }
        const path = `${directory}/${selectBootLog(names)}`;
        let regular;
        try {
            regular = (await fs.lstat(path)).isFile();
        }
        catch (cause) {
            throw new LogReadError("TRACE_MISSING", "the strace log could not be inspected", { cause });
        }
        if (!regular)
            throw new LogReadError("TRACE_MISSING", "the strace log is not a regular file");
        try {
            return await readFileCapped(path);
        }
        catch (error) {
            if (error instanceof LogReadError)
                throw error;
            throw new LogReadError("TRACE_MISSING", "the strace log could not be read", { cause: error });
        }
    }
    async function logSize(containerId) {
        const directory = runscLogDir(containerId);
        let names;
        try {
            names = await fs.readdir(directory);
        }
        catch (cause) {
            throw new LogReadError("TRACE_MISSING", "the container's log directory could not be listed", { cause });
        }
        const path = `${directory}/${selectBootLog(names)}`;
        try {
            const stat = await fs.lstat(path);
            if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size < 0) {
                throw new LogReadError("TRACE_MISSING", "the strace log is not a regular file");
            }
            return checkLogSize(stat.size);
        }
        catch (error) {
            if (error instanceof LogReadError)
                throw error;
            throw new LogReadError("TRACE_MISSING", "the strace log could not be inspected", { cause: error });
        }
    }
    async function remove(containerId) {
        const directory = runscLogDir(containerId);
        try {
            await fs.rm(directory);
        }
        catch (cause) {
            throw new LogReadError("LOG_REMOVE_FAILED", "the log directory could not be removed", { cause });
        }
    }
    return { readStraceLog, remove, logSize };
}
//# sourceMappingURL=log-reader.js.map