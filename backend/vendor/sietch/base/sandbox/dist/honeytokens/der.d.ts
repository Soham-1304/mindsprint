export declare function concat(parts: readonly Uint8Array[]): Uint8Array;
/** DER length octets: short form below 128, otherwise long form. */
export declare function derLength(length: number): Uint8Array;
/** Tag, length, content. */
export declare function tlv(tag: number, content: Uint8Array): Uint8Array;
/** Big-endian bytes of a non-negative integer, with no leading zero byte (zero is one 0x00 byte). */
export declare function bigintToBytes(value: bigint): Uint8Array;
export declare function bytesToBigint(bytes: Uint8Array): bigint;
/** A non-negative INTEGER: a 0x00 byte goes in front when the top bit would make it look negative. */
export declare function derInteger(value: bigint): Uint8Array;
export declare const derSequence: (content: Uint8Array) => Uint8Array;
export declare const derOctetString: (content: Uint8Array) => Uint8Array;
export declare const DER_NULL: Uint8Array;
/** The `rsaEncryption` algorithm identifier (OID 1.2.840.113549.1.1.1) with NULL parameters. */
export declare const RSA_ALGORITHM_IDENTIFIER: Uint8Array;
//# sourceMappingURL=der.d.ts.map