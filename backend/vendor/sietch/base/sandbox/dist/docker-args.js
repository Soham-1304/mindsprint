import { SietchError } from "@sietch/core";
import { DETONATION_LIMITS, FETCH_LIMITS, PROXY_LIMITS, SINK_LIMITS, TMPFS_FETCH_BYTES, TMPFS_HOME_BYTES, TMPFS_PROJECT_BYTES, TMPFS_SERVICE_BYTES, TMPFS_TMP_BYTES, } from "./limits.js";
import { deriveNames, deriveSubnets, InvalidScanIdError, RESOURCE_PREFIX, } from "./scan-id.js";
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
export class DockerArgsError extends SietchError {
    constructor(message, options) {
        super("DOCKER_ARGS_INVALID", message, options);
    }
}
// --- Constants ------------------------------------------------------------------------------------
export const RUNTIME_PLAIN = "runsc";
export const RUNTIME_TRACED = "runsc-trace-min";
export const CONTAINER_USER = "1000:1000";
export const PROXY_PORT = 3128;
/** Environment variable names the proxy image (Task 10) reads. */
export const PROXY_ENV = { registryHost: "REGISTRY_HOST", dnsServers: "DNS_SERVERS" };
const FETCH_PROXY_ENV_NAME = "npm_config_https_proxy";
const MASQUERADE_OPTION = "com.docker.network.bridge.enable_ip_masquerade=false";
const PROBE_ENTRYPOINT = "node";
const MAX_DNS_SERVERS = 4;
const MAX_IMAGE_REF_LENGTH = 200;
const MAX_HOST_LENGTH = 253;
const MAX_ARGV_TOKENS = 64;
const MAX_TOKEN_LENGTH = 300;
const MIB = 1024 * 1024;
/** The /etc/ssl/certs tmpfs for the detonation container (spike 4: init writes the CA bundle here). */
const CERTS_TMPFS_OPTIONS = "rw,nosuid,nodev,uid=1000,gid=1000,mode=0755,size=4m";
/** The hosted tool cache directory the CI profile uses. Empty and small. */
const TMPFS_TOOLCACHE_BYTES = 16 * MIB;
function tmpfsOptions(bytes, exec, mode) {
    return `rw,nosuid,nodev,${exec ? "exec" : "noexec"},size=${bytes},uid=1000,gid=1000,mode=${mode}`;
}
/** `noexec` /tmp for the sink, the proxy, and the probe. */
const SERVICE_TMPFS = [
    { path: "/tmp", options: tmpfsOptions(TMPFS_SERVICE_BYTES, false, "1777") },
];
/** Fetch runs npm, which executes lifecycle-free tooling from its cache, so its /tmp is `exec`. */
const FETCH_TMPFS = [
    { path: "/tmp", options: tmpfsOptions(TMPFS_FETCH_BYTES, true, "1777") },
];
/** Order matters: Docker mounts a parent before its child. */
const DETONATION_TMPFS = [
    { path: "/tmp", options: tmpfsOptions(TMPFS_TMP_BYTES, true, "1777") },
    { path: "/home/runner", options: tmpfsOptions(TMPFS_HOME_BYTES, true, "0755") },
    { path: "/home/runner/work", options: tmpfsOptions(TMPFS_PROJECT_BYTES, true, "0755") },
    { path: "/opt/hostedtoolcache", options: tmpfsOptions(TMPFS_TOOLCACHE_BYTES, true, "0755") },
    { path: "/etc/ssl/certs", options: CERTS_TMPFS_OPTIONS },
];
/** The detonation container's tmpfs targets, in mount order. The CI profile's fixed paths must sit under these. */
export const DETONATION_TMPFS_PATHS = DETONATION_TMPFS.map((mount) => mount.path);
const ALLOWED_TMPFS_VALUES = new Set([...SERVICE_TMPFS, ...FETCH_TMPFS, ...DETONATION_TMPFS].map((mount) => `${mount.path}:${mount.options}`));
// --- Validators -----------------------------------------------------------------------------------
const IMAGE_REF_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*@sha256:[0-9a-f]{64}$/;
const OCTET_PATTERN = /^(?:0|[1-9]\d{0,2})$/;
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** A digest-pinned image reference. No tag-only form, so it can't look like a flag or float to a new image. */
export function isImageRef(value) {
    return typeof value === "string" && value.length <= MAX_IMAGE_REF_LENGTH && IMAGE_REF_PATTERN.test(value);
}
function parseIPv4(value) {
    if (typeof value !== "string" || value.length > 15)
        return null;
    const parts = value.split(".");
    if (parts.length !== 4)
        return null;
    let result = 0;
    for (const part of parts) {
        if (!OCTET_PATTERN.test(part))
            return null;
        const octet = Number(part);
        if (octet > 255)
            return null;
        result = result * 256 + octet;
    }
    return result;
}
function formatIPv4(value) {
    return [
        Math.floor(value / 2 ** 24) % 256,
        Math.floor(value / 2 ** 16) % 256,
        Math.floor(value / 256) % 256,
        value % 256,
    ].join(".");
}
/** Strict dotted-quad IPv4: four decimal octets 0-255, no leading zeros, no whitespace. */
export function isIPv4(value) {
    return parseIPv4(value) !== null;
}
function parseCidr(value) {
    if (typeof value !== "string" || value.length > 18)
        return null;
    const slash = value.indexOf("/");
    if (slash < 0)
        return null;
    const base = parseIPv4(value.slice(0, slash));
    const prefixText = value.slice(slash + 1);
    if (base === null || !/^(?:0|[1-9]\d?)$/.test(prefixText))
        return null;
    const prefix = Number(prefixText);
    if (prefix > 32)
        return null;
    const size = 2 ** (32 - prefix);
    // The address must be the network address (host bits zero).
    if (base % size !== 0)
        return null;
    return { base, prefix, size };
}
/** Strict IPv4 CIDR with the host bits zero, such as `10.240.0.0/28`. */
export function isCidr(value) {
    return parseCidr(value) !== null;
}
function cidrContains(cidr, address) {
    return address >= cidr.base && address < cidr.base + cidr.size;
}
/** A lowercase DNS host name (letters, digits, hyphens, dots), such as `registry.npmjs.org`. */
export function isRegistryHost(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_HOST_LENGTH)
        return false;
    return value.split(".").every((label) => HOST_LABEL_PATTERN.test(label));
}
/** One to four IPv4 addresses. */
export function isDnsServerList(value) {
    return Array.isArray(value) && value.length >= 1 && value.length <= MAX_DNS_SERVERS && value.every(isIPv4);
}
const CONTAINER_NAME_PATTERN = new RegExp(`^${RESOURCE_PREFIX}-[0-9a-f]{24}-(?:fetch|proxy|sink|det)$`);
const NETWORK_NAME_PATTERN = new RegExp(`^${RESOURCE_PREFIX}-[0-9a-f]{24}-net-(?:sandbox|fetch|egress)$`);
function isContainerName(value) {
    return typeof value === "string" && CONTAINER_NAME_PATTERN.test(value);
}
function isNetworkName(value) {
    return typeof value === "string" && NETWORK_NAME_PATTERN.test(value);
}
// --- Allowlist checker ----------------------------------------------------------------------------
const SUBCOMMANDS = new Set([
    "run",
    "create",
    "start",
    "stop",
    "kill",
    "rm",
    "inspect",
    "info",
    "network",
]);
const NETWORK_SUBCOMMANDS = new Set(["create", "connect", "rm"]);
const BOOLEAN_FLAGS = new Set([
    "-i",
    "--interactive",
    "--attach",
    "--internal",
    "--read-only",
    "--force",
    "--volumes",
]);
const ALL_LIMITS = [DETONATION_LIMITS, FETCH_LIMITS, SINK_LIMITS, PROXY_LIMITS];
/** The largest value any builder emits. The guard refuses a larger one, so a hand-built vector can't raise a limit. */
const MAX_PIDS = Math.max(...ALL_LIMITS.map((limits) => limits.pids));
const MAX_MEMORY_BYTES = Math.max(...ALL_LIMITS.map((limits) => limits.memoryBytes));
const MAX_CPUS = Math.max(...ALL_LIMITS.map((limits) => limits.cpus));
const FORMATS = new Set([
    "{{.Architecture}}",
    "{{.Id}}",
    "{{json .State}}",
    "{{json .NetworkSettings.Networks}}",
    "{{json .Runtimes}}",
]);
const STAGES = new Set(["resolve", "download"]);
const SIGNALS = new Set(["SIGTERM", "SIGKILL"]);
function isEnvValue(value) {
    const equals = value.indexOf("=");
    if (equals < 0)
        return false;
    const name = value.slice(0, equals);
    const text = value.slice(equals + 1);
    if (name === FETCH_PROXY_ENV_NAME) {
        const match = /^http:\/\/([0-9.]+):(\d+)$/.exec(text);
        return match !== null && isIPv4(match[1]) && match[2] === String(PROXY_PORT);
    }
    if (name === PROXY_ENV.registryHost)
        return isRegistryHost(text);
    if (name === PROXY_ENV.dnsServers)
        return isDnsServerList(text.split(","));
    return false;
}
function oneOf(allowed) {
    return (value) => allowed.has(value);
}
function exactly(expected) {
    return (value) => value === expected;
}
/** A number written in the pattern's form that does not exceed the largest limit any builder uses. */
function atMost(pattern, max) {
    return (value) => pattern.test(value) && Number(value) <= max;
}
/** Every `--name=value` option the builders use, with the check its value must pass. */
const OPTION_VALIDATORS = new Map([
    ["--name", isContainerName],
    ["--runtime", (value) => value === RUNTIME_PLAIN || value === RUNTIME_TRACED],
    ["--network", isNetworkName],
    ["--ip", isIPv4],
    ["--user", exactly(CONTAINER_USER)],
    ["--cap-drop", exactly("ALL")],
    ["--security-opt", exactly("no-new-privileges")],
    ["--pids-limit", atMost(/^[1-9]\d{0,5}$/, MAX_PIDS)],
    ["--memory", atMost(/^[1-9]\d{0,12}$/, MAX_MEMORY_BYTES)],
    ["--memory-swap", atMost(/^[1-9]\d{0,12}$/, MAX_MEMORY_BYTES)],
    ["--cpus", atMost(/^(?:0\.[1-9]\d?|[1-9]\d?(?:\.\d{1,2})?)$/, MAX_CPUS)],
    ["--log-driver", exactly("none")],
    ["--tmpfs", oneOf(ALLOWED_TMPFS_VALUES)],
    ["--env", isEnvValue],
    ["--entrypoint", exactly(PROBE_ENTRYPOINT)],
    ["--driver", exactly("bridge")],
    ["--subnet", isCidr],
    ["--gateway", isIPv4],
    ["--opt", exactly(MASQUERADE_OPTION)],
    ["--format", oneOf(FORMATS)],
    ["--signal", oneOf(SIGNALS)],
]);
/** Options that may repeat. Every other option may appear once. */
const REPEATABLE_OPTIONS = new Set(["--tmpfs", "--env"]);
const SCAN_ID_IN_NAME = new RegExp(`^${RESOURCE_PREFIX}-([0-9a-f]{24})-`);
function scanIdOf(name) {
    return SCAN_ID_IN_NAME.exec(name)?.[1] ?? null;
}
/** The block `hardening()` emits. Every `run` and `create` must carry all of it. */
const HARDENING_OPTIONS = [
    "--name",
    "--runtime",
    "--network",
    "--ip",
    "--read-only",
    "--user",
    "--cap-drop",
    "--security-opt",
    "--pids-limit",
    "--memory",
    "--memory-swap",
    "--cpus",
    "--log-driver",
    "--tmpfs",
];
const isStageOrDash = (value) => value === "-" || STAGES.has(value);
function containerExtra(options, positionals) {
    const first = (name) => options.get(name)?.[0];
    if (first("--memory") !== first("--memory-swap"))
        return "--memory-swap must equal --memory";
    const name = first("--name");
    const network = first("--network");
    if (name === undefined || network === undefined || scanIdOf(name) !== scanIdOf(network)) {
        return "the container and its network belong to different scans";
    }
    // The egress network has a route out, so only the proxy (or the egress self-check probe in its name) joins it.
    if (network.endsWith("-net-egress") && !name.endsWith("-proxy")) {
        return "only the proxy may join the egress network";
    }
    if (first("--runtime") === RUNTIME_TRACED && (options.has("--env") || options.has("--entrypoint"))) {
        return "the traced runtime takes no environment or entrypoint";
    }
    // A fetch stage goes only to the fetch container, and the fetch container (when it is not the probe) needs one.
    const stage = positionals[1];
    const isFetchStage = stage !== undefined && stage !== "-";
    if (isFetchStage !== (name.endsWith("-fetch") && !options.has("--entrypoint"))) {
        return "a fetch stage goes with the fetch container and only with it";
    }
    // The `-` argument means "read the script from stdin", which needs the node entrypoint, and only that.
    if ((positionals[1] === "-") !== options.has("--entrypoint")) {
        return "the entrypoint option and the stdin argument go together";
    }
    return null;
}
function networkCreateExtra(options, positionals) {
    const egress = (positionals[0] ?? "").endsWith("-net-egress");
    const internal = options.has("--internal");
    const masquerade = options.has("--opt");
    if (egress)
        return internal || masquerade ? "the egress network must not be internal" : null;
    return internal && masquerade ? null : "a scan network must be internal with masquerade off";
}
function networkConnectExtra(_options, positionals) {
    const [network = "", container = ""] = positionals;
    if (!network.endsWith("-net-egress") || !container.endsWith("-proxy")) {
        return "only the proxy may be connected, and only to the egress network";
    }
    return scanIdOf(network) === scanIdOf(container)
        ? null
        : "the container and network belong to different scans";
}
const CONTAINER_ARG = [isContainerName];
const NO_OPTIONS = new Set();
const COMMANDS = new Map([
    [
        "run",
        {
            options: new Set([...HARDENING_OPTIONS, "-i", "--env", "--entrypoint"]),
            required: [...HARDENING_OPTIONS, "-i"],
            positionals: [isImageRef, isStageOrDash],
            minPositionals: 1,
            extra: containerExtra,
        },
    ],
    [
        "create",
        {
            options: new Set([...HARDENING_OPTIONS, "--env"]),
            required: HARDENING_OPTIONS,
            positionals: [isImageRef],
            minPositionals: 1,
            extra: containerExtra,
        },
    ],
    [
        "start",
        {
            options: new Set(["--attach", "--interactive"]),
            required: [],
            positionals: CONTAINER_ARG,
            minPositionals: 1,
        },
    ],
    ["stop", { options: NO_OPTIONS, required: [], positionals: CONTAINER_ARG, minPositionals: 1 }],
    [
        "kill",
        { options: new Set(["--signal"]), required: ["--signal"], positionals: CONTAINER_ARG, minPositionals: 1 },
    ],
    [
        "rm",
        {
            options: new Set(["--force", "--volumes"]),
            required: ["--force", "--volumes"],
            positionals: CONTAINER_ARG,
            minPositionals: 1,
        },
    ],
    [
        "inspect",
        { options: new Set(["--format"]), required: ["--format"], positionals: CONTAINER_ARG, minPositionals: 1 },
    ],
    ["info", { options: new Set(["--format"]), required: ["--format"], positionals: [], minPositionals: 0 }],
    [
        "network create",
        {
            options: new Set(["--driver", "--subnet", "--gateway", "--internal", "--opt"]),
            required: ["--driver", "--subnet", "--gateway"],
            positionals: [isNetworkName],
            minPositionals: 1,
            extra: networkCreateExtra,
        },
    ],
    [
        "network connect",
        {
            options: new Set(["--ip"]),
            required: ["--ip"],
            positionals: [isNetworkName, isContainerName],
            minPositionals: 2,
            extra: networkConnectExtra,
        },
    ],
    ["network rm", { options: NO_OPTIONS, required: [], positionals: [isNetworkName], minPositionals: 1 }],
]);
/**
 * Returns a reason (a fixed label and a token index, never the token text) for the first token that is
 * not on the allowlist, or null when the whole argument vector is allowed.
 */
