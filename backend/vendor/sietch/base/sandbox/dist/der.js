import { SietchError } from "@sietch/core";
/**
 * A small DER encoder and an X.509 v3 certificate builder. Pure: no `node:` imports, no clock, no
 * randomness, no key handling. The caller passes the public key as SPKI bytes, the serial, the key ids,
 * and a `sign` callback, so a fixed input always produces the same certificate and the module can be
 * tested with a fake signer. `ca.ts` supplies the real ECDSA signer.
 *
 * Every value that goes into a certificate is validated first. A bad value throws `DerError`; the
 * encoder never returns a malformed buffer. Sizes are checked before anything is encoded.
 */
export class DerError extends SietchError {
    constructor(message) {
        super("DER_INVALID", message);
    }
}
/** ecdsa-with-SHA256 (RFC 5758). */
export const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const TAG_BOOLEAN = 0x01;
const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_OCTET_STRING = 0x04;
const TAG_OID = 0x06;
const TAG_UTF8_STRING = 0x0c;
const TAG_IA5_STRING = 0x16;
const TAG_UTC_TIME = 0x17;
const TAG_GENERALIZED_TIME = 0x18;
const TAG_SEQUENCE = 0x30;
const TAG_SET = 0x31;
/** `[0]` constructed: the explicit version wrapper. */
const TAG_CONTEXT_0_CONSTRUCTED = 0xa0;
/** `[3]` constructed: the explicit extensions wrapper. */
const TAG_CONTEXT_3_CONSTRUCTED = 0xa3;
/** `[0]` primitive, implicit: `AuthorityKeyIdentifier.keyIdentifier`. */
const TAG_CONTEXT_0_PRIMITIVE = 0x80;
/** `[2]` primitive, implicit: `GeneralName.dNSName`. */
const TAG_CONTEXT_2_PRIMITIVE = 0x82;
const OID_COMMON_NAME = "2.5.4.3";
const OID_SUBJECT_KEY_ID = "2.5.29.14";
const OID_KEY_USAGE = "2.5.29.15";
const OID_SUBJECT_ALT_NAME = "2.5.29.17";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";
const OID_AUTHORITY_KEY_ID = "2.5.29.35";
const OID_EXT_KEY_USAGE = "2.5.29.37";
const OID_SERVER_AUTH = "1.3.6.1.5.5.7.3.1";
const MAX_LENGTH = 0xffffffff;
/** RFC 5280: a serial number is at most 20 octets, including the leading zero byte. */
const MAX_SERIAL_CONTENT_BYTES = 20;
/** A SHA-1 key identifier (RFC 5280, method 1). */
const KEY_ID_BYTES = 20;
const MAX_COMMON_NAME_LENGTH = 64;
const MAX_SIGNATURE_BYTES = 256;
const MAX_SPKI_BYTES = 1024;
const MAX_DNS_NAMES = 64;
const MAX_DNS_NAME_LENGTH = 253;
const MAX_DNS_LABEL_LENGTH = 63;
const DNS_LABEL_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALL_DIGITS_PATTERN = /^[0-9]+$/;
const COMMON_NAME_PATTERN = /^[\x20-\x7e]+$/;
const OID_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*))+$/;
const PEM_LABEL_PATTERN = /^[A-Z0-9][A-Z0-9 ]*$/;
/**
 * True for a hostname that is safe to put in a certificate: ASCII letters, digits, `_` and `-`, labels of
 * 1 to 63 characters separated by single dots, at most 253 characters in all, no trailing dot, no wildcard.
 * The last label may not be all digits, which also rules out IPv4 literals such as `1.2.3.4`.
 */
