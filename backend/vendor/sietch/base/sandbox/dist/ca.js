import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign, X509Certificate, } from "node:crypto";
import { inspect } from "node:util";
import { SietchError } from "@sietch/core";
import { buildCertificate, DerError, isValidDnsName, pemEncode } from "./der.js";
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
export class CaError extends SietchError {
    constructor(message) {
        super("CA_INVALID", message);
    }
}
/** Subject and issuer common name of every per-scan CA. */
export const CA_COMMON_NAME = "Sietch Per-Scan CA";
/** How long a CA and its leaves are valid before and after "now". Scans last minutes; this is generous. */
export const CA_VALIDITY_BEFORE_MS = 60 * 60 * 1000;
export const CA_VALIDITY_AFTER_MS = 24 * 60 * 60 * 1000;
/** At most this many leaf certificates are kept, so a flood of distinct SNI names can't grow memory. */
export const LEAF_CACHE_LIMIT = 512;
const REDACTED = "[redacted]";
const SERIAL_BYTES = 16;
const MAX_PEM_BYTES = 16 * 1024;
/** DER header of a P-256 SubjectPublicKeyInfo, up to the 65-byte uncompressed point. */
const P256_SPKI_PREFIX_HEX = "3059301306072a8648ce3d020106082a8648ce3d030107034200";
const P256_SPKI_BYTES = 91;
const P256_SPKI_PREFIX_BYTES = 26;
const MAX_LEAF_COMMON_NAME = 64;
const SUBJECT_PATTERN = /^CN=([\x20-\x7e]{1,64})$/;
/**
 * A serial source built on an injected random source: 16 bytes, high bit cleared (so the number is
 * positive) and bit 0x40 set (so it is never zero).
 */
export function createSerialSource(random) {
    return () => {
        const bytes = random(SERIAL_BYTES);
        if (!(bytes instanceof Uint8Array) || bytes.length !== SERIAL_BYTES) {
            throw new CaError(`random source must return exactly ${SERIAL_BYTES} bytes`);
        }
        const serial = Uint8Array.from(bytes);
        serial[0] = (serial[0] & 0x3f) | 0x40;
        return serial;
    };
}
/** Production dependencies: the real clock and `node:crypto` randomness. */
export function systemCaDeps() {
    return { now: () => new Date(), serial: createSerialSource((length) => randomBytes(length)) };
}
/** Adds a read-only property that `Object.keys`, spread, `JSON.stringify`, and a plain log of the object skip. */
function addHidden(target, key, value) {
    Object.defineProperty(target, key, { value, enumerable: false, writable: false, configurable: false });
}
/**
 * The private keys are readable properties (`ca.keyPem`, `issuer.leafKeyPem`) that are not enumerable, and
 * both objects print a fixed redacted form. A `logger.info({ ca })`, `JSON.stringify(ca)`, `util.inspect`
 * (even with `showHidden`), or an error that carries the object therefore never writes a key. Copying
 * with `{ ...ca }` drops the key on purpose: pass the object itself when the key is needed.
 */
