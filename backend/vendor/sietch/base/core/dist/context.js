// The read-only view every rule works from: events sorted by seq, attribution (package manager or
// package), every name each recorded path can be reached by, and the compiled allowlist and
// honeytokens.
import { compileHoneytokens } from "./honeytokens.js";
import { canonicalIp, compileAllowlist } from "./hosts.js";
import { hasPrefix, joinPath, normalisePath, segments } from "./paths.js";
import { quote, redactToken } from "./text.js";
import { LinkTable } from "./views.js";
/** Home-relative credential stores (Requirement 6.3). */
export const HOME_CREDENTIAL_ENTRIES = [
    ".npmrc",
    ".yarnrc",
    ".yarnrc.yml",
    ".config/gh",
    ".git-credentials",
    ".netrc",
    ".aws",
    ".ssh",
    ".docker/config.json",
    ".kube",
    ".config/gcloud",
    ".azure",
    ".gnupg",
    ".pypirc",
    ".bash_history",
    ".zsh_history",
    // Added after the breach re-review (BT-R2-2): stores that info-stealers commonly read.
    ".config/git/credentials",
    ".local/share/keyrings",
    ".password-store",
    ".config/google-chrome",
    ".config/chromium",
    ".config/BraveSoftware",
    ".mozilla",
    ".electrum",
    ".bitcoin",
    ".ethereum",
    ".config/solana",
    ".config/Exodus",
];
/** Home-relative directories a package may write to (caches). */
export const HOME_WRITE_ROOTS = [".npm", ".cache", ".node-gyp"];
export const HARMLESS_DEVICES = ["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"];
const DOT_ENV = /^\.env(\..+)?$/;
function normaliseEvent(event) {
    switch (event.type) {
        case "exec":
        case "file_read":
            return { ...event, path: normalisePath(event.path) };
        case "file_write":
            return event.target === undefined
                ? { ...event, path: normalisePath(event.path) }
                : { ...event, path: normalisePath(event.path), target: normalisePath(event.target) };
        case "connect":
        case "exit":
        case "dns":
        case "http":
            return event;
        default: {
            const unreachable = event;
            throw new TypeError(`unknown event type ${String(unreachable.type)}`);
        }
    }
}
export function buildContext(input) {
    const raw = [...input.events].sort((a, b) => a.seq - b.seq);
    const events = raw.map(normaliseEvent);
    const env = input.environment;
    const home = normalisePath(env.home);
    const projectDir = normalisePath(env.projectDir);
    const nodeModulesDir = normalisePath(env.nodeModulesDir);
    const pmPid = env.packageManagerPid;
    const credentialRoots = [
        ...HOME_CREDENTIAL_ENTRIES.map((e) => joinPath(home, e)),
        ...env.extraCredentialPaths.map(normalisePath),
    ];
    const writeRoots = [
        nodeModulesDir,
        ...env.tmpDirs.map(normalisePath),
        ...HOME_WRITE_ROOTS.map((e) => joinPath(home, e)),
        "/dev/pts",
    ];
    const harmless = new Set(HARMLESS_DEVICES);
    const sinkAddresses = new Set();
    for (const a of env.sinkAddresses) {
        const ip = canonicalIp(a);
        if (ip === null)
            throw new TypeError("sink address is not an IP"); // validation guarantees this
        sinkAddresses.add(ip);
    }
    // Views are computed in seq order, so each event only sees links created before it.
    const links = new LinkTable(home, projectDir);
    const views = new Map();
    for (const event of raw) {
        if (event.type === "exec" || event.type === "file_read") {
            views.set(event.seq, { path: links.views(event.path) });
        }
        else if (event.type === "file_write") {
            const pathViews = links.views(event.path);
            const targetViews = event.target === undefined ? undefined : links.views(event.target);
            views.set(event.seq, targetViews === undefined ? { path: pathViews } : { path: pathViews, target: targetViews });
            if ((event.op === "symlink" || event.op === "hardlink") && event.target !== undefined) {
                const target = normalisePath(event.target);
                for (const name of pathViews.all)
                    links.add(name, target);
            }
        }
    }
    // Roots are split once, and each path once per check, so long paths stay cheap (SR-7).
    const credentialRootSegs = credentialRoots.map(segments);
    const writeRootSegs = writeRoots.map(segments);
    const nodeModulesSegs = segments(nodeModulesDir);
    const isCredentialPath = (path) => {
        const segs = segments(path);
        if (credentialRootSegs.some((root) => hasPrefix(segs, root)))
            return true;
        const last = segs[segs.length - 1] ?? "";
        if (segs[0] === "proc" && segs.length >= 3 && (last === "environ" || last === "mem"))
            return true;
        return DOT_ENV.test(last) && !hasPrefix(segs, nodeModulesSegs);
    };
    const isAllowedPath = (path) => {
        if (harmless.has(path))
            return true;
        const segs = segments(path);
        return writeRootSegs.some((root) => hasPrefix(segs, root));
    };
    const tokenValues = [...input.honeytokens].map((t) => t.value).sort((a, b) => b.length - a.length);
    return {
        input,
        events,
        seqs: new Set(events.map((e) => e.seq)),
        lastSeq: events[events.length - 1]?.seq ?? 0,
        home,
        nodeModulesDir,
        sinkAddresses,
        allowlist: compileAllowlist(input.allowlist),
        honeytokens: compileHoneytokens(input.honeytokens),
        isPackageEvent: (event) => !("pid" in event && event.pid === pmPid && event.phase === "install"),
        viewsOf: (event) => views.get(event.seq) ?? {},
        touchesCredentials: (v) => v?.all.some(isCredentialPath) === true,
        // Missing or incomplete views are never allowed (fail closed).
        isAllowedWrite: (v) => v?.complete === true && v.all.every(isAllowedPath),
        show: (value) => quote(redactTokens(value, tokenValues)),
    };
}
/**
 * Replace every occurrence of each token, in any letter case, with its redacted form. Longest
 * tokens go first, so a token that contains another is redacted whole. The redacted form ends
 * in "…", which no token contains, so a replacement can never join pieces into a new full token.
 */
export function redactTokens(value, tokenValues) {
    let out = value;
    for (const token of tokenValues) {
        const needle = token.toLowerCase();
        let at = out.toLowerCase().indexOf(needle);
        while (at >= 0) {
            const replacement = redactToken(out.slice(at, at + token.length));
            out = out.slice(0, at) + replacement + out.slice(at + token.length);
            at = out.toLowerCase().indexOf(needle, at + replacement.length);
        }
    }
    return out;
}
//# sourceMappingURL=context.js.map