export function findUnsafeArg(argv) {
    if (!Array.isArray(argv))
        return "argument vector is not an array";
    if (argv.length === 0)
        return "argument vector is empty";
    if (argv.length > MAX_ARGV_TOKENS)
        return "argument vector is too long";
    const tokens = argv;
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (typeof token !== "string")
            return `token ${index} is not a string`;
        if (token.length === 0)
            return `token ${index} is empty`;
        if (token.length > MAX_TOKEN_LENGTH)
            return `token ${index} is too long`;
    }
    const words = tokens;
    const first = words[0];
    if (!SUBCOMMANDS.has(first))
        return "token 0 is not an allowed subcommand";
    let command = first;
    let start = 1;
    if (first === "network") {
        const second = words[1];
        if (second === undefined || !NETWORK_SUBCOMMANDS.has(second)) {
            return "token 1 is not an allowed network subcommand";
        }
        command = `network ${second}`;
        start = 2;
    }
    const spec = COMMANDS.get(command);
    if (spec === undefined)
        return "token 0 is not an allowed subcommand";
    const options = new Map();
    const positionals = [];
    for (let index = start; index < words.length; index += 1) {
        const token = words[index];
        if (token.startsWith("-") && token !== "-") {
            if (positionals.length > 0)
                return `token ${index} is an option after an argument`;
            let name = token;
            let value = "";
            if (!BOOLEAN_FLAGS.has(token)) {
                const equals = token.indexOf("=");
                if (!token.startsWith("--") || equals < 0)
                    return `token ${index} is not an allowed option`;
                name = token.slice(0, equals);
                value = token.slice(equals + 1);
                const validate = OPTION_VALIDATORS.get(name);
                if (validate === undefined)
                    return `token ${index} is not an allowed option`;
                if (!validate(value))
                    return `token ${index} has a value that is not allowed`;
            }
            if (!spec.options.has(name))
                return `token ${index} is not allowed for this subcommand`;
            const values = options.get(name);
            if (values === undefined)
                options.set(name, [value]);
            else if (REPEATABLE_OPTIONS.has(name))
                values.push(value);
            else
                return `token ${index} repeats an option`;
            continue;
        }
        const check = spec.positionals[positionals.length];
        if (check === undefined)
            return `token ${index} is one argument too many`;
        if (!check(token))
            return `token ${index} is not an allowed argument`;
        positionals.push(token);
    }
    for (const required of spec.required) {
        if (!options.has(required))
            return `the required option ${required} is missing`;
    }
    if (positionals.length < spec.minPositionals)
        return "a required argument is missing";
    return spec.extra?.(options, positionals) ?? null;
}
/** Returns the vector as a `DockerArgv` or throws `DockerArgsError`. The message never contains a token. */
export function assertSafeArgv(argv) {
    const reason = findUnsafeArg(argv);
    if (reason !== null)
        throw new DockerArgsError(`unsafe docker arguments: ${reason}`);
    return argv;
}
function finish(argv) {
    return assertSafeArgv(Object.freeze([...argv]));
}
// --- Input validation -----------------------------------------------------------------------------
function derive(id) {
    try {
        return { names: deriveNames(id), subnets: deriveSubnets(id) };
    }
    catch (error) {
        if (error instanceof InvalidScanIdError)
            throw new DockerArgsError("invalid scan id", { cause: error });
        throw error;
    }
}
function requireImage(image) {
    if (!isImageRef(image))
        throw new DockerArgsError("image must be a digest-pinned reference");
    return image;
}
function requireContainerName(name) {
    if (!isContainerName(name))
        throw new DockerArgsError("invalid container name");
    return name;
}
function requireNetworkName(name) {
    if (!isNetworkName(name))
        throw new DockerArgsError("invalid network name");
    return name;
}
/** The address of the single client (the detonation or fetch container): the service address plus one. */
function clientAddress(subnet) {
    const cidr = parseCidr(subnet.cidr);
    const service = parseIPv4(subnet.serviceAddress);
    if (cidr === null || service === null)
        throw new DockerArgsError("invalid subnet");
    const client = service + 1;
    if (!cidrContains(cidr, client))
        throw new DockerArgsError("client address is outside its subnet");
    return formatIPv4(client);
}
const SCAN_RANGE = { base: 10 * 2 ** 24 + 240 * 2 ** 16, prefix: 12, size: 2 ** 20 };
/**
 * The one range an egress network may use. The host's `DOCKER-USER` drops (private ranges, the metadata
 * address) and its `INPUT` drop are provisioned for this range only (see the README host assumptions),
 * so an egress network outside it would have a route out with no drops. `validateEgress` requires
 * containment in it.
 */
