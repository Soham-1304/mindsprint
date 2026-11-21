import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { runInit, } from "./init.js";
/**
 * The detonation container's entrypoint (PID 1). It wires the real Node APIs into `runInit` and exits with
 * its code. All the logic, and its tests, are in `init.ts`. Nothing is read from the environment or from
 * the arguments: the container is started with neither.
 */
const fileSystem = {
    async readFile(path) {
        return new Uint8Array(await readFile(path));
    },
    async mkdirp(path) {
        await mkdir(path, { recursive: true, mode: 0o755 });
    },
    async writeNewFile(path, data, mode) {
        const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
        try {
            await handle.writeFile(data);
            await handle.chmod(mode);
        }
        finally {
            await handle.close();
        }
    },
    async removeTree(path) {
        await rm(path, { recursive: true, force: true });
    },
};
function spawnChild(request) {
    // `shell` is never set: the file is an absolute path and the arguments are an array.
    const child = spawn(request.file, [...request.args], {
        cwd: request.cwd,
        env: { ...request.env },
        stdio: ["ignore", request.captureStdout ? "pipe" : "ignore", "ignore"],
    });
    const exited = new Promise((resolve) => {
        child.once("error", () => resolve({ kind: "error" }));
        child.once("close", (code, signal) => resolve({ kind: "exit", code, signal }));
    });
    return {
        stdout: request.captureStdout && child.stdout !== null ? child.stdout : null,
        exited,
        kill: () => {
            child.kill("SIGTERM");
        },
    };
}
const deps = {
    stdin: process.stdin,
    fs: fileSystem,
    spawn: spawnChild,
    timeout: (ms) => {
        let handle;
        const promise = new Promise((resolve) => {
            handle = setTimeout(resolve, ms);
        });
        return { promise, cancel: () => clearTimeout(handle) };
    },
    log: (line) => {
        process.stderr.write(`${line}\n`);
    },
};
runInit(deps).then((code) => process.exit(code), () => process.exit(71));
//# sourceMappingURL=main.js.map