import { SietchError } from "@sietch/core";
import { z } from "zod";
import { DockerError } from "./docker.js";
import { createEgressNetworkArgs, createNetworkArgs, isIPv4, networkRmArgs, probeRunArgs, rmArgs, } from "./docker-args.js";
import { DOCKER_CALL_TIMEOUT_MS } from "./limits.js";
import { checkRuntimes } from "./runtime-check.js";
import { deriveNames, deriveSubnets, generateScanId } from "./scan-id.js";
export const PROBE_PORTS = [22, 80, 443, 2375, 2376, 4873, 6379, 8080, 27017];
export const METADATA_ADDRESS = "169.254.169.254";
/**
 * The Colima (Lima) host as the VM sees it: the default gateway, which forwards to the Mac. The egress
 * network has a route out, so only a `DOCKER-USER` drop for private ranges keeps the proxy from it.
 */
export const LIMA_HOST_ADDRESS = "192.168.5.2";
/**
 * One other private (RFC 1918) address, the QEMU user-mode host gateway. A tripwire for the egress
 * network's drop of private ranges; a deployment adds the addresses of its own neighbours (the cloud
 * VPC gateway, for example) through `extraHostAddresses`.
 */
export const PRIVATE_PROBE_ADDRESS = "10.0.2.2";
const EGRESS_PRIVATE_TARGETS = [
    [LIMA_HOST_ADDRESS, "lima host"],
    [PRIVATE_PROBE_ADDRESS, "private address"],
];
const METADATA_PORT = 80;
const MAX_EXTRA_ADDRESSES = 8;
const PROBE_CONNECT_TIMEOUT_MS = 1500;
const PROBE_RUN_TIMEOUT_MS = DOCKER_CALL_TIMEOUT_MS;
/** Output cap on the probe container (Task 6). One line is about 30 bytes. */
export const PROBE_MAX_OUTPUT_BYTES = 8 * 1024;
const MAX_LINE_CHARS = 100;
const OUTCOMES = ["connected", "refused", "timeout", "unreachable", "error"];
/** The host name the table uses for the probe's own local listener (the positive control). */
const CONTROL_HOST = "@control";
/**
 * The control is last, so the ids of the real targets do not depend on it. The egress network adds the
 * private-address targets after the extras.
 */
function buildTargets(gateway, extras, egressNetwork) {
    const targets = [];
    const add = (host, port, isGateway, label, control = false) => {
        targets.push({ id: targets.length, host, port, gateway: isGateway, control, label });
    };
    for (const port of PROBE_PORTS)
        add(gateway, port, true, `gateway port ${port}`);
    add(METADATA_ADDRESS, METADATA_PORT, false, "metadata address");
    extras.forEach((address, index) => {
        for (const port of PROBE_PORTS)
            add(address, port, false, `extra host ${index + 1} port ${port}`);
    });
    if (egressNetwork) {
        for (const [address, label] of EGRESS_PRIVATE_TARGETS) {
            for (const port of PROBE_PORTS)
                add(address, port, false, `${label} port ${port}`);
        }
    }
    add(CONTROL_HOST, 0, false, "probe control", true);
    return targets;
}
/**
 * The script `node -` runs in the probe container. Its only variable part is the target table, built from
 * integers and validated IPv4 literals and written as JSON.
 */
function probeScript(targets) {
    const table = JSON.stringify(targets.map((target) => [target.id, target.host, target.port]));
    return `const net = require("node:net");
const targets = ${table};
const server = net.createServer((socket) => socket.destroy());
server.once("error", () => process.exit(1));
server.listen(0, "127.0.0.1", () => {
const controlPort = server.address().port;
const finishedAll = [];
for (const [id, name, targetPort] of targets) {
  const control = name === ${JSON.stringify(CONTROL_HOST)};
  const host = control ? "127.0.0.1" : name;
  const port = control ? controlPort : targetPort;
  finishedAll.push(new Promise((resolve) => {
    let done = false;
    const socket = net.connect({ host, port });
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      process.stdout.write(JSON.stringify({ id, r }) + "\\n");
      resolve();
    };
    const timer = setTimeout(() => finish("timeout"), ${PROBE_CONNECT_TIMEOUT_MS});
    socket.once("connect", () => finish("connected"));
    socket.once("error", (error) => {
      const code = error && error.code;
      finish(code === "ECONNREFUSED" ? "refused" : code === "ETIMEDOUT" ? "timeout"
        : code === "ENETUNREACH" || code === "EHOSTUNREACH" ? "unreachable" : "error");
    });
  }));
}
Promise.all(finishedAll).then(() => process.exit(0));
});
`;
}
function parseProbeOutput(text, targetCount) {
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "")
        lines.pop();
    if (lines.length === 0 || lines.length > targetCount)
        return { ok: false };
    const schema = z.strictObject({
        id: z
            .number()
            .int()
            .min(0)
            .max(targetCount - 1),
        r: z.enum(OUTCOMES),
    });
    const outcomes = new Map();
    for (const line of lines) {
        if (line.length === 0 || line.length > MAX_LINE_CHARS)
            return { ok: false };
        let json;
        try {
            json = JSON.parse(line);
        }
        catch {
            return { ok: false };
        }
        const parsed = schema.safeParse(json);
        if (!parsed.success || outcomes.has(parsed.data.id))
            return { ok: false };
        outcomes.set(parsed.data.id, parsed.data.r);
    }
    return { ok: true, outcomes };
}
function passes(target, outcome) {
    // The control is the one target that must connect. If it can't, the probe's own networking is broken
    // and its "timeout" results prove nothing.
    if (target.control)
        return outcome === "connected";
    return outcome === "timeout" || (!target.gateway && outcome === "unreachable");
}
function exposed(reason) {
    return { ok: false, code: "HOST_EXPOSED", reason };
}
function errorCode(error) {
    return error instanceof SietchError ? error.code : "UNKNOWN";
}
/** The daemon says the thing is already gone (the probe never created it, or it was removed): not a leftover. */
const ALREADY_GONE = /no such (?:container|network)|network \S+ not found/i;
/**
 * Removes the probe's container, then its network, and returns what failed as constant labels. A thing
 * that does not exist is not a failure. Any other failure leaves a container or a bridge behind, and an
 * egress bridge has a route out, so the caller reports it (review CR-8). Both removals are always tried.
 */
