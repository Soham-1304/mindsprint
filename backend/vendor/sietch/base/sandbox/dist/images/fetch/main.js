import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { pipeline } from "node:stream/promises";
import { encodeFrames, FrameDecoder } from "../../framing.js";
import { MAX_LOCKFILE_BYTES, MAX_REPORT_BYTES } from "../../limits.js";
import { FETCH_CHILD_PATH, FETCH_EXIT, MAX_PACKAGE_JSON_BYTES, MAX_REQUEST_FRAME_BYTES, NPM_PROGRAM, } from "./limits.js";
import { parseFetchRequest } from "./request-frame.js";
import { frameHeader, parseProxyUrl, runDownload, runResolve, waitForPort, } from "./stages.js";
/**
 * Entrypoint of the fetch image: `node main.js resolve|download`, input on stdin as frames, output on
 * stdout as frames, nothing else on stdout. npm's own output goes to stderr (`stdio: [ignore, 2, 2]`),
 * which the host never logs or returns. Every failure exits non-zero with one fixed line on stderr and
 * nothing on stdout.
 *
 * stdin:  resolve  = [request JSON]
 *         download = [request JSON][package-lock.json]
 * stdout: resolve  = [package-lock.json]
 *         download = [script report JSON][cache tar]
 *
 * The container's environment holds only the proxy address (`npm_config_https_proxy`, set by
 * `fetchRunArgs`). npm gets its own small environment (see `npmEnv`), never this process's.
 */
const decoder = new TextDecoder();
function die(code, message) {
    process.stderr.write(`fetch: ${message}\n`);
    process.exit(code);
}
async function readFrames(caps) {
    const frames = new FrameDecoder(caps);
    for await (const chunk of process.stdin) {
        if (frames.push(chunk) !== undefined)
            break;
    }
    const result = frames.finish();
    if (!result.ok)
        die(FETCH_EXIT.badInput, "the input frames are invalid");
    return result.parts;
}
const nodeFiles = {
    async readPackageJson(key) {
        const path = `/tmp/proj/${key}/package.json`;
        let info;
        try {
            info = await lstat(path);
            // A link anywhere in the path would let a package point this read at another file: refuse it.
            if ((await realpath(path)) !== path)
                throw new Error("unusable package.json");
        }
        catch (error) {
            if (error.code === "ENOENT")
                return { kind: "absent" };
            throw error;
        }
        if (!info.isFile() || info.size > MAX_PACKAGE_JSON_BYTES)
            throw new Error("unusable package.json");
        return { kind: "present", json: JSON.parse(decoder.decode(await readFile(path))) };
    },
    async listPackageDir(key) {
        try {
            return await readdir(`/tmp/proj/${key}`);
        }
        catch (error) {
            if (error.code === "ENOENT")
                return null;
            throw error;
        }
    },
};
/** Runs a program with an argument array (never a shell) and npm's stdout redirected to stderr. */
function run(file, args, cwd, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(file, [...args], {
            env: { ...env },
            stdio: ["ignore", 2, 2],
            ...(cwd === undefined ? {} : { cwd }),
        });
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
    });
}
function tryConnect(endpoint) {
    return new Promise((resolve) => {
        const socket = connect({ host: endpoint.host, port: endpoint.port });
        socket.setTimeout(1000, () => socket.destroy());
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
        socket.once("close", () => resolve(false));
    });
}
function writeStdout(bytes) {
    return new Promise((resolve, reject) => {
        process.stdout.write(bytes, (error) => (error ? reject(error) : resolve()));
    });
}
async function main() {
    const stage = process.argv[2];
    if (process.argv.length !== 3 || (stage !== "resolve" && stage !== "download")) {
        die(FETCH_EXIT.badStage, "the stage must be resolve or download");
    }
    const proxyUrl = process.env.npm_config_https_proxy;
    const endpoint = parseProxyUrl(proxyUrl);
    if (proxyUrl === undefined || endpoint === null)
        die(FETCH_EXIT.badInput, "the proxy address is invalid");
    const parts = await readFrames(stage === "resolve" ? [MAX_REQUEST_FRAME_BYTES] : [MAX_REQUEST_FRAME_BYTES, MAX_LOCKFILE_BYTES]);
    const parsed = parseFetchRequest(parts[0] ?? new Uint8Array());
    if (!parsed.ok)
        die(FETCH_EXIT.badInput, "the request is invalid");
    const { request } = parsed;
    const env = { proxyUrl, registryHost: request.registryHost };
    const deps = {
        mkdir: async (path) => void (await mkdir(path, { recursive: true, mode: 0o700 })),
        writeFile: (path, bytes) => writeFile(path, bytes, { mode: 0o600 }),
        async readFile(path, maxBytes) {
            let info;
            try {
                info = await stat(path);
            }
            catch (error) {
                if (error.code === "ENOENT")
                    return null;
                throw error;
            }
            if (!info.isFile() || info.size > maxBytes)
                throw new Error("unusable file");
            return new Uint8Array(await readFile(path));
        },
        files: nodeFiles,
        tar: {
            run: (file, args) => run(file, args, undefined, { PATH: FETCH_CHILD_PATH }),
            fileSize: async (path) => (await stat(path)).size,
        },
        runNpm: (args, cwd, npmEnvironment) => run(NPM_PROGRAM, args, cwd, npmEnvironment),
        waitForProxy: () => waitForPort({
            tryConnect,
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
            now: () => Date.now(),
        }, endpoint),
    };
    if (stage === "resolve") {
        const result = await runResolve(deps, request, env);
        if (!result.ok)
            die(result.exitCode, result.reason);
        await writeStdout(encodeFrames([result.lockfile], [MAX_LOCKFILE_BYTES]));
        return;
    }
    const result = await runDownload(deps, request, parts[1] ?? new Uint8Array(), env);
    if (!result.ok)
        die(result.exitCode, result.reason);
    await writeStdout(encodeFrames([result.report], [MAX_REPORT_BYTES]));
    await writeStdout(frameHeader(result.cacheTarSize));
    await pipeline(createReadStream(result.cacheTarPath), process.stdout, { end: false });
}
main().then(() => process.exit(0), () => die(FETCH_EXIT.outputFailed, "unexpected failure"));
//# sourceMappingURL=main.js.map