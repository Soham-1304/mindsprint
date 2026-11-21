import { SietchError } from "@sietch/core";
/**
 * A per-scan certificate authority and a leaf issuer for the registry proxy and the fetch container.
 *
 * The CA lives for one scan. Its private key is held by the runner and is handed only to the TLS
 * terminating side that must mint certificates for the SNI names the package asks for; it is never
 * written to the detonation container. Only the CA certificate (public) is installed in the container's
 * trust store.
 *
 * The SNI name is chosen by the package under test, so it is hostile input. `mint` validates it
 * strictly before it reaches a certificate. Time and serial numbers are injected, so a fixed seed gives
 * a fixed certificate. Key generation uses `node:crypto` and is the only source of randomness that is not
 * injected, which is why tests check key properties and never compare key bytes.
 */
export declare class CaError extends SietchError {
    constructor(message: string);
}
/** Subject and issuer common name of every per-scan CA. */
export declare const CA_COMMON_NAME = "Sietch Per-Scan CA";
/** How long a CA and its leaves are valid before and after "now". Scans last minutes; this is generous. */
export declare const CA_VALIDITY_BEFORE_MS: number;
export declare const CA_VALIDITY_AFTER_MS: number;
/** At most this many leaf certificates are kept, so a flood of distinct SNI names can't grow memory. */
export declare const LEAF_CACHE_LIMIT = 512;
export interface CaDeps {
    /** Wall clock. */
    readonly now: () => Date;
    /** One new serial number per call: 1 to 20 big-endian bytes, positive, high bit clear. */
    readonly serial: () => Uint8Array;
}
export interface Ca {
    /** PEM of the self-signed CA certificate. Public. */
    readonly certPem: string;
    /** PKCS#8 PEM of the CA private key. Secret: never log it and never put it in a container. */
    readonly keyPem: string;
}
export interface LeafIssuer {
    /** PKCS#8 PEM of the one P-256 key shared by every leaf this issuer signs. Secret. */
    readonly leafKeyPem: string;
    /** A leaf certificate for `hostname`, signed by the CA. Throws `CaError` for an invalid name. */
    mint(hostname: string): {
        readonly certPem: string;
    };
    /** Number of leaves currently cached. At most `LEAF_CACHE_LIMIT`. */
    readonly cacheSize: number;
}
/**
 * A serial source built on an injected random source: 16 bytes, high bit cleared (so the number is
 * positive) and bit 0x40 set (so it is never zero).
 */
export declare function createSerialSource(random: (length: number) => Uint8Array): () => Uint8Array;
/** Production dependencies: the real clock and `node:crypto` randomness. */
export declare function systemCaDeps(): CaDeps;
/** Makes a fresh P-256 key pair and a self-signed CA certificate. */
export declare function createCa(deps: CaDeps): Ca;
/**
 * Parses a CA and checks it. Throws `CaError` unless the certificate is a self-signed P-256 CA and the
 * key is its private key. Returns the same PEM strings, so the result is proof of validity.
 */
export declare function loadCa(certPem: string, keyPem: string): Ca;
/**
 * Makes a leaf issuer. One P-256 key is shared by all leaves, so minting a certificate costs one
 * signature. The CA is re-validated here, so a bad pair never signs anything.
 */
export declare function createLeafIssuer(ca: Ca, deps: CaDeps): LeafIssuer;
//# sourceMappingURL=ca.d.ts.map