export function isValidDnsName(name) {
    if (typeof name !== "string" || name.length === 0 || name.length > MAX_DNS_NAME_LENGTH)
        return false;
    const labels = name.split(".");
    for (const label of labels) {
        if (label.length === 0 || label.length > MAX_DNS_LABEL_LENGTH)
            return false;
        if (!DNS_LABEL_PATTERN.test(label))
            return false;
    }
    const last = labels[labels.length - 1] ?? "";
    return !ALL_DIGITS_PATTERN.test(last);
}
function assertBytes(value, what) {
    if (!(value instanceof Uint8Array))
        throw new DerError(`${what} must be a Uint8Array`);
}
export function concatBytes(parts) {
    let total = 0;
    for (const part of parts)
        total += part.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
/** Definite-length header: short form below 128, otherwise 0x81, 0x82, 0x83, or 0x84 plus big-endian bytes. */
export function encodeLength(length) {
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_LENGTH) {
        throw new DerError("length must be an integer from 0 to 4294967295");
    }
    if (length < 0x80)
        return Uint8Array.of(length);
    const bytes = [];
    for (let rest = length; rest > 0; rest = Math.floor(rest / 256))
        bytes.unshift(rest % 256);
    return Uint8Array.of(0x80 | bytes.length, ...bytes);
}
/** One tag byte, a definite length, and the concatenated parts. */
export function tlv(tag, ...parts) {
    if (!Number.isInteger(tag) || tag < 0 || tag > 0xff)
        throw new DerError("tag must be one byte");
    for (const part of parts)
        assertBytes(part, "TLV content");
    const body = concatBytes(parts);
    return concatBytes([Uint8Array.of(tag), encodeLength(body.length), body]);
}
export function sequence(...parts) {
    return tlv(TAG_SEQUENCE, ...parts);
}
export function set(...parts) {
    return tlv(TAG_SET, ...parts);
}
function base128(value) {
    const out = [value % 128];
    for (let rest = Math.floor(value / 128); rest > 0; rest = Math.floor(rest / 128)) {
        out.unshift((rest % 128) | 0x80);
    }
    return out;
}
/** An OBJECT IDENTIFIER from dotted decimal text such as `1.2.840.10045.4.3.2`. */
export function oid(dotted) {
    if (typeof dotted !== "string" || !OID_PATTERN.test(dotted))
        throw new DerError("invalid OID syntax");
    const arcs = dotted.split(".").map(Number);
    for (const arc of arcs) {
        if (!Number.isSafeInteger(arc))
            throw new DerError("OID arc is too large");
    }
    const first = arcs[0];
    const second = arcs[1];
    if (first > 2)
        throw new DerError("OID first arc must be 0, 1, or 2");
    if (first < 2 && second > 39)
        throw new DerError("OID second arc must be at most 39 under arcs 0 and 1");
    const body = [...base128(first * 40 + second)];
    for (const arc of arcs.slice(2))
        body.push(...base128(arc));
    return tlv(TAG_OID, Uint8Array.from(body));
}
/**
 * A non-negative INTEGER from big-endian magnitude bytes. Redundant leading zero bytes are removed and a
 * zero byte is added when the high bit would otherwise make the value negative.
 */
