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
export declare class DerError extends SietchError {
    constructor(message: string);
}
/** ecdsa-with-SHA256 (RFC 5758). */
export declare const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
/**
 * True for a hostname that is safe to put in a certificate: ASCII letters, digits, `_` and `-`, labels of
 * 1 to 63 characters separated by single dots, at most 253 characters in all, no trailing dot, no wildcard.
 * The last label may not be all digits, which also rules out IPv4 literals such as `1.2.3.4`.
 */
export declare function isValidDnsName(name: unknown): name is string;
export declare function concatBytes(parts: readonly Uint8Array[]): Uint8Array;
/** Definite-length header: short form below 128, otherwise 0x81, 0x82, 0x83, or 0x84 plus big-endian bytes. */
export declare function encodeLength(length: number): Uint8Array;
/** One tag byte, a definite length, and the concatenated parts. */
export declare function tlv(tag: number, ...parts: readonly Uint8Array[]): Uint8Array;
export declare function sequence(...parts: readonly Uint8Array[]): Uint8Array;
export declare function set(...parts: readonly Uint8Array[]): Uint8Array;
/** An OBJECT IDENTIFIER from dotted decimal text such as `1.2.840.10045.4.3.2`. */
export declare function oid(dotted: string): Uint8Array;
/**
 * A non-negative INTEGER from big-endian magnitude bytes. Redundant leading zero bytes are removed and a
 * zero byte is added when the high bit would otherwise make the value negative.
 */
export declare function integer(magnitude: Uint8Array): Uint8Array;
export declare function bool(value: boolean): Uint8Array;
export declare function octetString(bytes: Uint8Array): Uint8Array;
/** A BIT STRING. `unusedBits` is the number of unused low bits of the last byte (0 to 7). */
export declare function bitString(bytes: Uint8Array, unusedBits?: number): Uint8Array;
export declare function utf8String(text: string): Uint8Array;
/** An IA5String (ASCII). `tag` defaults to the universal IA5String tag; GeneralName entries pass their own. */
export declare function ia5String(text: string, tag?: number): Uint8Array;
/** UTCTime for years 1950 to 2049, GeneralizedTime for every other year (RFC 5280, section 4.1.2.5). */
export declare function timeValue(date: Date): Uint8Array;
/** PEM text with 64-column lines and a trailing newline. */
export declare function pemEncode(label: string, der: Uint8Array): string;
export interface BuildCertificateParams {
    /** Common name of the subject. `null` is allowed for a leaf only, which then has an empty subject name. */
    readonly subjectCommonName: string | null;
    readonly issuerCommonName: string;
    /** DER bytes of the subject's SubjectPublicKeyInfo. */
    readonly subjectPublicKeyInfo: Uint8Array;
    /** Big-endian serial number bytes. Must be positive and encode to at most 20 bytes. */
    readonly serial: Uint8Array;
    readonly notBefore: Date;
    readonly notAfter: Date;
    readonly isCa: boolean;
    /** Required (at least one) for a leaf, and must be empty for a CA. */
    readonly dnsNames: readonly string[];
    /** 20-byte key identifier of the subject key. */
    readonly subjectKeyId: Uint8Array;
    /** 20-byte key identifier of the issuer key. Equal to `subjectKeyId` for a self-signed CA. */
    readonly issuerKeyId: Uint8Array;
    /** Signs the DER of the TBSCertificate with ECDSA-SHA256 and returns the DER-encoded signature. */
    readonly sign: (tbsCertificate: Uint8Array) => Uint8Array;
}
/** Builds and signs an X.509 v3 certificate. Returns its DER bytes. */
export declare function buildCertificate(params: BuildCertificateParams): Uint8Array;
//# sourceMappingURL=der.d.ts.map