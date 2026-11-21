import { SietchError } from "@sietch/core";
export declare class SyntheticPackageError extends SietchError {
    constructor(message: string);
}
/** True when `name` is a plain npm package name (optionally scoped) as the scan request defines it. */
export declare function isPackageName(name: unknown): name is string;
/** True when `version` is one exact SemVer 2.0 version. */
export declare function isExactVersion(version: unknown): version is string;
/** The `package.json` bytes for a project whose only dependency is `name` at exactly `version`. */
export declare function buildPackageJson(name: string, version: string): Uint8Array;
//# sourceMappingURL=synthetic-package.d.ts.map