export function integer(magnitude) {
    assertBytes(magnitude, "INTEGER");
    if (magnitude.length === 0)
        throw new DerError("INTEGER must have at least one byte");
    let start = 0;
    while (start < magnitude.length - 1 && magnitude[start] === 0)
        start++;
    const trimmed = magnitude.subarray(start);
    const needsPad = (trimmed[0] & 0x80) !== 0;
    return tlv(TAG_INTEGER, needsPad ? Uint8Array.of(0) : new Uint8Array(0), trimmed);
}
export function bool(value) {
    return tlv(TAG_BOOLEAN, Uint8Array.of(value ? 0xff : 0x00));
}
export function octetString(bytes) {
    assertBytes(bytes, "OCTET STRING");
    return tlv(TAG_OCTET_STRING, bytes);
}
/** A BIT STRING. `unusedBits` is the number of unused low bits of the last byte (0 to 7). */
export function bitString(bytes, unusedBits = 0) {
    assertBytes(bytes, "BIT STRING");
    if (!Number.isInteger(unusedBits) || unusedBits < 0 || unusedBits > 7) {
        throw new DerError("unused bits must be an integer from 0 to 7");
    }
    if (bytes.length === 0 && unusedBits !== 0)
        throw new DerError("an empty BIT STRING has no unused bits");
    return tlv(TAG_BIT_STRING, Uint8Array.of(unusedBits), bytes);
}
export function utf8String(text) {
    if (typeof text !== "string")
        throw new DerError("UTF8String must be a string");
    return tlv(TAG_UTF8_STRING, new TextEncoder().encode(text));
}
/** An IA5String (ASCII). `tag` defaults to the universal IA5String tag; GeneralName entries pass their own. */
export function ia5String(text, tag = TAG_IA5_STRING) {
    if (typeof text !== "string")
        throw new DerError("IA5String must be a string");
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code > 0x7f)
            throw new DerError("IA5String must be ASCII");
        bytes[i] = code;
    }
    return tlv(tag, bytes);
}
function pad(value, width) {
    return String(value).padStart(width, "0");
}
/** UTCTime for years 1950 to 2049, GeneralizedTime for every other year (RFC 5280, section 4.1.2.5). */
export function timeValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime()))
        throw new DerError("time must be a valid Date");
    const year = date.getUTCFullYear();
    if (year < 0 || year > 9999)
        throw new DerError("time year must be from 0 to 9999");
    const rest = `${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}${pad(date.getUTCHours(), 2)}${pad(date.getUTCMinutes(), 2)}${pad(date.getUTCSeconds(), 2)}Z`;
    if (year >= 1950 && year <= 2049) {
        return tlv(TAG_UTC_TIME, new TextEncoder().encode(`${pad(year % 100, 2)}${rest}`));
    }
    return tlv(TAG_GENERALIZED_TIME, new TextEncoder().encode(`${pad(year, 4)}${rest}`));
}
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = bytes[i + 1];
        const c = bytes[i + 2];
        const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
        out += BASE64_ALPHABET[(triple >> 18) & 63];
        out += BASE64_ALPHABET[(triple >> 12) & 63];
        out += b === undefined ? "=" : BASE64_ALPHABET[(triple >> 6) & 63];
        out += c === undefined ? "=" : BASE64_ALPHABET[triple & 63];
    }
    return out;
}
/** PEM text with 64-column lines and a trailing newline. */
export function pemEncode(label, der) {
    if (typeof label !== "string" || !PEM_LABEL_PATTERN.test(label))
        throw new DerError("invalid PEM label");
    assertBytes(der, "PEM body");
    if (der.length === 0)
        throw new DerError("PEM body must not be empty");
    const encoded = base64(der);
    const lines = [];
    for (let i = 0; i < encoded.length; i += 64)
        lines.push(encoded.slice(i, i + 64));
    return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}