async function cleanUp(deps, containerName, networkName) {
    const failed = [];
    const attempts = [
        ["container", rmArgs(containerName)],
        ["network", networkRmArgs(networkName)],
    ];
    for (const [label, argv] of attempts) {
        try {
            await deps.docker.exec(argv);
        }
        catch (error) {
            if (error instanceof DockerError &&
                error.code === "DOCKER_FAILED" &&
                ALREADY_GONE.test(error.message)) {
                continue;
            }
            failed.push(`${label}: ${errorCode(error)}`);
        }
    }
    return failed;
}
async function checkNetwork(deps, id, kind, extras) {
    const names = deriveNames(id);
    const { egress } = deps;
    if (kind === "egress" && egress === undefined)
        return exposed("egress network: no egress network given");
    // The egress probe takes the proxy's name, so one cleanup path covers all three kinds.
    const containerName = kind === "sandbox"
        ? names.containers.detonation
        : kind === "fetch"
            ? names.containers.fetch
            : names.containers.proxy;
    const networkName = names.networks[kind];
    const result = await probeNetwork(deps, id, kind, extras);
    const leftovers = await cleanUp(deps, containerName, networkName);
    if (leftovers.length === 0)
        return result;
    const note = `cleanup failed (${leftovers.join(", ")})`;
    return exposed(result.ok ? `${kind} network: ${note}` : `${result.reason}; ${note}`);
}
async function probeNetwork(deps, id, kind, extras) {
    const { egress } = deps;
    try {
        const gateway = kind === "egress" ? (egress?.gateway ?? "") : deriveSubnets(id)[kind].gateway;
        const targets = buildTargets(gateway, extras, kind === "egress");
        await deps.docker.exec(kind === "egress" ? createEgressNetworkArgs(id, egress) : createNetworkArgs(id, kind));
        const { stdout } = await deps.docker.exec(probeRunArgs(id, kind, deps.probeImage, egress), {
            stdin: new TextEncoder().encode(probeScript(targets)),
            timeoutMs: PROBE_RUN_TIMEOUT_MS,
            maxStdoutBytes: PROBE_MAX_OUTPUT_BYTES,
        });
        const parsed = parseProbeOutput(stdout, targets.length);
        if (!parsed.ok)
            return exposed(`${kind} network: the probe output was not valid`);
        for (const target of targets) {
            const outcome = parsed.outcomes.get(target.id);
            if (outcome === undefined)
                return exposed(`${kind} network: no result for ${target.label}`);
            if (!passes(target, outcome))
                return exposed(`${kind} network: ${target.label} answered "${outcome}"`);
        }
        return { ok: true };
    }
    catch (error) {
        return exposed(`${kind} network: the probe could not run (${errorCode(error)})`);
    }
}
/** Run once per host at startup. `HOST_EXPOSED` means: do not scan. */
export async function selfCheck(deps) {
    // Fail closed: a missing `egress` is not "no proxy". The caller must say so with `noProxy: true`.
    if (deps.egress === undefined && deps.noProxy !== true) {
        return exposed("egress network: not given (pass egress, or noProxy: true when there is no proxy)");
    }
    if (deps.egress !== undefined && deps.noProxy === true) {
        return exposed("egress network: egress and noProxy were both given");
    }
    const extras = deps.extraHostAddresses ?? [];
    if (!Array.isArray(extras) || extras.length > MAX_EXTRA_ADDRESSES || !extras.every(isIPv4)) {
        return exposed("invalid extra host address list");
    }
    // The recording must be complete before anything else is worth checking (review CR-1).
    const runtimes = await checkRuntimes(deps);
    if (!runtimes.ok)
        return runtimes;
    let id;
    try {
        id = generateScanId(deps.randomBytes);
    }
    catch (error) {
        return exposed(`could not create a probe id (${errorCode(error)})`);
    }
    const kinds = deps.egress === undefined ? ["sandbox", "fetch"] : ["sandbox", "fetch", "egress"];
    for (const kind of kinds) {
        const result = await checkNetwork(deps, id, kind, extras);
        if (!result.ok)
            return result;
    }
    return { ok: true };
}
//# sourceMappingURL=self-check.js.map