import { FETCH_CACHE_DIR, FETCH_CHILD_PATH, FETCH_EMPTY_GLOBAL_NPMRC, FETCH_EMPTY_USER_NPMRC, FETCH_HOME_DIR, } from "./limits.js";
/**
 * The npm command lines and environment of the two fetch stages. Pure.
 *
 * No argument carries the package name or version: both go into a synthetic `package.json`
 * (`buildPackageJson`) that npm reads from the project directory. So no value from a scan request is
 * ever a command-line token, and npm can't read one as an option or a `name@spec`. If a package spec
 * were ever added to an argument list, it would have to follow `--` (`SPEC_SEPARATOR`); a test pins both
 * facts.
 *
 * Both stages pass `--ignore-scripts` (nothing from a package runs in the fetch container) and the three
 * `--allow-*=none` flags, so a git, file or directory dependency that slipped past the host's lockfile
 * check still can't be fetched here. npm 11.19.1 accepts all of them (spike 5).
 */
/** The end-of-options marker. Any package spec on a command line must come after it. */
export const SPEC_SEPARATOR = "--";
const SAFE_FLAGS = [
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--no-progress",
    "--allow-git=none",
    "--allow-file=none",
    "--allow-directory=none",
];
/** Stage 1: write `package-lock.json` for the one requested package without installing anything. */
export function resolveArgv(cacheDir = FETCH_CACHE_DIR) {
    return ["install", "--package-lock-only", ...SAFE_FLAGS, "--cache", cacheDir];
}
/** Stage 2: install exactly what the (host-checked) lockfile says, so the cache holds every tarball. */
export function downloadArgv(cacheDir = FETCH_CACHE_DIR) {
    return ["ci", ...SAFE_FLAGS, "--cache", cacheDir];
}
/**
 * The whole environment npm gets: a fixed `PATH` of read-only directories, `HOME`, the proxy, the
 * registry, an empty user and global config (no token), and no update check. Nothing of the
 * container's own environment (`NODE_VERSION`, `YARN_VERSION`) is forwarded.
 */
export function npmEnv(input) {
    return {
        PATH: FETCH_CHILD_PATH,
        HOME: FETCH_HOME_DIR,
        npm_config_https_proxy: input.proxyUrl,
        npm_config_registry: `https://${input.registryHost}/`,
        npm_config_userconfig: FETCH_EMPTY_USER_NPMRC,
        npm_config_globalconfig: FETCH_EMPTY_GLOBAL_NPMRC,
        npm_config_update_notifier: "false",
    };
}
//# sourceMappingURL=npm-argv.js.map