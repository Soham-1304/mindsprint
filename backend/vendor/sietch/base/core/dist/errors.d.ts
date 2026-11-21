/**
 * Base class for every error thrown inside Sietch's base packages.
 *
 * `code` is a stable, machine-readable identifier (for example `TRACE_PARSE_FAILED`).
 * The API layer maps codes to HTTP responses, so messages can change without breaking clients.
 */
export declare class SietchError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: {
        cause?: unknown;
    });
}
/** A package name, version, integrity, or ruleset version that can't be used in a cache key. */
export declare class InvalidPackageIdentityError extends SietchError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map