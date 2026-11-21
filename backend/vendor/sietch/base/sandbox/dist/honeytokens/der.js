// Just enough DER (ASN.1) to write an RSA private key in PKCS#8 form. Pure.
export function concat(parts) {
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
/** DER length octets: short form below 128, otherwise long form. */
export function derLength(length) {
    if (!Number.isInteger(length) || length < 0 || length > 0xffffff)
        throw new RangeError("bad DER length");
    if (length < 0x80)
        return Uint8Array.of(length);
    if (length <= 0xff)
        return Uint8Array.of(0x81, length);
    if (length <= 0xffff)
        return Uint8Array.of(0x82, length >> 8, length & 0xff);
    return Uint8Array.of(0x83, length >> 16, (length >> 8) & 0xff, length & 0xff);
}
/** Tag, length, content. */
export function tlv(tag, content) {
    return concat([Uint8Array.of(tag), derLength(content.length), content]);
}
/** Big-endian bytes of a non-negative integer, with no leading zero byte (zero is one 0x00 byte). */
export function bigintToBytes(value) {
    if (value < 0n)
        throw new RangeError("negative integer");
    let hex = value.toString(16);
    if (hex.length % 2 === 1)
        hex = `0${hex}`;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}
export function bytesToBigint(bytes) {
    let hex = "";
    for (const b of bytes)
        hex += b.toString(16).padStart(2, "0");
    return hex === "" ? 0n : BigInt(`0x${hex}`);
}
const TAG_INTEGER = 0x02;
const TAG_OCTET_STRING = 0x04;
const TAG_NULL = 0x05;
const TAG_OID = 0x06;
const TAG_SEQUENCE = 0x30;
/** A non-negative INTEGER: a 0x00 byte goes in front when the top bit would make it look negative. */
export function derInteger(value) {
    const bytes = bigintToBytes(value);
    const first = bytes[0] ?? 0;
    return tlv(TAG_INTEGER, first >= 0x80 ? concat([Uint8Array.of(0), bytes]) : bytes);
}
export const derSequence = (content) => tlv(TAG_SEQUENCE, content);
export const derOctetString = (content) => tlv(TAG_OCTET_STRING, content);
export const DER_NULL = Uint8Array.of(TAG_NULL, 0);
/** The `rsaEncryption` algorithm identifier (OID 1.2.840.113549.1.1.1) with NULL parameters. */
export const RSA_ALGORITHM_IDENTIFIER = derSequence(concat([tlv(TAG_OID, Uint8Array.of(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01)), DER_NULL]));
//# sourceMappingURL=der.js.map