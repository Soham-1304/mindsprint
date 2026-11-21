import { SietchError } from "@sietch/core";
import { NAME_PATTERN, VERSION_PATTERN } from "./request.js";
/**
 * The synthetic project `package.json` that asks npm for exactly one package at exactly one version.
 * The fetch image and the runner's detonation project use this one builder, so the two never differ.
 *
 * The name and version come from a scan request (untrusted until validated). Both are checked again
 * here against the request's own patterns, so a range, a tag (`latest`), a `git+https:` or `file:`
 * specifier, a URL, or a name that starts with `-` cannot reach npm. The file is made with
 * `JSON.stringify` from a fixed template, so no value can break out of its string. No name or version
 * is ever put on an npm command line.
 */
const MAX_NAME_LENGTH = 214;
const MAX_VERSION_LENGTH = 256;
export class SyntheticPackageError extends SietchError {
    constructor(message) {
        super("SYNTHETIC_PACKAGE_INVALID", message);
    }
}
/** True when `name` is a plain npm package name (optionally scoped) as the scan request defines it. */
export function isPackageName(name) {
    return typeof name === "string" && name.length <= MAX_NAME_LENGTH && NAME_PATTERN.test(name);
}
/** True when `version` is one exact SemVer 2.0 version. */
export function isExactVersion(version) {
    return typeof version === "string" && version.length <= MAX_VERSION_LENGTH && VERSION_PATTERN.test(version);
}
/** The `package.json` bytes for a project whose only dependency is `name` at exactly `version`. */
export function buildPackageJson(name, version) {
    if (!isPackageName(name))
        throw new SyntheticPackageError("the package name is not a plain package name");
    if (!isExactVersion(version))
        throw new SyntheticPackageError("the version is not one exact version");
    const dependencies = {};
    dependencies[name] = version;
    const template = { name: "app", version: "1.0.0", private: true, dependencies };
    return new TextEncoder().encode(`${JSON.stringify(template)}\n`);
}
//# sourceMappingURL=synthetic-package.js.map