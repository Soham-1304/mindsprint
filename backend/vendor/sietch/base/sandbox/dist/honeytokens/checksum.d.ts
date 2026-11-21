export declare const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Random part of a token. */
export declare const ENTROPY_LENGTH = 30;
/** Checksum part of a token. 62^6 is above 2^32, so any CRC32 fits. */
export declare const CHECKSUM_LENGTH = 6;
/** CRC-32 (IEEE 802.3, the one in zlib and gzip) of ASCII text. Throws for any other character. */
export declare function crc32(text: string): number;
/** `value` in base62, left-padded with "0" to `pad` characters. `value` is a non-negative safe integer. */
export declare function base62Encode(value: number, pad: number): string;
/** The 6-character checksum for 30 random base62 characters. */
export declare function checksumOf(entropy: string): string;
/** True if `body` is 30 random characters followed by their correct checksum (36 base62 characters). */
export declare function hasValidChecksum(body: string): boolean;
//# sourceMappingURL=checksum.d.ts.map