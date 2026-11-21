import { MAX_REPORT_BYTES } from "../../limits.js";
import { INSTALL_LIFECYCLE_SCRIPTS } from "../../script-report.js";
import { MAX_REPORT_SCRIPT_BYTES } from "./limits.js";
const PACKAGE_KEY = /^node_modules\/[A-Za-z0-9@._~/-]+$/;
const BINDING_GYP = "binding.gyp";
function failed(reason) {
    return { ok: false, reason };
}
/** A key that can safely become `<project>/<key>`: under `node_modules`, no empty, `.` or `..` segment. */
export function isSafePackageKey(key) {
    if (key.length > 1024 || !PACKAGE_KEY.test(key))
        return false;
    return key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
/** The longest prefix of `text` that is at most `maxBytes` UTF-8 bytes and ends on a character boundary. */
export function cutUtf8(text, maxBytes) {
    const encoder = new TextEncoder();
    if (encoder.encode(text).length <= maxBytes)
        return text;
    let out = "";
    let used = 0;
    for (const char of text) {
        const size = encoder.encode(char).length;
        if (used + size > maxBytes)
            break;
        out += char;
        used += size;
    }
    return out;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** True for a lockfile entry npm may legitimately skip on this platform. */
function mayBeSkipped(entry) {
    if (!isRecord(entry))
        return false;
    const restricted = (field) => {
        const value = entry[field];
        return Array.isArray(value) && value.length > 0;
    };
    return entry.optional === true || restricted("os") || restricted("cpu") || restricted("libc");
}
function lifecycleScripts(json) {
    if (!isRecord(json) || !Object.hasOwn(json, "scripts"))
        return [];
    const scripts = json.scripts;
    if (!isRecord(scripts))
        return [];
    const found = [];
    for (const name of INSTALL_LIFECYCLE_SCRIPTS) {
        if (!Object.hasOwn(scripts, name))
            continue;
        const text = scripts[name];
        if (typeof text !== "string" || text.length === 0)
            continue;
        found.push({ name, text: cutUtf8(text, MAX_REPORT_SCRIPT_BYTES) });
    }
    return found;
}
export async function buildScriptReport(lockfile, files) {
    let packages;
    try {
        const json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(lockfile));
        const candidate = isRecord(json) ? json.packages : undefined;
        if (!isRecord(candidate))
            return failed("the lockfile has no packages object");
        packages = candidate;
    }
    catch {
        return failed("the lockfile is not valid UTF-8 JSON");
    }
    const entries = [];
    for (const [key, lockEntry] of Object.entries(packages)) {
        if (key === "")
            continue;
        if (!isSafePackageKey(key))
            return failed("a lockfile package key is not a safe path");
        const read = await files.readPackageJson(key);
        if (read.kind === "absent") {
            if (!mayBeSkipped(lockEntry))
                return failed("an installed package has no package.json");
            entries.push({ path: key, scripts: [], bindingGyp: false });
            continue;
        }
        const listing = await files.listPackageDir(key);
        entries.push({
            path: key,
            scripts: lifecycleScripts(read.json),
            bindingGyp: listing?.includes(BINDING_GYP) === true,
        });
    }
    const bytes = new TextEncoder().encode(JSON.stringify({ packages: entries }));
    if (bytes.length > MAX_REPORT_BYTES)
        return failed("the script report is over the size cap");
    return { ok: true, bytes };
}
//# sourceMappingURL=script-report-builder.js.map