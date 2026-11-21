/**
 * Where everything sits inside the detonation image and container. One place, so the Dockerfile test, the
 * marker renderer, the entrypoint and the VM test all read the same paths.
 *
 * This file imports nothing: it is compiled into the image and must pull in no other module. A test checks
 * the paths against `image-spec.ts` (which only the build side imports).
 */
/** The marker scripts. The trace normaliser tells install from load by the first exec of a child of init. */
export declare const INSTALL_EXEC = "/opt/runner/install";
export declare const LOAD_EXEC = "/opt/runner/load";
/** Our compiled files, as `image-spec.ts` places them under `/opt/runner/lib/sandbox/`. */
export declare const COMPILED_ROOT = "/opt/runner/lib/sandbox/images/detonation";
export declare const HARNESS_PATH = "/opt/runner/lib/sandbox/images/detonation/harness-main.js";
export declare const RELAY_PATH = "/opt/runner/lib/sandbox/images/detonation/relay-main.js";
/** The CA roots copied from the base image at build time. Read-only. Init appends the per-scan CA to it. */
export declare const ROOTS_PATH = "/opt/runner/roots.pem";
/** The bundle init writes (a tmpfs) and every child trusts through `NODE_EXTRA_CA_CERTS`. */
export declare const CERTS_BUNDLE = "/etc/ssl/certs/ca-certificates.crt";
export declare const HOME_ROOT = "/home/runner";
/** Projects live under here (the tmpfs the container mounts for them). */
export declare const WORK_ROOT = "/home/runner/work";
/** npm's cache. The cache part of the delivery stream is extracted here. On the 512 MiB project tmpfs. */
export declare const CACHE_DIR = "/home/runner/work/_temp/npm-cache";
/** Init's own files inside the home part. Removed before install starts. */
export declare const INIT_DIR = ".init";
export declare const CONTROL_FILE = "control.json";
export declare const CA_FILE = "ca.pem";
export declare const NODE_PATH = "/usr/local/bin/node";
export declare const NPM_PATH = "/usr/local/bin/npm";
export declare const SLEEP_PATH = "/bin/sleep";
/** Read-only directories only: nothing the package can write to is on it. */
export declare const CHILD_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
/** The address the container's resolver is pointed at (Docker's embedded DNS slot), served by the relay. */
export declare const RELAY_LISTEN_ADDRESS = "127.0.0.11";
export declare const DNS_PORT = 53;
/** The relay's first line on stdout, printed after both sockets are bound. */
export declare const RELAY_READY_LINE = "ready";
/** How long init waits for the relay before it gives up (and starts neither marker). */
export declare const RELAY_READY_TIMEOUT_MS = 5000;
//# sourceMappingURL=layout.d.ts.map