function assertCommonName(value, what) {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_COMMON_NAME_LENGTH) {
        throw new DerError(`${what} must be 1 to ${MAX_COMMON_NAME_LENGTH} characters`);
    }
    if (!COMMON_NAME_PATTERN.test(value))
        throw new DerError(`${what} must be printable ASCII`);
}
function commonNameField(value) {
    if (value === null)
        return sequence();
    return sequence(set(sequence(oid(OID_COMMON_NAME), utf8String(value))));
}
function extension(extnId, critical, value) {
    return sequence(oid(extnId), ...(critical ? [bool(true)] : []), octetString(value));
}
/** Checks that `spki` is one complete DER SEQUENCE: tag, a well-formed length, and no trailing bytes. */
function assertSequence(spki) {
    if (spki.length < 2 || spki.length > MAX_SPKI_BYTES || spki[0] !== TAG_SEQUENCE) {
        throw new DerError("public key info must be a DER SEQUENCE");
    }
    const first = spki[1];
    let headerLength = 2;
    let contentLength = first;
    if (first >= 0x80) {
        const count = first & 0x7f;
        if (count < 1 || count > 4 || spki.length < 2 + count)
            throw new DerError("public key info has a bad length");
        contentLength = 0;
        for (let i = 0; i < count; i++)
            contentLength = contentLength * 256 + spki[2 + i];
        headerLength = 2 + count;
    }
    if (headerLength + contentLength !== spki.length)
        throw new DerError("public key info has a bad length");
}
function assertKeyId(value, what) {
    assertBytes(value, what);
    if (value.length !== KEY_ID_BYTES)
        throw new DerError(`${what} must be ${KEY_ID_BYTES} bytes`);
}
/** Builds and signs an X.509 v3 certificate. Returns its DER bytes. */
export function buildCertificate(params) {
    const { isCa, dnsNames } = params;
    if (typeof isCa !== "boolean")
        throw new DerError("isCa must be a boolean");
    if (typeof params.sign !== "function")
        throw new DerError("sign must be a function");
    assertCommonName(params.issuerCommonName, "issuer common name");
    if (isCa || params.subjectCommonName !== null)
        assertCommonName(params.subjectCommonName, "subject common name");
    assertBytes(params.subjectPublicKeyInfo, "public key info");
    assertSequence(params.subjectPublicKeyInfo);
    assertBytes(params.serial, "serial");
    assertKeyId(params.subjectKeyId, "subject key id");
    assertKeyId(params.issuerKeyId, "issuer key id");
    if (!(params.notBefore instanceof Date) || !(params.notAfter instanceof Date)) {
        throw new DerError("validity dates must be Date objects");
    }
    if (!(params.notBefore.getTime() < params.notAfter.getTime())) {
        throw new DerError("notBefore must be earlier than notAfter");
    }
    if (isCa) {
        if (dnsNames.length !== 0)
            throw new DerError("a CA certificate must not have DNS names");
    }
    else {
        if (dnsNames.length === 0 || dnsNames.length > MAX_DNS_NAMES) {
            throw new DerError(`a leaf certificate needs 1 to ${MAX_DNS_NAMES} DNS names`);
        }
        for (const name of dnsNames) {
            if (!isValidDnsName(name))
                throw new DerError("invalid DNS name");
        }
    }
    const serialInteger = integer(params.serial);
    const serialIsZero = params.serial.every((byte) => byte === 0);
    // `serialInteger` is tag + one length byte + content for any serial up to 20 bytes. A longer serial gives a
    // larger value, so the content check below still rejects it.
    if (serialIsZero ||
        serialInteger.length - 2 > MAX_SERIAL_CONTENT_BYTES ||
        (params.serial[0] & 0x80) !== 0) {
        throw new DerError("serial must be positive, have the high bit clear, and fit in 20 bytes");
    }
    const extensions = [
        extension(OID_SUBJECT_KEY_ID, false, octetString(params.subjectKeyId)),
        extension(OID_AUTHORITY_KEY_ID, false, sequence(tlv(TAG_CONTEXT_0_PRIMITIVE, params.issuerKeyId))),
    ];
    if (isCa) {
        // pathLenConstraint 0: this CA signs leaves only.
        extensions.push(extension(OID_BASIC_CONSTRAINTS, true, sequence(bool(true), integer(Uint8Array.of(0)))));
        // keyCertSign (bit 5) and cRLSign (bit 6).
        extensions.push(extension(OID_KEY_USAGE, true, bitString(Uint8Array.of(0x06), 1)));
    }
    else {
        extensions.push(extension(OID_BASIC_CONSTRAINTS, true, sequence()));
        // digitalSignature (bit 0).
        extensions.push(extension(OID_KEY_USAGE, true, bitString(Uint8Array.of(0x80), 7)));
        extensions.push(extension(OID_EXT_KEY_USAGE, false, sequence(oid(OID_SERVER_AUTH))));
        const names = dnsNames.map((name) => ia5String(name, TAG_CONTEXT_2_PRIMITIVE));
        // RFC 5280: the subject alternative name must be critical when the subject name is empty.
        extensions.push(extension(OID_SUBJECT_ALT_NAME, params.subjectCommonName === null, sequence(...names)));
    }
    const signatureAlgorithm = sequence(oid(OID_ECDSA_SHA256));
    const tbsCertificate = sequence(tlv(TAG_CONTEXT_0_CONSTRUCTED, integer(Uint8Array.of(2))), serialInteger, signatureAlgorithm, commonNameField(params.issuerCommonName), sequence(timeValue(params.notBefore), timeValue(params.notAfter)), commonNameField(params.subjectCommonName), params.subjectPublicKeyInfo, tlv(TAG_CONTEXT_3_CONSTRUCTED, sequence(...extensions)));
    const signature = params.sign(tbsCertificate);
    assertBytes(signature, "signature");
    if (signature.length === 0 || signature.length > MAX_SIGNATURE_BYTES) {
        throw new DerError(`signature must be 1 to ${MAX_SIGNATURE_BYTES} bytes`);
    }
    return sequence(tbsCertificate, signatureAlgorithm, bitString(signature));
}
//# sourceMappingURL=der.js.map