export const EGRESS_RANGE_CIDR = "10.231.0.0/16";
const EGRESS_RANGE = { base: 10 * 2 ** 24 + 231 * 2 ** 16, prefix: 16, size: 2 ** 16 };
/**
 * Ranges an egress network must not overlap, because they are the host's own networks: 192.168.5.0/24 is
 * the Colima (Lima) VM and its gateway, which forwards to the Mac, and 172.17.0.0/16 is Docker's default
 * bridge. An egress bridge on either would shadow a host address or sit beside the default bridge.
 */
const HOST_RESERVED_RANGES = [
    { base: 192 * 2 ** 24 + 168 * 2 ** 16 + 5 * 2 ** 8, prefix: 24, size: 2 ** 8 },
    { base: 172 * 2 ** 24 + 17 * 2 ** 16, prefix: 16, size: 2 ** 16 },
];
function overlaps(a, b) {
    return a.base < b.base + b.size && b.base < a.base + a.size;
}
function containsCidr(outer, inner) {
    return inner.base >= outer.base && inner.base + inner.size <= outer.base + outer.size;
}
function validateEgress(egress) {
    if (typeof egress !== "object" || egress === null)
        throw new DockerArgsError("invalid egress network");
    const { cidr, gateway, proxyAddress } = egress;
    const parsed = parseCidr(cidr);
    const gatewayValue = parseIPv4(gateway);
    const proxyValue = parseIPv4(proxyAddress);
    if (parsed === null || gatewayValue === null || proxyValue === null) {
        throw new DockerArgsError("invalid egress network");
    }
    if (!cidrContains(parsed, gatewayValue) ||
        !cidrContains(parsed, proxyValue) ||
        gatewayValue === proxyValue) {
        throw new DockerArgsError("egress addresses must be distinct and inside the egress subnet");
    }
    if (overlaps(parsed, SCAN_RANGE))
        throw new DockerArgsError("egress subnet overlaps the per-scan range");
    if (HOST_RESERVED_RANGES.some((range) => overlaps(parsed, range))) {
        throw new DockerArgsError("egress subnet overlaps a host network (192.168.5.0/24 or 172.17.0.0/16)");
    }
    // Inside the provisioned range only. This also excludes loopback, link-local (the metadata address),
    // and public addresses, which would otherwise shadow that address on the proxy's bridge.
    if (!containsCidr(EGRESS_RANGE, parsed)) {
        throw new DockerArgsError(`egress subnet must be inside ${EGRESS_RANGE_CIDR}`);
    }
    return { cidr: cidr, gateway: gateway, proxyAddress: proxyAddress };
}
/** The block every `run` and `create` shares, in a fixed order. */
function hardening(config) {
    return [
        `--name=${config.name}`,
        `--runtime=${config.runtime}`,
        `--network=${config.network}`,
        `--ip=${config.ip}`,
        "--read-only",
        `--user=${CONTAINER_USER}`,
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        `--pids-limit=${config.limits.pids}`,
        `--memory=${config.limits.memoryBytes}`,
        // Equal to --memory: no swap, so a memory bomb can't run at twice its limit.
        `--memory-swap=${config.limits.memoryBytes}`,
        `--cpus=${config.limits.cpus}`,
        "--log-driver=none",
        ...config.tmpfs.map((mount) => `--tmpfs=${mount.path}:${mount.options}`),
    ];
}
/** `network create` for the internal sandbox or fetch network: no route out, no masquerade. */
export function createNetworkArgs(id, kind) {
    if (kind !== "sandbox" && kind !== "fetch")
        throw new DockerArgsError("invalid network kind");
    const { names, subnets } = derive(id);
    const subnet = subnets[kind];
    return finish([
        "network",
        "create",
        "--driver=bridge",
        "--internal",
        `--subnet=${subnet.cidr}`,
        `--gateway=${subnet.gateway}`,
        `--opt=${MASQUERADE_OPTION}`,
        names.networks[kind],
    ]);
}
/** `network create` for the proxy's egress network: a plain bridge with a fixed subnet. */
export function createEgressNetworkArgs(id, egress) {
    const { names } = derive(id);
    const checked = validateEgress(egress);
    return finish([
        "network",
        "create",
        "--driver=bridge",
        `--subnet=${checked.cidr}`,
        `--gateway=${checked.gateway}`,
        names.networks.egress,
    ]);
}
/** The capture sink: `.2` on the sandbox network, `runsc`, stdin open for the CA material. */
export function sinkRunArgs(id, image) {
    const { names, subnets } = derive(id);
    return finish([
        "run",
        "-i",
        ...hardening({
            name: names.containers.sink,
            runtime: RUNTIME_PLAIN,
            network: names.networks.sandbox,
            ip: subnets.sandbox.serviceAddress,
            limits: SINK_LIMITS,
            tmpfs: SERVICE_TMPFS,
        }),
        requireImage(image),
    ]);
}
/** The registry proxy, created (not started) on the fetch network at `.2`. Connect the egress network next. */
export function proxyCreateArgs(id, config) {
    const { names, subnets } = derive(id);
    if (typeof config !== "object" || config === null)
        throw new DockerArgsError("invalid proxy configuration");
    const image = requireImage(config.image);
    if (!isRegistryHost(config.registryHost))
        throw new DockerArgsError("invalid registry host");
    if (!isDnsServerList(config.dnsServers))
        throw new DockerArgsError("invalid DNS server list");
    return finish([
        "create",
        ...hardening({
            name: names.containers.proxy,
            runtime: RUNTIME_PLAIN,
            network: names.networks.fetch,
            ip: subnets.fetch.serviceAddress,
            limits: PROXY_LIMITS,
            tmpfs: SERVICE_TMPFS,
        }),
        `--env=${PROXY_ENV.registryHost}=${config.registryHost}`,
        `--env=${PROXY_ENV.dnsServers}=${config.dnsServers.join(",")}`,
        image,
    ]);
}
/** `network connect` the egress network to the proxy at its fixed address, before its first start. */
export function connectEgressArgs(id, egress) {
    const { names } = derive(id);
    const checked = validateEgress(egress);
    return finish([
        "network",
        "connect",
        `--ip=${checked.proxyAddress}`,
        names.networks.egress,
        names.containers.proxy,
    ]);
}
/** `start` a created container, optionally attached and with stdin open. */
export function startArgs(name, options = {}) {
    return finish([
        "start",
        ...(options.attach === true ? ["--attach"] : []),
        ...(options.interactive === true ? ["--interactive"] : []),
        requireContainerName(name),
    ]);
}
/** The fetch container (`.3` on the fetch network). Stage `resolve` or `download` is its only argument. */
export function fetchRunArgs(id, image, stage) {
    if (stage !== "resolve" && stage !== "download")
        throw new DockerArgsError("invalid fetch stage");
    const { names, subnets } = derive(id);
    return finish([
        "run",
        "-i",
        ...hardening({
            name: names.containers.fetch,
            runtime: RUNTIME_PLAIN,
            network: names.networks.fetch,
            ip: clientAddress(subnets.fetch),
            limits: FETCH_LIMITS,
            tmpfs: FETCH_TMPFS,
        }),
        `--env=${FETCH_PROXY_ENV_NAME}=http://${subnets.fetch.serviceAddress}:${PROXY_PORT}`,
        requireImage(image),
        stage,
    ]);
}
/** The detonation container (`.3` on the sandbox network): the traced runtime, no env, no DNS option. */
export function detonationRunArgs(id, image) {
    const { names, subnets } = derive(id);
    return finish([
        "run",
        "-i",
        ...hardening({
            name: names.containers.detonation,
            runtime: RUNTIME_TRACED,
            network: names.networks.sandbox,
            ip: clientAddress(subnets.sandbox),
            limits: DETONATION_LIMITS,
            tmpfs: DETONATION_TMPFS,
        }),
        requireImage(image),
    ]);
}
/**
 * The host self-check probe: `node -` reads its script from stdin. It takes the detonation container's
 * name on the sandbox network and the fetch container's name on the fetch network, so the one
 * `rm` and `network rm` cleanup path covers it.
 */
