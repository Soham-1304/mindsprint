/**
 * Base class for every error thrown inside Sietch's base packages.
 *
 * `code` is a stable, machine-readable identifier (for example `TRACE_PARSE_FAILED`).
 * The API layer maps codes to HTTP responses, so messages can change without breaking clients.
 */
export class SietchError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = new.target.name;
        this.code = code;
    }
}
/** A package name, version, integrity, or ruleset version that can't be used in a cache key. */
export class InvalidPackageIdentityError extends SietchError {
    constructor(message) {
        super("INVALID_PACKAGE_IDENTITY", message);
    }
}
//# sourceMappingURL=errors.js.map