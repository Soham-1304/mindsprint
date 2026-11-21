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
export declare const SPEC_SEPARATOR = "--";
/** Stage 1: write `package-lock.json` for the one requested package without installing anything. */
export declare function resolveArgv(cacheDir?: string): readonly string[];
/** Stage 2: install exactly what the (host-checked) lockfile says, so the cache holds every tarball. */
export declare function downloadArgv(cacheDir?: string): readonly string[];
export interface NpmEnvInput {
    /** The value of `npm_config_https_proxy` the container was started with, already validated. */
    readonly proxyUrl: string;
    /** A validated lower-case registry host name. */
    readonly registryHost: string;
}
/**
 * The whole environment npm gets: a fixed `PATH` of read-only directories, `HOME`, the proxy, the
 * registry, an empty user and global config (no token), and no update check. Nothing of the
 * container's own environment (`NODE_VERSION`, `YARN_VERSION`) is forwarded.
 */
export declare function npmEnv(input: NpmEnvInput): Readonly<Record<string, string>>;
//# sourceMappingURL=npm-argv.d.ts.map