import { SietchError } from "@sietch/core";
/**
 * Scan ids, and every name derived from one. An id is generated here, but it can also arrive from a
 * queue job or a cleanup sweep, so every derivation re-validates it against a strict pattern.
 * Names built from a valid id contain only lowercase hex, digits, and fixed words, so they can't
 * inject anything into a Docker argument.
 */
/** Prefix of every Docker resource the runner creates. `sweep()` matches on it. Change it here only. */
export declare const RESOURCE_PREFIX = "sietch-scan";
/** Where gVisor writes the per-container debug log on the Docker host (`--debug-log=/var/log/runsc/%ID%/`). */
export declare const RUNSC_LOG_ROOT = "/var/log/runsc";
/** 12 random bytes as lowercase hex. */
export declare const SCAN_ID_PATTERN: RegExp;
/** A Docker container id as printed by `docker run -d`. */
export declare const CONTAINER_ID_PATTERN: RegExp;
export declare class InvalidScanIdError extends SietchError {
    constructor(message: string);
}
/** Returns `length` random bytes. Injected so tests are deterministic. */
export type RandomBytes = (length: number) => Uint8Array;
export declare function isValidScanId(value: unknown): value is string;
/** Make a fresh scan id from the injected random source. */
export declare function generateScanId(randomBytes: RandomBytes): string;
export interface ScanNames {
    readonly containers: {
        readonly fetch: string;
        readonly proxy: string;
        readonly sink: string;
        readonly detonation: string;
    };
    readonly networks: {
        /** Internal. Members: the capture sink and the detonation container. */
        readonly sandbox: string;
        /** Internal. Members: the registry proxy and the fetch container. */
        readonly fetch: string;
        /** The proxy's route out to the registry. */
        readonly egress: string;
    };
}
/** Container and network names for one scan. Throws InvalidScanIdError for an invalid id. */
export declare function deriveNames(id: string): ScanNames;
/** True for a name `deriveNames` can produce. Used by the sweep, which must never touch other resources. */
export declare function isScanResourceName(name: unknown): name is string;
/** The gVisor log directory for a container. Throws InvalidScanIdError unless `containerId` is 64 hex chars. */
export declare function runscLogDir(containerId: string): string;
export declare const SUBNET_SLOTS = 32768;
export interface ScanSubnet {
    /** For `docker network create --subnet`. */
    readonly cidr: string;
    /** Docker's bridge gateway address (.1). Reachable by no container (host assumption D14). */
    readonly gateway: string;
    /** Fixed address (.2) of the single service on this network: the sink or the proxy. */
    readonly serviceAddress: string;
}
export interface ScanSubnets {
    readonly sandbox: ScanSubnet;
    readonly fetch: ScanSubnet;
}
/** The sandbox and fetch subnets for a scan. Built from integers only. Throws for an invalid id. */
export declare function deriveSubnets(id: string): ScanSubnets;
//# sourceMappingURL=scan-id.d.ts.map