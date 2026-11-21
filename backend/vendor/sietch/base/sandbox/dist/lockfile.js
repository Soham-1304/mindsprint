import { SietchError } from "@sietch/core";
import { z } from "zod";
import { MAX_LOCKFILE_BYTES } from "./limits.js";
export class LockfileConfigError extends SietchError {
    constructor(message) {
        super("LOCKFILE_CONFIG_INVALID", message);
    }
}
const REGISTRY_HOST = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;
/** An npm package name segment, same character rules as the scan request: no `.` or `_` start, so never `.` or `..`. */
const NAME_SEGMENT = "[A-Za-z0-9][A-Za-z0-9._~-]*";
const PACKAGE = `(?:@${NAME_SEGMENT}/)?${NAME_SEGMENT}`;
/** `node_modules/<name>`, repeated for nesting. */
const PACKAGE_KEY = new RegExp(`^node_modules/${PACKAGE}(?:/node_modules/${PACKAGE})*$`);
const MAX_KEY = 1024;
const NESTED_MARKER = "/node_modules/";
const INTEGRITY = /^sha(?:1|256|384|512)-[A-Za-z0-9+/]{27,172}={0,2}$/;
const MAX_TEXT = 2048;
const text = z.string().max(MAX_TEXT);
/** A key of a name-to-spec map. Excludes `__proto__` so a record can't set a prototype. */
const mapKey = z
    .string()
    .min(1)
    .max(256)
    .regex(/^[@A-Za-z0-9._~/*-]+$/)
    .refine((key) => key !== "__proto__");
const stringMap = z.record(mapKey, text);
const funding = z.strictObject({ type: text.optional(), url: text.optional() });
const packageEntry = z.strictObject({
    name: text.optional(),
    version: text.optional(),
    resolved: text.optional(),
    integrity: text.optional(),
    license: text.optional(),
    dependencies: stringMap.optional(),
    devDependencies: stringMap.optional(),
    peerDependencies: stringMap.optional(),
    optionalDependencies: stringMap.optional(),
    acceptDependencies: stringMap.optional(),
    peerDependenciesMeta: z.record(mapKey, z.strictObject({ optional: z.boolean().optional() })).optional(),
    bundleDependencies: z.union([z.boolean(), z.array(text)]).optional(),
    funding: z.union([text, funding, z.array(z.union([text, funding]))]).optional(),
    engines: z.union([stringMap, z.array(text)]).optional(),
    os: z.array(text).optional(),
    cpu: z.array(text).optional(),
    libc: z.array(text).optional(),
    bin: z.union([text, stringMap]).optional(),
    deprecated: text.optional(),
    workspaces: z
        .union([
        z.array(text),
        z.strictObject({ packages: z.array(text).optional(), nohoist: z.array(text).optional() }),
    ])
        .optional(),
    hasInstallScript: z.boolean().optional(),
    hasShrinkwrap: z.boolean().optional(),
    inBundle: z.boolean().optional(),
    dev: z.boolean().optional(),
    optional: z.boolean().optional(),
    devOptional: z.boolean().optional(),
    peer: z.boolean().optional(),
    extraneous: z.boolean().optional(),
});
const lockfileSchema = z.strictObject({
    name: text.optional(),
    version: text.optional(),
    lockfileVersion: z.literal(3),
    requires: z.boolean().optional(),
    packages: z.record(z
        .string()
        .max(MAX_KEY)
        .regex(/^(?:|node_modules\/.+)$/), packageEntry),
});
const invalid = (reason) => ({ ok: false, code: "FETCH_OUTPUT_INVALID", reason });
/** A fixed-format description of the first few schema issues: positions and codes, no values or key names. */
function describeIssues(error) {
    const parts = error.issues.slice(0, 5).map((issue) => {
        const where = issue.path
            .map((p) => (typeof p === "number" ? String(p) : p === "packages" ? "packages" : "~"))
            .join(".");
        return `${where || "(root)"}: ${issue.code}`;
    });
    return `lockfile does not match the expected npm v3 shape (${parts.join("; ")})`.slice(0, 400);
}
/** True for `https://<host>/<path>.tgz` on the default port, with no credentials, query, or fragment. */
function isRegistryUrl(resolved, host) {
    if (!resolved.startsWith(`https://${host}/`))
        return false;
    if (!/^[!-~]+$/.test(resolved) || resolved.includes("\\"))
        return false;
    let url;
    try {
        url = new URL(resolved);
    }
    catch {
        return false;
    }
    return (url.protocol === "https:" &&
        url.hostname === host &&
        url.port === "" &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "" &&
        url.pathname.endsWith(".tgz"));
}
/**
 * A bundled entry (`inBundle: true`) with neither `resolved` nor `integrity`. Whether it is acceptable
 * depends on its parent, so this only recognises the shape.
 */
function isBundledShape(entry) {
    return entry.inBundle === true && entry.resolved === undefined && entry.integrity === undefined;
}
/** The key of the package this one is nested under, or `undefined` for a top-level package. */
function parentKey(key) {
    const at = key.lastIndexOf(NESTED_MARKER);
    return at === -1 ? undefined : key.slice(0, at);
}
/**
 * Check the resolve stage's lockfile. Never throws for any `bytes`; throws `LockfileConfigError` only
 * if `expectation.registryHost` is not a plain host name.
 */
export function checkLockfile(bytes, expectation) {
    if (!REGISTRY_HOST.test(expectation.registryHost)) {
        throw new LockfileConfigError("registryHost must be a lower-case host name");
    }
    if (bytes.length === 0 || bytes.length > MAX_LOCKFILE_BYTES) {
        return invalid("lockfile is empty or over the size cap");
    }
    let json;
    try {
        json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch {
        return invalid("lockfile is not valid UTF-8 JSON");
    }
    const parsed = lockfileSchema.safeParse(json);
    if (!parsed.success)
        return invalid(describeIssues(parsed.error));
    const packages = Object.entries(parsed.data.packages);
    const dependencies = packages.filter(([key]) => key !== "");
    const root = packages.find(([key]) => key === "")?.[1];
    if (root === undefined)
        return invalid("lockfile has no root entry");
    if (root.resolved !== undefined || root.integrity !== undefined) {
        return invalid("the root entry has a resolved or integrity field");
    }
    const byKey = new Map(dependencies);
    // Positions are indexes into the non-root entries, in file order.
    for (const [index, [key, entry]] of dependencies.entries()) {
        if (!PACKAGE_KEY.test(key))
            return invalid(`package ${index} has a path that is not under node_modules`);
        if (entry.version === undefined)
            return invalid(`package ${index} is missing a version`);
        if (isBundledShape(entry)) {
            const parentPath = parentKey(key);
            const parent = parentPath === undefined ? undefined : byKey.get(parentPath);
            if (parent === undefined || parent.inBundle === true || parent.resolved === undefined) {
                return invalid(`package ${index} is bundled but has no registry-resolved parent`);
            }
            continue;
        }
        if (entry.resolved === undefined || entry.integrity === undefined) {
            return invalid(`package ${index} is missing resolved or integrity`);
        }
        if (!INTEGRITY.test(entry.integrity))
            return invalid(`package ${index} has an integrity that is not an SRI hash`);
    }
    for (const [index, [, entry]] of dependencies.entries()) {
        if (isBundledShape(entry))
            continue;
        if (entry.resolved === undefined || !isRegistryUrl(entry.resolved, expectation.registryHost)) {
            return {
                ok: false,
                code: "NON_REGISTRY_SOURCE",
                reason: `package ${index} is not resolved from the configured registry over https`,
            };
        }
    }
    const requestedPath = `node_modules/${expectation.name}`;
    const requestedIndex = dependencies.findIndex(([key]) => key === requestedPath);
    const requested = dependencies[requestedIndex]?.[1];
    if (requested === undefined || requested.version !== expectation.version) {
        return {
            ok: false,
            code: "INTEGRITY_MISMATCH",
            reason: "the requested package and version are not in the lockfile",
        };
    }
    if (requested.integrity !== expectation.integrity) {
        return {
            ok: false,
            code: "INTEGRITY_MISMATCH",
            reason: `the lockfile integrity for the requested package differs from the request (lockfile ${requested.integrity}, request ${expectation.integrity})`,
        };
    }
    return { ok: true, packagePaths: dependencies.map(([key]) => key), requestedPath };
}
//# sourceMappingURL=lockfile.js.map