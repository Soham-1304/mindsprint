/**
 * Where everything sits inside the detonation image and container. One place, so the Dockerfile test, the
 * marker renderer, the entrypoint and the VM test all read the same paths.
 *
 * This file imports nothing: it is compiled into the image and must pull in no other module. A test checks
 * the paths against `image-spec.ts` (which only the build side imports).
 */
/** The marker scripts. The trace normaliser tells install from load by the first exec of a child of init. */
export const INSTALL_EXEC = "/opt/runner/install";
export const LOAD_EXEC = "/opt/runner/load";
/** Our compiled files, as `image-spec.ts` places them under `/opt/runner/lib/sandbox/`. */
export const COMPILED_ROOT = "/opt/runner/lib/sandbox/images/detonation";
export const HARNESS_PATH = `${COMPILED_ROOT}/harness-main.js`;
export const RELAY_PATH = `${COMPILED_ROOT}/relay-main.js`;
/** The CA roots copied from the base image at build time. Read-only. Init appends the per-scan CA to it. */
export const ROOTS_PATH = "/opt/runner/roots.pem";
/** The bundle init writes (a tmpfs) and every child trusts through `NODE_EXTRA_CA_CERTS`. */
export const CERTS_BUNDLE = "/etc/ssl/certs/ca-certificates.crt";
export const HOME_ROOT = "/home/runner";
/** Projects live under here (the tmpfs the container mounts for them). */
export const WORK_ROOT = "/home/runner/work";
/** npm's cache. The cache part of the delivery stream is extracted here. On the 512 MiB project tmpfs. */
export const CACHE_DIR = "/home/runner/work/_temp/npm-cache";
/** Init's own files inside the home part. Removed before install starts. */
export const INIT_DIR = ".init";
export const CONTROL_FILE = "control.json";
export const CA_FILE = "ca.pem";
export const NODE_PATH = "/usr/local/bin/node";
export const NPM_PATH = "/usr/local/bin/npm";
export const SLEEP_PATH = "/bin/sleep";
/** Read-only directories only: nothing the package can write to is on it. */
export const CHILD_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
/** The address the container's resolver is pointed at (Docker's embedded DNS slot), served by the relay. */
export const RELAY_LISTEN_ADDRESS = "127.0.0.11";
export const DNS_PORT = 53;
/** The relay's first line on stdout, printed after both sockets are bound. */
export const RELAY_READY_LINE = "ready";
/** How long init waits for the relay before it gives up (and starts neither marker). */
export const RELAY_READY_TIMEOUT_MS = 5_000;
//# sourceMappingURL=layout.js.map