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
export interface RefusedRange {
    /** CIDR text, for tests and documentation. */
    readonly cidr: string;
    readonly first: number;
    readonly last: number;
}
export declare const REFUSED_RANGES: readonly RefusedRange[];
/** The address as a 32-bit number, or null unless it is four decimal octets 0-255 with no leading zeros. */
export declare function parseIPv4Strict(text: unknown): number | null;
/** True only for a strict dotted-quad IPv4 address outside every refused range. Never throws. */
export declare function isPublicIPv4(text: unknown): boolean;
//# sourceMappingURL=ip-class.d.ts.map