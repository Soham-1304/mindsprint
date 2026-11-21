import { SietchError } from "@sietch/core";
/**
 * The only place a `docker` argument vector is built. Pure: no `node:` imports, no I/O.
 *
 * Every builder takes a scan id (re-validated by `deriveNames`/`deriveSubnets`), a digest-pinned image
 * reference, or a validated constant, and returns a `DockerArgv`. Package names, versions, and registry
 * text never reach an argument: the fetch request goes in on stdin. The builders have no code path that
 * can emit a mount or volume of any kind, a privileged or capability-adding flag, a host network, a
 * runtime other than the two gVisor runtimes, `--dns*`, `--sysctl`, or a detonation `--env`.
 *
 * `assertSafeArgv` is an allowlist checker, not a denylist: every token must be a known boolean flag, a
 * `--name=value` option from the table below whose value passes that option's pattern, a fixed
 * subcommand word, a derived container or network name, a digest-pinned image, a fetch stage, or the
 * single token `-`. Long options exist only in the one-token `--name=value` form, so no spaced form can
 * hide a value. It also checks the shape of each subcommand: `run` and `create` must carry the whole
 * hardening block (runtime, internal network, read-only root, user, capabilities, limits, tmpfs), with
 * limits no larger than the largest configured set; the options come before one image argument; a
 * scan network must be internal; and a container and its network must belong to the same scan. A vector
 * that leaves a hardening option out is refused, not just one that adds a forbidden token. The Docker client (`docker.ts`) runs the same checker before every call, so the property
 * test and the runtime guard cannot drift.
 *
 * Host assumption (not enforced here): an `INPUT` drop rule for `10.240.0.0/12`, installed by deploy and
 * persistent across reboot, stops containers on the per-scan internal networks from reaching host
 * services through the bridge gateway address. `selfCheck` verifies it before scans start.
 *
 * `--log-driver=none` is set on every container. The default driver stores container stdout on the host
 * disk without a cap (a package printing in a loop could fill it), and the sink's stdout holds full
 * honeytokens. Attach streams still work with this driver.
 */
