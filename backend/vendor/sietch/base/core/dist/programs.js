// Which program an exec event ran, and the program and argument sets the rules look for.
import { basename } from "./paths.js";
const MULTICALL = new Set(["busybox", "toybox"]);
/**
 * Every lowercase name the exec could be running: the basename of each view of its path (so a
 * symlink /tmp/c -> /usr/bin/curl is "curl"), and for busybox or toybox, the applet in argv[1].
 */
export function programNames(event, views) {
    const names = new Set();
    for (const p of views?.all ?? [event.path])
        names.add(basename(p).toLowerCase());
    for (const n of [...names]) {
        if (MULTICALL.has(n)) {
            const applet = event.argv[1];
            if (applet !== undefined && applet.length > 0)
                names.add(basename(applet).toLowerCase());
        }
    }
    return [...names];
}
/** True if any of the names is in the set. */
export const anyIn = (names, set) => names.some((n) => set.has(n));
/** Arguments after the program name, lowercased (after the applet for busybox and toybox). */
export function argsOf(event, names) {
    const multicall = names.some((n) => MULTICALL.has(n)) && basename(event.argv[1] ?? "") !== "";
    return event.argv.slice(multicall ? 2 : 1).map((a) => a.toLowerCase());
}
const PM_SCRIPTS = new Map([
    ["npm-cli.js", "npm"],
    ["pnpm.cjs", "pnpm"],
    ["pnpm.js", "pnpm"],
    ["pnpm.mjs", "pnpm"],
    ["yarn.js", "yarn"],
    ["yarn.cjs", "yarn"],
]);
export const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun", "cnpm"]);
/**
 * If the exec runs a package manager, its name and the arguments after it. Covers both
 * `/usr/local/bin/npm publish` and `node .../npm-cli.js publish`.
 */
export function packageManagerCall(event, names) {
    const pm = names.find((n) => PACKAGE_MANAGERS.has(n));
    if (pm !== undefined)
        return { name: pm, args: argsOf(event, names) };
    if (names.includes("node") || names.includes("nodejs")) {
        const args = argsOf(event, names);
        const scriptAt = args.findIndex((a) => !a.startsWith("-"));
        if (scriptAt < 0)
            return null;
        const script = PM_SCRIPTS.get(basename(args[scriptAt] ?? ""));
        if (script !== undefined)
            return { name: script, args: args.slice(scriptAt + 1) };
    }
    return null;
}
/** npm's own abbreviations for registry-changing commands (npm 11 lib/utils/cmd-list.js), plus "token". */
export const REGISTRY_WRITE_COMMANDS = new Set([
    "pu",
    "pub",
    "publ",
    "publi",
    "publis",
    "publish",
    "unp",
    "unpu",
    "unpub",
    "unpubl",
    "unpubli",
    "unpublis",
    "unpublish",
    "dep",
    "depr",
    "depre",
    "deprec",
    "depreca",
    "deprecat",
    "deprecate",
    "logi",
    "login",
    "add-",
    "add-u",
    "add-us",
    "add-use",
    "add-user",
    "addu",
    "addus",
    "adduse",
    "adduser",
    "token",
]);
export const NETWORK_TOOLS = new Set([
    "curl",
    "wget",
    "nc",
    "ncat",
    "netcat",
    "socat",
    "telnet",
    "ssh",
    "scp",
    "sftp",
    "ftp",
    "tftp",
    "rsync",
    "dig",
    "nslookup",
    "host",
]);
export const ALTERNATIVE_RUNTIMES = new Set(["bun", "bunx", "deno"]);
export const NPM_REGISTRY_HOSTS = new Set([
    "registry.npmjs.org",
    "registry.npmjs.com",
    "registry.yarnpkg.com",
    "npm.pkg.github.com",
]);
export const GITHUB_HOSTS = new Set(["api.github.com", "uploads.github.com", "github.com"]);
export const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Positional (non-option) arguments. */
export const positional = (args) => args.filter((a) => !a.startsWith("-"));
//# sourceMappingURL=programs.js.map