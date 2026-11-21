import { SietchError } from "@sietch/core";
/**
 * The check between the fetch stages (design D1). The resolve stage produces a package-lock.json
 * (lockfileVersion 3) from attacker-influenced registry metadata. Before the download stage runs on it,
 * this module validates it and proves three things: it has the shape npm writes, every package comes
 * from the configured registry over https, and the requested package has the integrity the request named.
 *
 * Pure. The result's `reason` is built from package positions and issue codes only, never from lockfile
 * text, so it is safe to log and print. The one exception is INTEGRITY_MISMATCH, which prints the two
 * integrity strings; both are checked against the SRI alphabet first, so nothing hostile is emitted.
 *
 * The schema lists every field npm 11 writes in a v3 `packages` entry (arborist's shrinkwrap.js:
 * `pkgMetaKeys`, `nodeMetaKeys`, and the dev/optional/peer flags). An unknown field is an ERROR until
 * someone reviews it and adds it here. The `link` field is left out on purpose: a `link: true` entry
 * points at a local path, which has no place in a registry install.
 *
 * Bundled dependencies. npm writes an `inBundle: true` entry with no `resolved` and no `integrity`,
 * because its files ship inside its parent's tarball. Such an entry is accepted only when it is nested
 * directly under a parent that exists, is not itself bundled, and has a `resolved` field (the registry
 * check below then applies to that parent). A bundled entry at the top level, under a missing parent, or
 * under a bundled parent is rejected.
 */
export type LockfileErrorCode = "FETCH_OUTPUT_INVALID" | "NON_REGISTRY_SOURCE" | "INTEGRITY_MISMATCH";
export type LockfileCheck = {
    readonly ok: true;
    /** Every non-root key of `packages`, for the script report's "one entry per package" check. */
    readonly packagePaths: readonly string[];
    /** The key of the requested package (`node_modules/<name>`). */
    readonly requestedPath: string;
} | {
    readonly ok: false;
    readonly code: LockfileErrorCode;
    readonly reason: string;
};
export interface LockfileExpectation {
    /** Registry host name only (no scheme, no port; https on 443 is assumed), for example `registry.npmjs.org`. */
    readonly registryHost: string;
    readonly name: string;
    readonly version: string;
    /** The request's SRI SHA-512. */
    readonly integrity: string;
}
export declare class LockfileConfigError extends SietchError {
    constructor(message: string);
}
/**
 * Check the resolve stage's lockfile. Never throws for any `bytes`; throws `LockfileConfigError` only
 * if `expectation.registryHost` is not a plain host name.
 */
export declare function checkLockfile(bytes: Uint8Array, expectation: LockfileExpectation): LockfileCheck;
//# sourceMappingURL=lockfile.d.ts.map