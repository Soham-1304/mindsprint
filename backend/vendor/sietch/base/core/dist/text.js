import { MAX_QUOTE } from "./limits.js";
/**
 * True for characters that can rewrite or disguise what a terminal, log, or page shows:
 * C0 and C1 control characters (including ESC, CR, and NUL), DEL, the Unicode line and paragraph
 * separators, and the bidirectional overrides and isolates.
 */
export function isUnsafeChar(code) {
    return (code < 0x20 ||
        (code >= 0x7f && code <= 0x9f) ||
        code === 0x2028 ||
        code === 0x2029 ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069));
}
/** True if the string contains any character `isUnsafeChar` rejects. */
export function hasUnsafeChars(value) {
    for (let i = 0; i < value.length; i++) {
        if (isUnsafeChar(value.charCodeAt(i)))
            return true;
    }
    return false;
}
/**
 * Make an untrusted value safe to show inside a finding: unsafe characters become visible
 * `\u{…}` escapes, and the result is capped at `max` characters (ending with "…" when cut).
 */
export function quote(value, max = MAX_QUOTE) {
    let out = "";
    for (const ch of value) {
        const code = ch.codePointAt(0) ?? 0;
        const piece = isUnsafeChar(code) ? `\\u{${code.toString(16)}}` : ch;
        if (out.length + piece.length > max)
            return `${out}…`;
        out += piece;
    }
    return out;
}
/** Show only the start of a honeytoken, so findings never contain the full value. */
export function redactToken(value) {
    return `${value.slice(0, 6)}…`;
}
//# sourceMappingURL=text.js.map