export declare class DockerArgsError extends SietchError {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
declare const argvBrand: unique symbol;
/** An argument vector (without the `docker` program name) that passed `assertSafeArgv`. Made only here. */
export type DockerArgv = readonly string[] & {
    readonly [argvBrand]: true;
};
export declare const RUNTIME_PLAIN = "runsc";
export declare const RUNTIME_TRACED = "runsc-trace-min";
export declare const CONTAINER_USER = "1000:1000";
export declare const PROXY_PORT = 3128;
/** Environment variable names the proxy image (Task 10) reads. */
export declare const PROXY_ENV: {
    readonly registryHost: "REGISTRY_HOST";
    readonly dnsServers: "DNS_SERVERS";
};
/** The detonation container's tmpfs targets, in mount order. The CI profile's fixed paths must sit under these. */
export declare const DETONATION_TMPFS_PATHS: readonly string[];
/** A digest-pinned image reference. No tag-only form, so it can't look like a flag or float to a new image. */
export declare function isImageRef(value: unknown): value is string;
/** Strict dotted-quad IPv4: four decimal octets 0-255, no leading zeros, no whitespace. */
export declare function isIPv4(value: unknown): value is string;
/** Strict IPv4 CIDR with the host bits zero, such as `10.240.0.0/28`. */
export declare function isCidr(value: unknown): value is string;
/** A lowercase DNS host name (letters, digits, hyphens, dots), such as `registry.npmjs.org`. */
export declare function isRegistryHost(value: unknown): value is string;
/** One to four IPv4 addresses. */
export declare function isDnsServerList(value: unknown): value is readonly string[];
/**
 * Returns a reason (a fixed label and a token index, never the token text) for the first token that is
 * not on the allowlist, or null when the whole argument vector is allowed.
 */
export declare function findUnsafeArg(argv: unknown): string | null;
/** Returns the vector as a `DockerArgv` or throws `DockerArgsError`. The message never contains a token. */
export declare function assertSafeArgv(argv: unknown): DockerArgv;
/**
 * The proxy's route out to the registry. Injected by the runner, because `scan-id.ts` derives only the
 * sandbox and fetch subnets. It must sit inside `EGRESS_RANGE_CIDR` (`10.231.0.0/16`), the range the host
 * firewall rules are provisioned for.
 */
export interface EgressNetwork {
    readonly cidr: string;
    readonly gateway: string;
    readonly proxyAddress: string;
}
/**
 * The one range an egress network may use. The host's `DOCKER-USER` drops (private ranges, the metadata
 * address) and its `INPUT` drop are provisioned for this range only (see the README host assumptions),
 * so an egress network outside it would have a route out with no drops. `validateEgress` requires
 * containment in it.
 */
export declare const EGRESS_RANGE_CIDR = "10.231.0.0/16";
/** `network create` for the internal sandbox or fetch network: no route out, no masquerade. */
export declare function createNetworkArgs(id: string, kind: "sandbox" | "fetch"): DockerArgv;
/** `network create` for the proxy's egress network: a plain bridge with a fixed subnet. */
export declare function createEgressNetworkArgs(id: string, egress: EgressNetwork): DockerArgv;
/** The capture sink: `.2` on the sandbox network, `runsc`, stdin open for the CA material. */
export declare function sinkRunArgs(id: string, image: string): DockerArgv;
export interface ProxyConfig {
    readonly image: string;
    readonly registryHost: string;
    readonly dnsServers: readonly string[];
}
/** The registry proxy, created (not started) on the fetch network at `.2`. Connect the egress network next. */
export declare function proxyCreateArgs(id: string, config: ProxyConfig): DockerArgv;
/** `network connect` the egress network to the proxy at its fixed address, before its first start. */
export declare function connectEgressArgs(id: string, egress: EgressNetwork): DockerArgv;
export interface StartOptions {
    readonly attach?: boolean;
    readonly interactive?: boolean;
}
/** `start` a created container, optionally attached and with stdin open. */
export declare function startArgs(name: string, options?: StartOptions): DockerArgv;
/** The fetch container (`.3` on the fetch network). Stage `resolve` or `download` is its only argument. */
export declare function fetchRunArgs(id: string, image: string, stage: "resolve" | "download"): DockerArgv;
/** The detonation container (`.3` on the sandbox network): the traced runtime, no env, no DNS option. */
export declare function detonationRunArgs(id: string, image: string): DockerArgv;
/**
 * The host self-check probe: `node -` reads its script from stdin. It takes the detonation container's
 * name on the sandbox network and the fetch container's name on the fetch network, so the one
 * `rm` and `network rm` cleanup path covers it.
 */
export declare function probeRunArgs(id: string, kind: "sandbox" | "fetch" | "egress", image: string, egress?: EgressNetwork): DockerArgv;
export declare function stopArgs(name: string): DockerArgv;
export declare function killArgs(name: string, signal: "SIGTERM" | "SIGKILL"): DockerArgv;
/**
 * Remove a container. `--force` makes cleanup work on a running or already-gone container. `--volumes`
 * also removes any anonymous volume an image's `VOLUME` line created, so none is left on the host disk.
 */
export declare function rmArgs(name: string): DockerArgv;
export declare function networkRmArgs(name: string): DockerArgv;
/** `inspect` one container: its full id, its state as JSON, or its networks as JSON. */
export declare function inspectArgs(name: string, view: "id" | "state" | "networks"): DockerArgv;
/** `info` printing only the daemon's architecture, such as `aarch64` or `x86_64`. */
export declare function infoArchitectureArgs(): DockerArgv;
/** `info` printing the daemon's runtimes as JSON, so the startup check can read the `runsc-trace-min` arguments. */
export declare function infoRuntimesArgs(): DockerArgv;
export {};
//# sourceMappingURL=docker-args.d.ts.map