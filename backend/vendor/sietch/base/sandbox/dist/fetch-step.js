import { SietchError } from "@sietch/core";
import { DockerError, forceRemove } from "./docker.js";
import { connectEgressArgs, createEgressNetworkArgs, createNetworkArgs, fetchRunArgs, proxyCreateArgs, startArgs, } from "./docker-args.js";
import { encodeFrames, FRAME_HEADER_BYTES, FrameDecoder } from "./framing.js";
import { MAX_REQUEST_FRAME_BYTES } from "./images/fetch/limits.js";
import { encodeFetchRequest } from "./images/fetch/request-frame.js";
import { FETCH_STAGE_TIMEOUT_MS, MAX_DEPS_BYTES, MAX_FETCH_STDERR_BYTES, MAX_LOCKFILE_BYTES, MAX_REPORT_BYTES, } from "./limits.js";
import { checkLockfile } from "./lockfile.js";
import { deriveNames } from "./scan-id.js";
import { parseScriptReport } from "./script-report.js";
/** The step was called with input its builders refuse. A caller bug, not a fetch failure. */
export class FetchStepInputError extends SietchError {
    constructor(message) {
        super("FETCH_STEP_INPUT_INVALID", message);
    }
}
const fail = (code, reason) => ({ ok: false, code, reason });
async function runStage(deps, spec) {
    const timeoutMs = deps.stageTimeoutMs ?? FETCH_STAGE_TIMEOUT_MS;
    const maxStdoutBytes = spec.outputCaps.reduce((sum, cap) => sum + cap, 0) + FRAME_HEADER_BYTES * spec.outputCaps.length;
    try {
        let child;
        try {
            child = deps.docker.attach(spec.argv, {
                timeoutMs,
                maxStdoutBytes,
                maxStderrBytes: MAX_FETCH_STDERR_BYTES,
            });
        }
        catch {
            return fail("FETCH_OUTPUT_INVALID", `the ${spec.label} stage could not be started`);
        }
        const decoder = new FrameDecoder(spec.outputCaps);
        let decodeError;
        let streamFailed = false;
        const reading = (async () => {
            try {
                for await (const chunk of child.stdout) {
                    decodeError = decoder.push(chunk);
                    if (decodeError !== undefined) {
                        // Over a cap or malformed: stop reading and stop the container.
                        child.kill("SIGKILL");
                        break;
                    }
                }
            }
            catch (error) {
                // The attach layer ended the stream: output over its limit, a kill, or a broken pipe.
                if (!(error instanceof DockerError))
                    throw error;
                streamFailed = true;
            }
        })();
        // Observed again by `await reading` below; this keeps an early rejection from being reported as unhandled.
        reading.catch(() => undefined);
        // A container that exits before it has read its input makes the write fail; its exit code says why.
        await child.stdin.write(spec.stdin).catch(() => undefined);
        child.stdin.end();
        await reading;
        let exit;
        try {
            exit = await child.exited;
        }
        catch {
            return fail("FETCH_OUTPUT_INVALID", `the ${spec.label} stage could not be run`);
        }
        // The container's stderr is `exit.stderr`. It is hostile and is deliberately never read.
        if (exit.timedOut)
            return fail("FETCH_LIMIT", `the ${spec.label} stage ran past its time limit`);
        if (exit.overflowed || (streamFailed && decodeError === undefined)) {
            return fail("FETCH_LIMIT", `the ${spec.label} stage wrote more output than its limit`);
        }
        if (decodeError?.code === "FRAME_OVER_CAP") {
            return fail("FETCH_LIMIT", `the ${spec.label} stage output has a part over its size cap`);
        }
        if (decodeError !== undefined) {
            return fail("FETCH_OUTPUT_INVALID", `the ${spec.label} stage output is not valid frames`);
        }
        if (exit.code !== 0) {
            const how = exit.code === null ? `signal ${exit.signal ?? "unknown"}` : `exit ${exit.code}`;
            return fail("FETCH_OUTPUT_INVALID", `the ${spec.label} stage failed (${how})`);
        }
        const decoded = decoder.finish();
        if (!decoded.ok)
            return fail("FETCH_OUTPUT_INVALID", `the ${spec.label} stage output is not valid frames`);
        return { ok: true, parts: decoded.parts };
    }
    finally {
        // After a timeout or overflow the container may still be running: remove it in every case.
        await forceRemove(deps.docker, spec.containerName);
    }
}
async function runSetup(docker, argv, failure) {
    try {
        await docker.exec(argv);
        return null;
    }
    catch (error) {
        if (error instanceof DockerError)
            return failure;
        throw error;
    }
}
export async function fetchStep(deps, input) {
    const { id, images, request, registryHost, dnsServers, egress } = input;
    // Build every argument vector and the request frame first: invalid input throws before Docker is touched.
    const names = deriveNames(id);
    const fetchNetwork = createNetworkArgs(id, "fetch");
    const egressNetwork = createEgressNetworkArgs(id, egress);
    const proxyCreate = proxyCreateArgs(id, { image: images.proxy, registryHost, dnsServers });
    const proxyConnect = connectEgressArgs(id, egress);
    const proxyStart = startArgs(names.containers.proxy);
    const resolveArgv = fetchRunArgs(id, images.fetch, "resolve");
    const downloadArgv = fetchRunArgs(id, images.fetch, "download");
    let requestFrame;
    try {
        requestFrame = encodeFetchRequest({ name: request.name, version: request.version, registryHost });
    }
    catch {
        throw new FetchStepInputError("the fetch request is not a plain package name, exact version and host");
    }
    const networkFailure = fail("NETWORK_FAILED", "a fetch network could not be created");
    const proxyFailure = fail("PROXY_START_FAILED", "the registry proxy could not be started");
    const setup = [
        [fetchNetwork, networkFailure],
        [egressNetwork, networkFailure],
        [proxyCreate, proxyFailure],
        [proxyConnect, proxyFailure],
        [proxyStart, proxyFailure],
    ];
    for (const [argv, failure] of setup) {
        const failed = await runSetup(deps.docker, argv, failure);
        if (failed !== null)
            return failed;
    }
    const resolved = await runStage(deps, {
        label: "resolve",
        argv: resolveArgv,
        containerName: names.containers.fetch,
        stdin: encodeFrames([requestFrame], [MAX_REQUEST_FRAME_BYTES]),
        outputCaps: [MAX_LOCKFILE_BYTES],
    });
    if (!resolved.ok)
        return resolved;
    const lockfile = resolved.parts[0] ?? new Uint8Array();
    const checked = checkLockfile(lockfile, {
        registryHost,
        name: request.name,
        version: request.version,
        integrity: request.integrity,
    });
    if (!checked.ok)
        return fail(checked.code, checked.reason);
    const downloaded = await runStage(deps, {
        label: "download",
        argv: downloadArgv,
        containerName: names.containers.fetch,
        stdin: encodeFrames([requestFrame, lockfile], [MAX_REQUEST_FRAME_BYTES, MAX_LOCKFILE_BYTES]),
        outputCaps: [MAX_REPORT_BYTES, MAX_DEPS_BYTES],
    });
    if (!downloaded.ok)
        return downloaded;
    const reportBytes = downloaded.parts[0] ?? new Uint8Array();
    const cacheTar = downloaded.parts[1] ?? new Uint8Array();
    const parsed = parseScriptReport(reportBytes, checked.packagePaths);
    if (!parsed.ok)
        return fail(parsed.code, parsed.reason);
    if (cacheTar.length === 0)
        return fail("FETCH_OUTPUT_INVALID", "the download stage returned an empty cache");
    return {
        ok: true,
        lockfile,
        report: parsed.report,
        packagePaths: checked.packagePaths,
        requestedPath: checked.requestedPath,
        cacheTar,
    };
}
//# sourceMappingURL=fetch-step.js.map