export function probeRunArgs(id, kind, image, egress) {
    if (kind !== "sandbox" && kind !== "fetch" && kind !== "egress") {
        throw new DockerArgsError("invalid network kind");
    }
    const { names, subnets } = derive(id);
    // The egress probe takes the proxy's name and its address on the egress network, so the same cleanup
    // path covers it. The proxy itself is never started in a self-check.
    const placement = kind === "egress"
        ? { name: names.containers.proxy, ip: validateEgress(egress).proxyAddress }
        : {
            name: kind === "sandbox" ? names.containers.detonation : names.containers.fetch,
            ip: clientAddress(subnets[kind]),
        };
    return finish([
        "run",
        "-i",
        ...hardening({
            name: placement.name,
            runtime: RUNTIME_PLAIN,
            network: names.networks[kind],
            ip: placement.ip,
            limits: PROXY_LIMITS,
            tmpfs: SERVICE_TMPFS,
        }),
        `--entrypoint=${PROBE_ENTRYPOINT}`,
        requireImage(image),
        "-",
    ]);
}
export function stopArgs(name) {
    return finish(["stop", requireContainerName(name)]);
}
export function killArgs(name, signal) {
    if (signal !== "SIGTERM" && signal !== "SIGKILL")
        throw new DockerArgsError("invalid signal");
    return finish(["kill", `--signal=${signal}`, requireContainerName(name)]);
}
/**
 * Remove a container. `--force` makes cleanup work on a running or already-gone container. `--volumes`
 * also removes any anonymous volume an image's `VOLUME` line created, so none is left on the host disk.
 */
export function rmArgs(name) {
    return finish(["rm", "--force", "--volumes", requireContainerName(name)]);
}
export function networkRmArgs(name) {
    return finish(["network", "rm", requireNetworkName(name)]);
}
const INSPECT_FORMATS = {
    id: "{{.Id}}",
    state: "{{json .State}}",
    networks: "{{json .NetworkSettings.Networks}}",
};
/** `inspect` one container: its full id, its state as JSON, or its networks as JSON. */
export function inspectArgs(name, view) {
    const format = Object.hasOwn(INSPECT_FORMATS, view) ? INSPECT_FORMATS[view] : undefined;
    if (format === undefined)
        throw new DockerArgsError("invalid inspect view");
    return finish(["inspect", `--format=${format}`, requireContainerName(name)]);
}
/** `info` printing only the daemon's architecture, such as `aarch64` or `x86_64`. */
export function infoArchitectureArgs() {
    return finish(["info", "--format={{.Architecture}}"]);
}
/** `info` printing the daemon's runtimes as JSON, so the startup check can read the `runsc-trace-min` arguments. */
export function infoRuntimesArgs() {
    return finish(["info", "--format={{json .Runtimes}}"]);
}
//# sourceMappingURL=docker-args.js.map