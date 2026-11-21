// The checksum scheme shared by npm and GitHub tokens (pure).
//
// GitHub's published scheme (https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/):
// a token is prefix + 30 random base62 characters + a 6-character checksum. The checksum is the CRC32 of
// the 30 random characters (not the prefix), written in base62 with leading zeros as padding. npm adopted
// the same format in 2021. The base62 alphabet is digits, then uppercase, then lowercase.
export const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Random part of a token. */
export const ENTROPY_LENGTH = 30;
/** Checksum part of a token. 62^6 is above 2^32, so any CRC32 fits. */
export const CHECKSUM_LENGTH = 6;
const CRC_TABLE = (() => {
    const table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table.push(c >>> 0);
    }
    return table;
})();
/** CRC-32 (IEEE 802.3, the one in zlib and gzip) of ASCII text. Throws for any other character. */
export function crc32(text) {
    let crc = 0xffffffff;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code > 0x7f)
            throw new RangeError("crc32 input must be ASCII");
        crc = (CRC_TABLE[(crc ^ code) & 0xff] ?? 0) ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
/** `value` in base62, left-padded with "0" to `pad` characters. `value` is a non-negative safe integer. */
export function base62Encode(value, pad) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new RangeError("value must be a non-negative integer");
    let out = "";
    let rest = value;
    while (rest > 0) {
        out = BASE62_ALPHABET.charAt(rest % 62) + out;
        rest = Math.floor(rest / 62);
    }
    return out.padStart(pad, "0");
}
const BASE62_BODY = /^[0-9A-Za-z]+$/;
/** The 6-character checksum for 30 random base62 characters. */
export function checksumOf(entropy) {
    if (entropy.length !== ENTROPY_LENGTH || !BASE62_BODY.test(entropy)) {
        throw new RangeError("entropy must be 30 base62 characters");
    }
    return base62Encode(crc32(entropy), CHECKSUM_LENGTH);
}
/** True if `body` is 30 random characters followed by their correct checksum (36 base62 characters). */
export function hasValidChecksum(body) {
    if (body.length !== ENTROPY_LENGTH + CHECKSUM_LENGTH || !BASE62_BODY.test(body))
        return false;
    return checksumOf(body.slice(0, ENTROPY_LENGTH)) === body.slice(ENTROPY_LENGTH);
}
//# sourceMappingURL=checksum.js.map