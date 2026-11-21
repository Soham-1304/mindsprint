import { FRAME_HEADER_BYTES } from "../../framing.js";
import { MAX_DEPS_BYTES, MAX_LOCKFILE_BYTES } from "../../limits.js";
import { buildPackageJson } from "../../synthetic-package.js";
import { createCacheTar } from "./cache-tar.js";
import { FETCH_CACHE_DIR, FETCH_CACHE_TAR, FETCH_EMPTY_GLOBAL_NPMRC, FETCH_EMPTY_USER_NPMRC, FETCH_EXIT, FETCH_PROJECT_DIR, PROXY_WAIT_INTERVAL_MS, PROXY_WAIT_MS, } from "./limits.js";
import { downloadArgv, npmEnv, resolveArgv } from "./npm-argv.js";
import { buildScriptReport } from "./script-report-builder.js";
const fail = (exitCode, reason) => ({ ok: false, exitCode, reason });
async function prepare(deps, request) {
    try {
        await deps.mkdir(FETCH_PROJECT_DIR);
        await deps.mkdir(FETCH_CACHE_DIR);
        await deps.writeFile(FETCH_EMPTY_USER_NPMRC, new Uint8Array());
        await deps.writeFile(FETCH_EMPTY_GLOBAL_NPMRC, new Uint8Array());
        await deps.writeFile(`${FETCH_PROJECT_DIR}/package.json`, buildPackageJson(request.name, request.version));
    }
    catch {
        return fail(FETCH_EXIT.badInput, "the project directory could not be prepared");
    }
    return null;
}
async function runNpmStage(deps, args, env) {
    if (!(await deps.waitForProxy()))
        return fail(FETCH_EXIT.proxyNotReady, "the proxy did not accept connections");
    let code;
    try {
        code = await deps.runNpm(args, FETCH_PROJECT_DIR, npmEnv(env));
    }
    catch {
        return fail(FETCH_EXIT.npmFailed, "npm could not run");
    }
    return code === 0 ? null : fail(FETCH_EXIT.npmFailed, "npm failed");
}
export async function runResolve(deps, request, env) {
    const prepared = await prepare(deps, request);
    if (prepared !== null)
        return prepared;
    const failure = await runNpmStage(deps, resolveArgv(), env);
    if (failure !== null)
        return failure;
    let lockfile;
    try {
        lockfile = await deps.readFile(`${FETCH_PROJECT_DIR}/package-lock.json`, MAX_LOCKFILE_BYTES);
    }
    catch {
        return fail(FETCH_EXIT.outputFailed, "the lockfile is too large or unreadable");
    }
    if (lockfile === null || lockfile.length === 0)
        return fail(FETCH_EXIT.outputFailed, "npm wrote no lockfile");
    return { ok: true, lockfile };
}
export async function runDownload(deps, request, lockfile, env) {
    const prepared = await prepare(deps, request);
    if (prepared !== null)
        return prepared;
    try {
        await deps.writeFile(`${FETCH_PROJECT_DIR}/package-lock.json`, lockfile);
    }
    catch {
        return fail(FETCH_EXIT.badInput, "the lockfile could not be written");
    }
    const failure = await runNpmStage(deps, downloadArgv(), env);
    if (failure !== null)
        return failure;
    let report;
    try {
        report = await buildScriptReport(lockfile, deps.files);
    }
    catch {
        return fail(FETCH_EXIT.reportFailed, "the script report could not be built");
    }
    if (!report.ok)
        return fail(FETCH_EXIT.reportFailed, report.reason);
    const archived = await createCacheTar(deps.tar, {
        cacheDir: FETCH_CACHE_DIR,
        outFile: FETCH_CACHE_TAR,
        maxBytes: MAX_DEPS_BYTES,
    });
    if (!archived.ok)
        return fail(FETCH_EXIT.tarFailed, archived.reason);
    return { ok: true, report: report.bytes, cacheTarPath: FETCH_CACHE_TAR, cacheTarSize: archived.size };
}
/**
 * The 8-byte big-endian length that starts a frame. The cache archive is streamed from a file, so its
 * header is written separately from its bytes (see `framing.ts` for the format the host decodes).
 */
export function frameHeader(length) {
    if (!Number.isSafeInteger(length) || length < 0)
        throw new RangeError("invalid frame length");
    const header = new Uint8Array(FRAME_HEADER_BYTES);
    new DataView(header.buffer).setBigUint64(0, BigInt(length));
    return header;
}
// --- Waiting for the proxy -------------------------------------------------------------------------
const PROXY_URL = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/;
/** Reads `http://<ipv4>:<port>` (the form `docker-args.ts` sets). Null for anything else. */
export function parseProxyUrl(url) {
    const match = typeof url === "string" ? PROXY_URL.exec(url) : null;
    if (match === null)
        return null;
    const host = match[1];
    const port = Number(match[2]);
    const octets = host.split(".").map(Number);
    if (octets.some((octet) => octet > 255) || port < 1 || port > 65535)
        return null;
    return { host, port };
}
/** Polls the proxy port until it accepts a connection or `timeoutMs` has passed. */
export async function waitForPort(deps, endpoint, timeoutMs = PROXY_WAIT_MS, intervalMs = PROXY_WAIT_INTERVAL_MS) {
    const deadline = deps.now() + timeoutMs;
    for (;;) {
        if (await deps.tryConnect(endpoint))
            return true;
        if (deps.now() + intervalMs > deadline)
            return false;
        await deps.sleep(intervalMs);
    }
}
//# sourceMappingURL=stages.js.map