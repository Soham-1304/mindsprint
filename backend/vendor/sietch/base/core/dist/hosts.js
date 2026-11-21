// Host names and IP addresses seen in sandbox traffic. Anything that doesn't parse cleanly is
// treated as unknown: never allowlisted, never loopback, never a sink address (fail closed).
const HOST_NAME = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_CHARS = /^[0-9a-f:.]+$/;
const PORT = /^\d{1,5}$/;
const MAX_HOST_NAME = 253;
/** A canonical IP string, or null if `address` isn't an IP literal we can read with certainty. */
export function canonicalIp(address) {
    const lower = address.toLowerCase();
    const v4 = IPV4.exec(lower);
    if (v4) {
        const parts = v4.slice(1, 5);
        // Leading zeros are refused: some parsers read them as octal, so their meaning is ambiguous.
        if (parts.some((p) => p.length > 1 && p.startsWith("0")))
            return null;
        if (parts.some((p) => Number(p) > 255))
            return null;
        return parts.join(".");
    }
    if (!lower.includes(":") || !IPV6_CHARS.test(lower))
        return null;
    if (lower.startsWith("::ffff:")) {
        const mapped = canonicalIp(lower.slice(7));
        if (mapped?.includes("."))
            return mapped;
    }
    if (lower.includes("."))
        return null; // other embedded-IPv4 forms are not interpreted
    return lower;
}
/** True for 127.0.0.0/8 and ::1, given a canonical IP. */
export function isLoopback(ip) {
    return ip.startsWith("127.") || ip === "::1" || ip === "0:0:0:0:0:0:0:1";
}
/**
 * Normalise a host from a Host header, SNI, or DNS query: lowercase, without a port, without a
 * trailing dot. Returns a canonical IP for IP literals, or null when the value isn't a clean host.
 */
export function normaliseHost(raw) {
    let host = raw.toLowerCase();
    if (host.startsWith("[")) {
        const end = host.indexOf("]");
        if (end < 0)
            return null;
        const rest = host.slice(end + 1);
        if (rest !== "" && !(rest.startsWith(":") && PORT.test(rest.slice(1))))
            return null;
        const ip = canonicalIp(host.slice(1, end));
        return ip?.includes(":") ? ip : null;
    }
    const colons = host.split(":").length - 1;
    if (colons > 1)
        return canonicalIp(host); // a bare IPv6 literal
    if (colons === 1) {
        const at = host.indexOf(":");
        if (!PORT.test(host.slice(at + 1)))
            return null;
        host = host.slice(0, at);
    }
    if (host.endsWith("."))
        host = host.slice(0, -1);
    const ip = canonicalIp(host);
    if (ip !== null)
        return ip;
    if (IPV4.test(host))
        return null; // looked like IPv4 but wasn't valid
    if (host.length === 0 || host.length > MAX_HOST_NAME || !HOST_NAME.test(host))
        return null;
    return host;
}
export class InvalidAllowlistPatternError extends Error {
    constructor(index) {
        super(`allowlist entry ${index} is not a host, an IP, or "*.host"`);
        this.name = "InvalidAllowlistPatternError";
    }
}
const isIpLikeSuffix = (suffix) => /^[0-9.]+$/.test(suffix);
/** Compile allowlist patterns. Throws InvalidAllowlistPatternError for anything else. */
export function compileAllowlist(patterns) {
    const exact = new Set();
    const suffixes = [];
    patterns.forEach((pattern, index) => {
        if (pattern.startsWith("*.")) {
            const suffix = normaliseHost(pattern.slice(2));
            if (suffix === null ||
                canonicalIp(suffix) !== null ||
                isIpLikeSuffix(suffix) ||
                pattern.slice(2).includes(":")) {
                throw new InvalidAllowlistPatternError(index);
            }
            suffixes.push(suffix);
            return;
        }
        if (pattern.includes("*"))
            throw new InvalidAllowlistPatternError(index);
        const host = normaliseHost(pattern);
        if (host === null ||
            (pattern.includes(":") && canonicalIp(pattern) === null && !pattern.startsWith("["))) {
            throw new InvalidAllowlistPatternError(index);
        }
        exact.add(host);
    });
    return { exact, suffixes };
}
/**
 * True if a normalised host matches: exactly, or as a proper subdomain of a "*.suffix" pattern.
 * IP addresses only match exact entries. A null host never matches.
 */
export function matchesAllowlist(allowlist, host) {
    if (host === null)
        return false;
    if (allowlist.exact.has(host))
        return true;
    if (canonicalIp(host) !== null)
        return false;
    return allowlist.suffixes.some((s) => host.length > s.length + 1 && host.endsWith(`.${s}`));
}
//# sourceMappingURL=hosts.js.map