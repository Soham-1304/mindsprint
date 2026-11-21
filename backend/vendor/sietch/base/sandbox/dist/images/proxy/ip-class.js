/**
 * Whether an IPv4 address is one the registry proxy may connect to. Pure.
 *
 * The proxy resolves the registry name itself and connects only when every answer is a public address.
 * Anything that is not a strict dotted quad is refused, so a hostile resolver answer such as `0x7f.1`,
 * `127.1`, `010.0.0.1`, or an IPv6 text can never be read as a public address. The refused ranges are
 * the special-purpose blocks of IANA's IPv4 registry that a registry name has no business resolving to,
 * plus the loopback, link-local (the cloud metadata address), private, shared (CGNAT) and multicast
 * blocks.
 */
function range(cidr, a, b, c, d, prefix) {
    const first = ((a * 256 + b) * 256 + c) * 256 + d;
    return { cidr, first, last: first + 2 ** (32 - prefix) - 1 };
}
export const REFUSED_RANGES = [
    range("0.0.0.0/8", 0, 0, 0, 0, 8),
    range("10.0.0.0/8", 10, 0, 0, 0, 8),
    range("100.64.0.0/10", 100, 64, 0, 0, 10),
    range("127.0.0.0/8", 127, 0, 0, 0, 8),
    range("169.254.0.0/16", 169, 254, 0, 0, 16),
    range("172.16.0.0/12", 172, 16, 0, 0, 12),
    range("192.0.0.0/24", 192, 0, 0, 0, 24),
    range("192.0.2.0/24", 192, 0, 2, 0, 24),
    range("192.168.0.0/16", 192, 168, 0, 0, 16),
    range("198.18.0.0/15", 198, 18, 0, 0, 15),
    range("198.51.100.0/24", 198, 51, 100, 0, 24),
    range("203.0.113.0/24", 203, 0, 113, 0, 24),
    range("224.0.0.0/4", 224, 0, 0, 0, 4),
    // 240.0.0.0/4 also covers the limited broadcast address 255.255.255.255.
    range("240.0.0.0/4", 240, 0, 0, 0, 4),
];
const OCTET = /^(?:0|[1-9]\d{0,2})$/;
/** The address as a 32-bit number, or null unless it is four decimal octets 0-255 with no leading zeros. */
export function parseIPv4Strict(text) {
    if (typeof text !== "string" || text.length > 15)
        return null;
    const parts = text.split(".");
    if (parts.length !== 4)
        return null;
    let value = 0;
    for (const part of parts) {
        if (!OCTET.test(part))
            return null;
        const octet = Number(part);
        if (octet > 255)
            return null;
        value = value * 256 + octet;
    }
    return value;
}
/** True only for a strict dotted-quad IPv4 address outside every refused range. Never throws. */
export function isPublicIPv4(text) {
    const value = parseIPv4Strict(text);
    if (value === null)
        return false;
    return !REFUSED_RANGES.some((refused) => value >= refused.first && value <= refused.last);
}
//# sourceMappingURL=ip-class.js.map