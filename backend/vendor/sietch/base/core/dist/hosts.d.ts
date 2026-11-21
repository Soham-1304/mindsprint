/** A canonical IP string, or null if `address` isn't an IP literal we can read with certainty. */
export declare function canonicalIp(address: string): string | null;
/** True for 127.0.0.0/8 and ::1, given a canonical IP. */
export declare function isLoopback(ip: string): boolean;
/**
 * Normalise a host from a Host header, SNI, or DNS query: lowercase, without a port, without a
 * trailing dot. Returns a canonical IP for IP literals, or null when the value isn't a clean host.
 */
export declare function normaliseHost(raw: string): string | null;
export interface CompiledAllowlist {
    readonly exact: ReadonlySet<string>;
    readonly suffixes: readonly string[];
}
export declare class InvalidAllowlistPatternError extends Error {
    constructor(index: number);
}
/** Compile allowlist patterns. Throws InvalidAllowlistPatternError for anything else. */
export declare function compileAllowlist(patterns: readonly string[]): CompiledAllowlist;
/**
 * True if a normalised host matches: exactly, or as a proper subdomain of a "*.suffix" pattern.
 * IP addresses only match exact entries. A null host never matches.
 */
export declare function matchesAllowlist(allowlist: CompiledAllowlist, host: string | null): boolean;
//# sourceMappingURL=hosts.d.ts.map