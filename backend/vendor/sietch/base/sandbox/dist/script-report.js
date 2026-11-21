import { z } from "zod";
import { MAX_REPORT_BYTES } from "./limits.js";
/**
 * The script report and the "scripts actually ran" check (Requirement 7.6, design D9). Pure.
 *
 * The download stage reads the real `package.json` of every extracted package and reports, for each
 * lifecycle script it declares, the script text (at most `MAX_SCRIPT_TEXT` characters; a longer script is
 * reported as its first 512 bytes), and whether the package has a `binding.gyp`. npm runs
 * `node-gyp rebuild` as the install script when a package has a `binding.gyp` and declares neither an
 * `install` nor a `preinstall` script (arborist's rebuild step), so that case adds an expected script.
 *
 * The check needs one install-phase exec of `/bin/sh -c <that script>` per expected script, each exec
 * satisfying at most one script. An exec for a different script does not count, so a pipeline that skips
 * one package's script cannot hide behind another package's. A missing script is ERROR
 * `SCRIPTS_NOT_RUN`, because a trace without the install behaviour would look clean.
 *
 * Messages carry counts and fixed text only, never package names, paths, or script text from the report.
 */
/** The lifecycle scripts npm runs when it installs a dependency. */
export const INSTALL_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall"];
/**
 * The shell npm runs lifecycle scripts with. The install step passes it to npm as
 * `NPM_SCRIPT_SHELL_FLAG`, so a script run is one exact `execve` of this path with argv
 * `[<name>, "-c", <script>]` (design D9; confirmed by spike 5, question 2, on the detonation image under
 * gVisor). Without the flag npm tries one exec per PATH entry, which is not a usable record.
 *
 * The flag and `LIFECYCLE_SCRIPT_BINARY` are both derived from this one constant. A test fails if they
 * ever differ, because a drift would end every scan with SCRIPTS_NOT_RUN.
 */
export const NPM_SCRIPT_SHELL = "/bin/sh";
/** The npm option the install marker passes. */
export const NPM_SCRIPT_SHELL_FLAG = `--script-shell=${NPM_SCRIPT_SHELL}`;
/** The binary the trace shows for a lifecycle script: the same path as `NPM_SCRIPT_SHELL`. */
export const LIFECYCLE_SCRIPT_BINARY = NPM_SCRIPT_SHELL;
/** The argument that makes the script binary run a command string. */
export const LIFECYCLE_SCRIPT_FLAG = "-c";
/** The install script npm runs for a package with a `binding.gyp` and no `install` or `preinstall`. */
export const DEFAULT_GYP_SCRIPT = "node-gyp rebuild";
/** The longest script text a report entry may carry (the reporter cuts a longer script at 512 bytes). */
export const MAX_SCRIPT_TEXT = 512;
/**
 * Texts at least this long are compared by their first `PREFIX_MATCH_CHARS` characters. The recorder
 * cuts a whole exec record at 512 bytes, so a long script's argv is a prefix of unknown length. A
 * shorter text must match exactly.
 */
const PREFIX_MATCH_CHARS = 256;
const MAX_PATH = 1024;
const MAX_ANCESTORS = 256;
const reportSchema = z.strictObject({
    packages: z.array(z.strictObject({
        /** The lockfile `packages` key, for example `node_modules/left-pad`. */
        path: z.string().min(1).max(MAX_PATH),
        scripts: z
            .array(z.strictObject({
            name: z.enum(INSTALL_LIFECYCLE_SCRIPTS),
            text: z.string().min(1).max(MAX_SCRIPT_TEXT),
        }))
            .max(INSTALL_LIFECYCLE_SCRIPTS.length),
        bindingGyp: z.boolean(),
    })),
});
const invalid = (reason) => ({ ok: false, code: "FETCH_OUTPUT_INVALID", reason });
/**
 * Parse and validate the report. `lockfilePackagePaths` are the lockfile's non-root keys: the report
 * must have exactly one entry for each, and none for anything else.
 */
