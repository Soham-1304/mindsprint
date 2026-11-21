import { normaliseTrace } from "@sietch/core";
import { assembleScanInput } from "./assemble.js";
import { createCa } from "./ca.js";
import { buildDelivery } from "./delivery.js";
import { forceRemove, syscallsFor } from "./docker.js";
import { createNetworkArgs, detonationRunArgs, killArgs, networkRmArgs, sinkRunArgs } from "./docker-args.js";
import { buildFakeHome } from "./fake-home.js";
import { encodeFrames } from "./framing.js";
import { INSTALL_EXEC, LOAD_EXEC } from "./images/detonation/layout.js";
import { SINK_STDIN_CAPS } from "./images/sink/config.js";
import { MAX_LOG_BYTES, MAX_SINK_TOTAL_BYTES, OBSERVATION_WINDOW_MS, WALL_CLOCK_LIMIT_MS } from "./limits.js";
import { mergeEvents } from "./merge.js";
import { buildCiProfile } from "./profiles/ci-github-actions.js";
import { validateRequest } from "./request.js";
import { deriveNames, deriveSubnets, generateScanId } from "./scan-id.js";
import { checkScriptsRan } from "./script-report.js";
import { assignPhases, phaseBoundaries } from "./sink/phases.js";
import { parseSinkStream } from "./sink/records.js";
import { sinkRecordsToEvents } from "./sink/to-events.js";
import { buildPackageJson } from "./synthetic-package.js";
const encoder = new TextEncoder();
const DEFAULT_SINK_READY_MS = 3_000;
const DEFAULT_LOG_POLL_MS = 2_000;
/** Extra time the sink gets after detonation, so its own wall clock outlives the detonation container's. */
const SINK_EXTRA_MS = 20_000;
/** Status the detonation entrypoint uses after a clean run. */
const DETONATION_OK = 0;
class ScanFailure extends Error {
    code;
    constructor(code, reason) {
        super(reason);
        this.code = code;
    }
}
const fail = (code, reason) => {
    throw new ScanFailure(code, reason);
};
async function readCapped(stream, max) {
    const chunks = [];
    let total = 0;
    for await (const chunk of stream) {
        total += chunk.length;
        if (total > max)
            return null;
        chunks.push(chunk);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}
export async function runScan(input, deps) {
    const validated = validateRequest(input);
    if (!validated.ok)
        return { ok: false, code: "BAD_REQUEST", reason: validated.reason };
    const request = validated.value;
    const dev = request.mode === "dev";
    // Dev mode scans only our own fixtures; sandbox mode only the registry (security.md section 1).
    if ((dev ? "fixture" : "registry") !== deps.source.kind) {
        return { ok: false, code: "SOURCE_MISMATCH", reason: `mode ${request.mode} needs a different source` };
    }
    const check = await deps.selfCheck().catch(() => null);
    if (check === null || !check.ok) {
        return { ok: false, code: "HOST_EXPOSED", reason: check?.reason ?? "the host check failed" };
    }
    const scanId = generateScanId(deps.randomBytes);
    const meta = { scanId, dev };
    const names = deriveNames(scanId);
    const cleanup = { containerId: null };
    try {
        const scanInput = await detonate(request, deps, scanId, cleanup);
        return { ok: true, scanInput, meta };
    }
    catch (error) {
        if (error instanceof ScanFailure)
            return { ok: false, code: error.code, reason: error.message, meta };
        return { ok: false, code: "INTERNAL", reason: "the runner failed unexpectedly", meta };
    }
    finally {
        // Always: both containers, the network, the gVisor log. A failure here is swept later; the result stands.
        await forceRemove(deps.docker, names.containers.detonation).catch(() => undefined);
        await forceRemove(deps.docker, names.containers.sink).catch(() => undefined);
        await deps.docker.exec(networkRmArgs(names.networks.sandbox)).catch(() => undefined);
        if (cleanup.containerId !== null)
            await deps.logReader.remove(cleanup.containerId).catch(() => undefined);
    }
}
async function detonate(request, deps, scanId, cleanup) {
    const fetched = await deps.source.fetch(request, scanId).catch(() => null);
    if (fetched === null)
        fail("FETCH_FAILED", "the source failed");
    if (fetched !== null && !fetched.ok)
        fail("FETCH_FAILED", `the source refused the package (${fetched.code})`);
    const source = fetched;
    const profile = buildCiProfile({ rng: deps.rng, clock: deps.clock, arch: request.arch });
    const home = buildFakeHome(profile);
    const names = deriveNames(scanId);
    const sinkAddress = deriveSubnets(scanId).sandbox.serviceAddress;
    const ca = createCa(deps.caDeps);
    const wallClockMs = deps.wallClockMs ?? WALL_CLOCK_LIMIT_MS;
    const observeSeconds = deps.observeSeconds ?? OBSERVATION_WINDOW_MS / 1000;
    await deps.docker
        .exec(createNetworkArgs(scanId, "sandbox"))
        .catch(() => fail("SINK_START_FAILED", "network"));
    // The sink gets the CA certificate, the CA key and its own address on stdin. The key goes nowhere else.
    const sink = deps.docker.attach(sinkRunArgs(scanId, deps.images.sink), {
        timeoutMs: wallClockMs + SINK_EXTRA_MS,
        maxStdoutBytes: MAX_SINK_TOTAL_BYTES,
    });
    const sinkOut = readCapped(sink.stdout, MAX_SINK_TOTAL_BYTES);
    try {
        await sink.stdin.write(encodeFrames([encoder.encode(ca.certPem), encoder.encode(ca.keyPem), encoder.encode(sinkAddress)], SINK_STDIN_CAPS));
        sink.stdin.end();
    }
    catch {
        fail("SINK_START_FAILED", "the sink did not take its configuration");
    }
    await deps.sleep(deps.sinkReadyMs ?? DEFAULT_SINK_READY_MS);
    const stream = buildDelivery({
        profile,
        home,
        caCertPem: ca.certPem,
        project: { packageJson: buildPackageJson(request.name, request.version), lockfile: source.lockfile },
        cacheTar: source.cacheTar,
        sinkAddress,
        observeSeconds,
    });
    const detonation = deps.docker.attach(detonationRunArgs(scanId, deps.images.detonation), {
        timeoutMs: wallClockMs,
        maxStdoutBytes: 64 * 1024,
    });
    // Detonation output is hostile: drained and dropped, never read or logged.
    const drained = readCapped(detonation.stdout, 64 * 1024).catch(() => null);
    try {
        await detonation.stdin.write(stream);
        detonation.stdin.end();
    }
    catch {
        fail("DETONATION_FAILED", "the delivery stream was not taken");
    }
    // While it runs, keep the gVisor log under its cap: gVisor itself has no write-side limit.
    let containerId = null;
    let tooLarge = false;
    let running = true;
    const poll = (async () => {
        while (running) {
            await deps.sleep(deps.logPollMs ?? DEFAULT_LOG_POLL_MS);
            if (!running)
                break;
            containerId ??= await deps.docker.containerId(names.containers.detonation).catch(() => null);
            if (containerId === null)
                continue;
            cleanup.containerId = containerId;
            const size = await deps.logReader.logSize(containerId).catch(() => 0);
            if (size > MAX_LOG_BYTES) {
                tooLarge = true;
                await forceRemove(deps.docker, names.containers.detonation).catch(() => undefined);
                break;
            }
        }
    })();
    const exit = await detonation.exited;
    running = false;
    await poll;
    await drained;
    if (tooLarge)
        fail("TRACE_TOO_LARGE", "the gVisor log passed its cap during the run");
    if (exit.timedOut)
        fail("TIMEOUT", "the detonation container hit its wall-clock limit");
    if (exit.overflowed)
        fail("DETONATION_FAILED", "the detonation container wrote too much output");
    if (exit.code !== DETONATION_OK)
        fail("DETONATION_FAILED", `the detonation container exited ${exit.code}`);
    containerId ??= await deps.docker
        .containerId(names.containers.detonation)
        .catch(() => fail("TRACE_FAILED", "the detonation container id is unknown"));
    cleanup.containerId = containerId;
    // Stop the sink; it flushes and writes its end record. Then read and validate everything it recorded.
    await deps.docker.exec(killArgs(names.containers.sink, "SIGTERM")).catch(() => undefined);
    const sinkBytes = await sinkOut;
    const sinkExit = await sink.exited;
    if (sinkBytes === null || sinkExit.overflowed || sinkExit.timedOut)
        fail("SINK_LOST", "the sink stream overflowed");
    const parsed = parseSinkStream(sinkBytes);
    if (!parsed.ok)
        fail("SINK_LOST", parsed.ok ? "" : parsed.reason);
    const records = parsed.ok ? parsed.records : [];
    const log = await deps.logReader
        .readStraceLog(containerId)
        .catch(() => fail("TRACE_FAILED", "the gVisor log could not be read"));
    const trace = normaliseTrace(log, {
        initPid: 1,
        installExec: INSTALL_EXEC,
        loadExec: LOAD_EXEC,
        tracedSyscalls: syscallsFor(request.arch),
    });
    if (!trace.ok)
        return fail("TRACE_FAILED", `the trace was refused (${trace.code})`);
    const installExit = trace.events.find((event) => event.type === "exit" && event.pid === trace.packageManagerPid);
    if (installExit === undefined || installExit.code !== 0)
        fail("INSTALL_FAILED", "npm did not exit 0");
    const scripts = checkScriptsRan(source.report, trace.events, trace.packageManagerPid);
    if (!scripts.ok)
        fail("SCRIPTS_NOT_RUN", scripts.reason);
    const bounds = phaseBoundaries(trace.events, trace.originMs, trace.eventsTruncated, trace.packageManagerPid);
    if (!bounds.ok)
        return fail("MISSING_PHASE_BOUNDARY", bounds.reason);
    const sinkEvents = assignPhases(sinkRecordsToEvents(records), bounds.boundaries);
    const events = mergeEvents(trace.events, trace.originMs, sinkEvents);
    const assembled = assembleScanInput({
        package: { name: request.name, version: request.version, integrity: request.integrity },
        profile,
        extraCredentialPaths: home.extraCredentialPaths,
        sinkAddresses: [sinkAddress],
        packageManagerPid: trace.packageManagerPid,
        allowlist: request.allowlist,
        events,
        eventsTruncated: trace.eventsTruncated,
    });
    if (!assembled.ok)
        return fail("INVALID_SCAN_INPUT", assembled.reason);
    return assembled.scanInput;
}
//# sourceMappingURL=runner.js.map