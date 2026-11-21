import { SietchError } from "@sietch/core";
/**
 * Scan ids, and every name derived from one. An id is generated here, but it can also arrive from a
 * queue job or a cleanup sweep, so every derivation re-validates it against a strict pattern.
 * Names built from a valid id contain only lowercase hex, digits, and fixed words, so they can't
 * inject anything into a Docker argument.
 */
/** Prefix of every Docker resource the runner creates. `sweep()` matches on it. Change it here only. */
export const RESOURCE_PREFIX = "sietch-scan";
/** Where gVisor writes the per-container debug log on the Docker host (`--debug-log=/var/log/runsc/%ID%/`). */
export const RUNSC_LOG_ROOT = "/var/log/runsc";
const SCAN_ID_BYTES = 12;
/** 12 random bytes as lowercase hex. */
export const SCAN_ID_PATTERN = /^[0-9a-f]{24}$/;
/** A Docker container id as printed by `docker run -d`. */
export const CONTAINER_ID_PATTERN = /^[0-9a-f]{64}$/;
export class InvalidScanIdError extends SietchError {
    constructor(message) {
        super("INVALID_SCAN_ID", message);
    }
}
export function isValidScanId(value) {
    return typeof value === "string" && SCAN_ID_PATTERN.test(value);
}
function assertScanId(id) {
    if (!isValidScanId(id))
        throw new InvalidScanIdError("scan id does not match the required pattern");
}
/** Make a fresh scan id from the injected random source. */
export function generateScanId(randomBytes) {
    const bytes = randomBytes(SCAN_ID_BYTES);
    if (!(bytes instanceof Uint8Array) || bytes.length !== SCAN_ID_BYTES) {
        throw new InvalidScanIdError(`random source must return exactly ${SCAN_ID_BYTES} bytes`);
    }
    let id = "";
    for (const byte of bytes)
        id += byte.toString(16).padStart(2, "0");
    assertScanId(id);
    return id;
}
/** Container and network names for one scan. Throws InvalidScanIdError for an invalid id. */
export function deriveNames(id) {
    assertScanId(id);
    const base = `${RESOURCE_PREFIX}-${id}`;
    return {
        containers: {
            fetch: `${base}-fetch`,
            proxy: `${base}-proxy`,
            sink: `${base}-sink`,
            detonation: `${base}-det`,
        },
        networks: {
            sandbox: `${base}-net-sandbox`,
            fetch: `${base}-net-fetch`,
            egress: `${base}-net-egress`,
        },
    };
}
const RESOURCE_NAME_PATTERN = new RegExp(`^${RESOURCE_PREFIX}-[0-9a-f]{24}-(?:fetch|proxy|sink|det|net-sandbox|net-fetch|net-egress)$`);
/** True for a name `deriveNames` can produce. Used by the sweep, which must never touch other resources. */
export function isScanResourceName(name) {
    return typeof name === "string" && RESOURCE_NAME_PATTERN.test(name);
}
/** The gVisor log directory for a container. Throws InvalidScanIdError unless `containerId` is 64 hex chars. */
export function runscLogDir(containerId) {
    if (typeof containerId !== "string" || !CONTAINER_ID_PATTERN.test(containerId)) {
        throw new InvalidScanIdError("container id must be 64 lowercase hex characters");
    }
    return `${RUNSC_LOG_ROOT}/${containerId}`;
}
// --- Per-scan subnets -----------------------------------------------------------------------------
// Reserved range 10.240.0.0/12 (host assumption: nothing else routes here, see the deploy spec).
// It holds 65,536 blocks of 16 addresses (/28). Each scan takes two adjacent blocks, one for the
// sandbox network and one for the fetch network, chosen by 15 bits of the scan id. Two concurrent
// scans that land on the same slot make `docker network create` fail with an overlap, which ends
// the second scan as ERROR. Nothing falls back to another range.
const RANGE_FIRST_OCTET = 10;
const RANGE_SECOND_OCTET_BASE = 240;
const BLOCK_SIZE = 16;
export const SUBNET_SLOTS = 32_768;
function blockAt(block) {
    const offset = block * BLOCK_SIZE;
    const second = RANGE_SECOND_OCTET_BASE + (offset >>> 16);
    const third = (offset >>> 8) & 0xff;
    const fourth = offset & 0xff;
    const prefix = `${RANGE_FIRST_OCTET}.${second}.${third}`;
    return {
        cidr: `${prefix}.${fourth}/28`,
        gateway: `${prefix}.${fourth + 1}`,
        serviceAddress: `${prefix}.${fourth + 2}`,
    };
}
/** The sandbox and fetch subnets for a scan. Built from integers only. Throws for an invalid id. */
export function deriveSubnets(id) {
    assertScanId(id);
    const slot = Number.parseInt(id.slice(0, 4), 16) % SUBNET_SLOTS;
    return { sandbox: blockAt(slot * 2), fetch: blockAt(slot * 2 + 1) };
}
//# sourceMappingURL=scan-id.js.map