export function parseScriptReport(bytes, lockfilePackagePaths) {
    if (bytes.length === 0 || bytes.length > MAX_REPORT_BYTES) {
        return invalid("script report is empty or over the size cap");
    }
    let json;
    try {
        json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch {
        return invalid("script report is not valid UTF-8 JSON");
    }
    const parsed = reportSchema.safeParse(json);
    if (!parsed.success) {
        const codes = parsed.error.issues.slice(0, 5).map((issue) => issue.code);
        return invalid(`script report does not match the expected shape (${codes.join(", ")})`);
    }
    const report = parsed.data;
    const expected = new Set(lockfilePackagePaths);
    const seen = new Set();
    for (const entry of report.packages) {
        if (!expected.has(entry.path))
            return invalid("script report names a package that is not in the lockfile");
        if (seen.has(entry.path))
            return invalid("script report has two entries for one package");
        if (new Set(entry.scripts.map((script) => script.name)).size !== entry.scripts.length) {
            return invalid("script report lists a script twice for one package");
        }
        seen.add(entry.path);
    }
    if (seen.size !== expected.size)
        return invalid("script report is missing a lockfile package");
    return { ok: true, report };
}
/** The script texts npm is expected to run for one package. */
function expectedScripts(entry) {
    const texts = entry.scripts.map((script) => script.text);
    const hasInstallOrPreinstall = entry.scripts.some((s) => s.name === "install" || s.name === "preinstall");
    if (entry.bindingGyp && !hasInstallOrPreinstall)
        texts.push(DEFAULT_GYP_SCRIPT);
    return texts;
}
/** Every script text npm is expected to run for the whole report, one entry per script. */
export function expectedScriptTexts(report) {
    return report.packages.flatMap(expectedScripts);
}
/** How many packages declare an install script or have a `binding.gyp` that npm builds. */
export function countPackagesWithScripts(report) {
    return report.packages.filter((p) => expectedScripts(p).length > 0).length;
}
/** True if `pid` is a strict descendant of `ancestor`, following `ppid` links, with a bounded walk. */
function isDescendant(parents, pid, ancestor) {
    let current = parents.get(pid);
    for (let step = 0; step < MAX_ANCESTORS && current !== undefined; step++) {
        if (current === ancestor)
            return true;
        current = parents.get(current);
    }
    return false;
}
/** Bucket key: a short text is its own key, a long one is keyed by its first characters. */
function bucketKey(scriptText) {
    return scriptText.length < PREFIX_MATCH_CHARS ? scriptText : scriptText.slice(0, PREFIX_MATCH_CHARS);
}
/**
 * Whether an exec's script argument stands for an expected script. A short text must match exactly. A
 * long one matches when one is a prefix of the other, because the recorder cuts long argv.
 */
function sameScript(seen, expected) {
    if (seen === expected)
        return true;
    if (seen.length < PREFIX_MATCH_CHARS || expected.length < PREFIX_MATCH_CHARS)
        return false;
    return seen.startsWith(expected) || expected.startsWith(seen);
}
/**
 * Check that npm ran every expected lifecycle script. `packageManagerPid` is the install role's pid (npm's
 * pid). A script run is an install-phase `exec` of `LIFECYCLE_SCRIPT_BINARY` with argv
 * `[_, "-c", <script>]`, by a process descended from npm. Each exec satisfies at most one expected
 * script, so two packages with the same script need two execs. Any other exec proves nothing: a failed
 * exec also prints `= 0` in the trace.
 */
export function checkScriptsRan(report, events, packageManagerPid) {
    const packagesWithScripts = countPackagesWithScripts(report);
    const expected = expectedScriptTexts(report);
    if (expected.length === 0)
        return { ok: true, packagesWithScripts, scriptExecs: 0 };
    const parents = new Map();
    for (const event of events) {
        if ("pid" in event && !parents.has(event.pid))
            parents.set(event.pid, event.ppid);
    }
    // The script text of every qualifying exec, in trace order, bucketed so matching stays linear.
    const buckets = new Map();
    for (const event of events) {
        if (event.type === "exec" &&
            event.phase === "install" &&
            event.path === LIFECYCLE_SCRIPT_BINARY &&
            event.argv[1] === LIFECYCLE_SCRIPT_FLAG &&
            event.argv[2] !== undefined &&
            isDescendant(parents, event.pid, packageManagerPid)) {
            const key = bucketKey(event.argv[2]);
            const bucket = buckets.get(key);
            if (bucket === undefined)
                buckets.set(key, [event.argv[2]]);
            else
                bucket.push(event.argv[2]);
        }
    }
    let matched = 0;
    for (const text of expected) {
        const bucket = buckets.get(bucketKey(text));
        const at = bucket?.findIndex((seen) => sameScript(seen, text)) ?? -1;
        if (bucket !== undefined && at !== -1) {
            bucket.splice(at, 1);
            matched += 1;
        }
    }
    if (matched < expected.length) {
        return {
            ok: false,
            code: "SCRIPTS_NOT_RUN",
            reason: `${expected.length - matched} of ${expected.length} expected install script(s) have no matching exec in the install phase`,
        };
    }
    return { ok: true, packagesWithScripts, scriptExecs: matched };
}
//# sourceMappingURL=script-report.js.map