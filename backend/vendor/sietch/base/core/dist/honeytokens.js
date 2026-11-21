// Find honeytoken values in captured traffic, raw or encoded.
//
// Base64 at any alignment: base64 turns each 3-byte group into 4 characters, so a secret's encoding
// depends on where it sits inside a larger payload (for example a JSON blob that is base64-encoded
// as a whole, which is what Shai-Hulud sent). For each of the 3 possible offsets we keep only the
// characters produced entirely from secret bytes: the "alignment-stable slice". Those characters
// are the same whatever surrounds the secret.
//
// Matching uses indexOf only (no regular expressions), so the cost is linear in the text length
// for a fixed set of tokens.
import { base64Encode, hexEncode, percentDecode } from "./encoding.js";
export const ENCODING_ORDER = ["raw", "hex", "base64", "double-base64"];
const ALPHABETS = ["std", "url"];
const OFFSETS = [0, 1, 2];
const FILL = "\u00a7\u00a7"; // any bytes work; the stable slice never includes them
/**
 * The base64 characters that depend only on `value`, when `value` starts at byte offset `k`
 * (mod 3) inside a larger payload.
 */
export function stableSlice(value, k, alphabet) {
    const encoded = base64Encode(FILL.slice(0, k) + value, alphabet);
    const start = k > 0 ? 4 : 0;
    const end = Math.floor((k + value.length) / 3) * 4;
    return encoded.slice(start, end);
}
/** Build the search patterns for a set of honeytokens. Values must be printable ASCII. */
export function compileHoneytokens(tokens) {
    const patterns = [];
    const rawLower = [];
    tokens.forEach((token, tokenIndex) => {
        const add = (encoding, text, form) => {
            if (text.length > 0)
                patterns.push({ tokenIndex, tokenId: token.id, encoding, text, form });
        };
        add("raw", token.value, "asIs");
        add("hex", hexEncode(token.value), "lower");
        const singles = new Set();
        for (const alphabet of ALPHABETS)
            for (const k of OFFSETS)
                singles.add(stableSlice(token.value, k, alphabet));
        for (const s of singles)
            add("base64", s, "noSpace");
        const doubles = new Set();
        for (const inner of singles) {
            for (const alphabet of ALPHABETS)
                for (const k of OFFSETS)
                    doubles.add(stableSlice(inner, k, alphabet));
        }
        for (const d of doubles)
            add("double-base64", d, "noSpace");
        rawLower.push({ tokenIndex, tokenId: token.id, text: token.value.toLowerCase() });
    });
    return { patterns, rawLower };
}
const WHITESPACE = /[\t\n\v\f\r ]+/g;
/** Report every honeytoken found in `text`, once per (token, encoding), fewest decodes first. */
export function findHoneytokens(compiled, text, options = {}) {
    if (compiled.patterns.length === 0 || text.length === 0)
        return [];
    const candidates = [text];
    const once = percentDecode(text);
    if (once !== text) {
        candidates.push(once);
        const twice = percentDecode(once);
        if (twice !== once)
            candidates.push(twice);
    }
    const found = new Map();
    const record = (tokenIndex, tokenId, encoding, decoded) => {
        const key = `${tokenIndex}:${encoding}`;
        if (!found.has(key))
            found.set(key, { tokenIndex, match: { tokenId, encoding, percentDecoded: decoded } });
    };
    candidates.forEach((candidate, decoded) => {
        const forms = {
            asIs: candidate,
            lower: candidate.toLowerCase(),
            noSpace: candidate.replace(WHITESPACE, ""),
        };
        for (const p of compiled.patterns) {
            if (forms[p.form].includes(p.text))
                record(p.tokenIndex, p.tokenId, p.encoding, decoded);
        }
        if (options.caseInsensitiveRaw) {
            for (const r of compiled.rawLower)
                if (forms.lower.includes(r.text))
                    record(r.tokenIndex, r.tokenId, "raw", decoded);
        }
    });
    return [...found.values()]
        .sort((a, b) => a.tokenIndex - b.tokenIndex ||
        ENCODING_ORDER.indexOf(a.match.encoding) - ENCODING_ORDER.indexOf(b.match.encoding))
        .map((f) => f.match);
}
//# sourceMappingURL=honeytokens.js.map