import { type Rng } from "../rng.js";
export declare const RSA_BITS = 2048;
export interface RsaKey {
    readonly n: bigint;
    readonly e: bigint;
    readonly d: bigint;
    readonly p: bigint;
    readonly q: bigint;
    readonly dp: bigint;
    readonly dq: bigint;
    readonly qinv: bigint;
}
export declare function generateRsaKey(rng: Rng): RsaKey;
/** True if every part of the key agrees with the others: p and q prime, n = p*q, d inverts e, and the CRT values fit. */
export declare function isConsistent(key: RsaKey): boolean;
export interface EncodedKey {
    /** PKCS#8 PrivateKeyInfo, DER. */
    readonly der: Uint8Array;
    /** Where the private exponent starts in `der`. Everything from here on is secret and random. */
    readonly privateOffset: number;
}
/** PKCS#8 (`BEGIN PRIVATE KEY`) encoding, and the offset where the secret fields start. */
export declare function encodePkcs8(key: RsaKey): EncodedKey;
//# sourceMappingURL=rsa.d.ts.map