function sealCa(certPem, keyPem) {
    const ca = { certPem };
    addHidden(ca, "keyPem", keyPem);
    addHidden(ca, "toJSON", () => ({ certPem }));
    addHidden(ca, inspect.custom, () => `Ca { certPem: <${certPem.length} chars>, keyPem: ${REDACTED} }`);
    return ca;
}
function sealLeafIssuer(issuer, leafKeyPem) {
    addHidden(issuer, "leafKeyPem", leafKeyPem);
    addHidden(issuer, "toJSON", () => ({ cacheSize: issuer.cacheSize }));
    addHidden(issuer, inspect.custom, () => `LeafIssuer { cacheSize: ${issuer.cacheSize}, leafKeyPem: ${REDACTED} }`);
    return issuer;
}
function spkiOf(key) {
    const spki = key.export({ type: "spki", format: "der" });
    if (spki.length !== P256_SPKI_BYTES ||
        !spki.subarray(0, P256_SPKI_PREFIX_BYTES).equals(Buffer.from(P256_SPKI_PREFIX_HEX, "hex"))) {
        throw new CaError("key is not a P-256 key");
    }
    return spki;
}
function pkcs8Pem(key) {
    const pem = key.export({ type: "pkcs8", format: "pem" });
    if (typeof pem !== "string")
        throw new CaError("key could not be exported as PEM");
    return pem;
}
/** SHA-1 of the subject public key bits (RFC 5280, method 1). For P-256 these are the last 65 bytes. */
function keyIdOf(spki) {
    return createHash("sha1").update(spki.subarray(P256_SPKI_PREFIX_BYTES)).digest();
}
function signer(privateKey) {
    return (tbs) => sign("sha256", tbs, { key: privateKey, dsaEncoding: "der" });
}
/** Runs a certificate build and reports any `DerError` as a `CaError`, so callers see one error type. */
function guarded(build) {
    try {
        return build();
    }
    catch (error) {
        if (error instanceof DerError)
            throw new CaError(`certificate could not be built: ${error.message}`);
        throw error;
    }
}
function checkDeps(deps) {
    if (typeof deps?.now !== "function" || typeof deps?.serial !== "function") {
        throw new CaError("now and serial must be functions");
    }
}
function validity(deps) {
    const now = deps.now();
    if (!(now instanceof Date) || Number.isNaN(now.getTime()))
        throw new CaError("now() must return a valid Date");
    return {
        notBefore: new Date(now.getTime() - CA_VALIDITY_BEFORE_MS),
        notAfter: new Date(now.getTime() + CA_VALIDITY_AFTER_MS),
    };
}
/** Makes a fresh P-256 key pair and a self-signed CA certificate. */
export function createCa(deps) {
    checkDeps(deps);
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const spki = spkiOf(publicKey);
    const keyId = keyIdOf(spki);
    const { notBefore, notAfter } = validity(deps);
    const der = guarded(() => buildCertificate({
        subjectCommonName: CA_COMMON_NAME,
        issuerCommonName: CA_COMMON_NAME,
        subjectPublicKeyInfo: spki,
        serial: deps.serial(),
        notBefore,
        notAfter,
        isCa: true,
        dnsNames: [],
        subjectKeyId: keyId,
        issuerKeyId: keyId,
        sign: signer(privateKey),
    }));
    return sealCa(pemEncode("CERTIFICATE", der), pkcs8Pem(privateKey));
}
function parseCa(certPem, keyPem) {
    if (typeof certPem !== "string" || typeof keyPem !== "string")
        throw new CaError("CA PEM must be strings");
    if (certPem.length === 0 ||
        certPem.length > MAX_PEM_BYTES ||
        keyPem.length === 0 ||
        keyPem.length > MAX_PEM_BYTES) {
        throw new CaError("CA PEM has an unexpected size");
    }
    let certificate;
    let privateKey;
    try {
        certificate = new X509Certificate(certPem);
        privateKey = createPrivateKey(keyPem);
    }
    catch {
        throw new CaError("CA certificate or key could not be parsed");
    }
    // These checks fail closed: any doubt that this is our CA and its own key is a hard error.
    if (certificate.ca !== true)
        throw new CaError("certificate is not a CA");
    if (!certificate.checkPrivateKey(privateKey))
        throw new CaError("CA key does not match the certificate");
    spkiOf(certificate.publicKey);
    if (!certificate.verify(certificate.publicKey))
        throw new CaError("CA certificate is not self-signed");
    const subject = SUBJECT_PATTERN.exec(certificate.subject);
    if (subject === null || certificate.subject !== certificate.issuer) {
        throw new CaError("CA subject must be a single common name equal to the issuer");
    }
    return { certificate, privateKey, commonName: subject[1] };
}
/**
 * Parses a CA and checks it. Throws `CaError` unless the certificate is a self-signed P-256 CA and the
 * key is its private key. Returns the same PEM strings, so the result is proof of validity.
 */
export function loadCa(certPem, keyPem) {
    parseCa(certPem, keyPem);
    return sealCa(certPem, keyPem);
}
/**
 * Makes a leaf issuer. One P-256 key is shared by all leaves, so minting a certificate costs one
 * signature. The CA is re-validated here, so a bad pair never signs anything.
 */
export function createLeafIssuer(ca, deps) {
    checkDeps(deps);
    const { certificate, privateKey: caKey, commonName } = parseCa(ca?.certPem, ca?.keyPem);
    const caKeyId = keyIdOf(spkiOf(certificate.publicKey));
    const caNotAfter = certificate.validToDate;
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const leafSpki = spkiOf(publicKey);
    const leafKeyId = keyIdOf(leafSpki);
    const signWithCa = signer(caKey);
    const cache = new Map();
    const issuer = {
        get cacheSize() {
            return cache.size;
        },
        mint(hostname) {
            // The SNI name comes from the package under test. Validate before anything else uses it.
            if (!isValidDnsName(hostname))
                throw new CaError("invalid host name");
            const name = hostname.toLowerCase();
            const cached = cache.get(name);
            if (cached !== undefined)
                return { certPem: cached };
            const window = validity(deps);
            // A leaf never outlives its CA.
            const notAfter = window.notAfter.getTime() > caNotAfter.getTime() ? caNotAfter : window.notAfter;
            const der = guarded(() => buildCertificate({
                subjectCommonName: name.length <= MAX_LEAF_COMMON_NAME ? name : null,
                issuerCommonName: commonName,
                subjectPublicKeyInfo: leafSpki,
                serial: deps.serial(),
                notBefore: window.notBefore,
                notAfter,
                isCa: false,
                dnsNames: [name],
                subjectKeyId: leafKeyId,
                issuerKeyId: caKeyId,
                sign: signWithCa,
            }));
            const certPem = pemEncode("CERTIFICATE", der);
            if (cache.size >= LEAF_CACHE_LIMIT) {
                const oldest = cache.keys().next();
                if (!oldest.done)
                    cache.delete(oldest.value);
            }
            cache.set(name, certPem);
            return { certPem };
        },
    };
    return sealLeafIssuer(issuer, pkcs8Pem(privateKey));
}
//# sourceMappingURL=ca.js.map