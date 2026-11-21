// Pure encoders over byte strings: strings where every character code is 0-255, one per byte.
// No Buffer, TextEncoder, or atob, because base/core has no Node or DOM APIs.
const STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** RFC 4648 base64 with "=" padding. Character codes above 255 are not valid input. */
export function base64Encode(bytes, alphabet = "std") {
    const table = alphabet === "std" ? STD : URL_SAFE;
    let out = "";
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
        const n = (byteAt(bytes, i) << 16) | (byteAt(bytes, i + 1) << 8) | byteAt(bytes, i + 2);
        out +=
            table.charAt((n >> 18) & 63) +
                table.charAt((n >> 12) & 63) +
                table.charAt((n >> 6) & 63) +
                table.charAt(n & 63);
    }
    const rest = bytes.length - i;
    if (rest === 1) {
        const n = byteAt(bytes, i) << 16;
        out += `${table.charAt((n >> 18) & 63)}${table.charAt((n >> 12) & 63)}==`;
    }
    else if (rest === 2) {
        const n = (byteAt(bytes, i) << 16) | (byteAt(bytes, i + 1) << 8);
        out += `${table.charAt((n >> 18) & 63)}${table.charAt((n >> 12) & 63)}${table.charAt((n >> 6) & 63)}=`;
    }
    return out;
}
/** Lowercase hexadecimal. */
export function hexEncode(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++)
        out += byteAt(bytes, i).toString(16).padStart(2, "0");
    return out;
}
/** Lenient percent-decoding: "%XX" with two hex digits becomes that byte; everything else is kept. */
export function percentDecode(text) {
    if (!text.includes("%"))
        return text;
    let out = "";
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "%" && i + 2 < text.length && isHex(text.charCodeAt(i + 1)) && isHex(text.charCodeAt(i + 2))) {
            out += String.fromCharCode(Number.parseInt(text.slice(i + 1, i + 3), 16));
            i += 2;
        }
        else {
            out += c;
        }
    }
    return out;
}
function byteAt(bytes, index) {
    const code = bytes.charCodeAt(index);
    if (code > 0xff)
        throw new RangeError("base64Encode and hexEncode take byte strings (codes 0-255)");
    return code;
}
function isHex(code) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}
//# sourceMappingURL=encoding.js.map