// A fake RSA private key whose every random bit comes from the injected rng.
//
// node:crypto's own key generation can't take a seed, which would make the GCP fake differ between two
// runs with the same rng. Here the rng supplies the candidates for p and q, and node:crypto's native
// primality test (`checkPrimeSync`) decides which are prime. The result is a real, working 2048-bit key
// (a signature made with it verifies). It protects nothing: it is generated per scan, used nowhere, and
// never leaves the sandbox.
import { checkPrimeSync } from "node:crypto";
import { FakeEnvironmentError } from "../errors.js";
import { drawBytes } from "../rng.js";
import { bytesToBigint, concat, derInteger, derOctetString, derSequence, RSA_ALGORITHM_IDENTIFIER, } from "./der.js";
export const RSA_BITS = 2048;
const PUBLIC_EXPONENT = 65537n;
function modInverse(a, modulus) {
    let [r0, r1] = [modulus, ((a % modulus) + modulus) % modulus];
    let [t0, t1] = [0n, 1n];
    while (r1 !== 0n) {
        const quotient = r0 / r1;
        [r0, r1] = [r1, r0 - quotient * r1];
        [t0, t1] = [t1, t0 - quotient * t1];
    }
    if (r0 !== 1n)
        throw new FakeEnvironmentError("RSA parameters are not coprime");
    return ((t0 % modulus) + modulus) % modulus;
}
const MAX_CANDIDATES = 50_000;
/** A prime of exactly `bits` bits with its top two bits set, so p * q has exactly 2 * bits bits. */
function randomPrime(rng, bits) {
    const length = bits / 8;
    for (let attempt = 0; attempt < MAX_CANDIDATES; attempt++) {
        const bytes = drawBytes(rng, length).slice();
        bytes[0] = (bytes[0] ?? 0) | 0xc0;
        bytes[length - 1] = (bytes[length - 1] ?? 0) | 1;
        const candidate = bytesToBigint(bytes);
        if ((candidate - 1n) % PUBLIC_EXPONENT === 0n)
            continue;
        if (checkPrimeSync(candidate))
            return candidate;
    }
    throw new FakeEnvironmentError("could not find a prime from the random source");
}
export function generateRsaKey(rng) {
    let p = randomPrime(rng, RSA_BITS / 2);
    let q = randomPrime(rng, RSA_BITS / 2);
    // Two equal primes only happen with a broken source. Retry a few times, then give up (never loop).
    for (let retry = 0; q === p && retry < 4; retry++)
        q = randomPrime(rng, RSA_BITS / 2);
    if (q === p)
        throw new FakeEnvironmentError("the random source repeats itself");
    if (p < q)
        [p, q] = [q, p];
    const d = modInverse(PUBLIC_EXPONENT, (p - 1n) * (q - 1n));
    return {
        n: p * q,
        e: PUBLIC_EXPONENT,
        d,
        p,
        q,
        dp: d % (p - 1n),
        dq: d % (q - 1n),
        qinv: modInverse(q, p),
    };
}
/** True if every part of the key agrees with the others: p and q prime, n = p*q, d inverts e, and the CRT values fit. */
export function isConsistent(key) {
    const { n, e, d, p, q, dp, dq, qinv } = key;
    return (p !== q &&
        checkPrimeSync(p) &&
        checkPrimeSync(q) &&
        n === p * q &&
        n.toString(2).length === RSA_BITS &&
        (d * e) % (p - 1n) === 1n &&
        (d * e) % (q - 1n) === 1n &&
        dp === d % (p - 1n) &&
        dq === d % (q - 1n) &&
        (q * qinv) % p === 1n);
}
/** PKCS#8 (`BEGIN PRIVATE KEY`) encoding, and the offset where the secret fields start. */
export function encodePkcs8(key) {
    const version = derInteger(0n);
    const n = derInteger(key.n);
    const e = derInteger(key.e);
    const secret = concat([
        derInteger(key.d),
        derInteger(key.p),
        derInteger(key.q),
        derInteger(key.dp),
        derInteger(key.dq),
        derInteger(key.qinv),
    ]);
    const rsaBody = concat([version, n, e, secret]);
    const rsaSequence = derSequence(rsaBody);
    const octets = derOctetString(rsaSequence);
    const infoBody = concat([version, RSA_ALGORITHM_IDENTIFIER, octets]);
    const info = derSequence(infoBody);
    const privateOffset = info.length -
        infoBody.length +
        version.length +
        RSA_ALGORITHM_IDENTIFIER.length +
        (octets.length - rsaSequence.length) +
        (rsaSequence.length - rsaBody.length) +
        version.length +
        n.length +
        e.length;
    return { der: info, privateOffset };
}
//# sourceMappingURL=rsa.js.map