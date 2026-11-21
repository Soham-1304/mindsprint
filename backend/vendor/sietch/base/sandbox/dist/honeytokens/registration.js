// Choosing the value that gets registered with the engine for a fake that isn't a single token.
//
// The engine's raw match is an exact substring search. A multi-line key file breaks its body into short
// lines (and GCP JSON stores them with `\n` escapes), so the joined body would never appear in a copy of the
// file. One full line from the secret part of the body appears unchanged in the raw file, inside the JSON,
// and inside a base64 copy of the whole file (spec design D4). Header lines are never registered: they are
// the same in every key, so they would match any key file.
import { FakeEnvironmentError } from "../errors.js";
import { pick } from "../rng.js";
/** Split `text` into lines of `width` characters (the last one may be shorter). */
export function wrapLines(text, width) {
    const lines = [];
    for (let i = 0; i < text.length; i += width)
        lines.push(text.slice(i, i + width));
    return lines;
}
/** One of `lines`, at an index chosen by the rng from `eligible`. */
export function pickLine(rng, lines, eligible) {
    const index = pick(rng, eligible);
    const line = lines[index];
    if (line === undefined)
        throw new FakeEnvironmentError("eligible line index out of range");
    return line;
}
const BASE64_LINE = /^[A-Za-z0-9+/]+$/;
/** A registered body line is base64 text only: no armor line, no `=` padding, no whitespace. */
export function isBodyLine(value) {
    return BASE64_LINE.test(value);
}
/** The signature segment of a compact JWT (`header.payload.signature`). */
export function jwtSignature(jwt) {
    const parts = jwt.split(".");
    const signature = parts[2];
    if (parts.length !== 3 || signature === undefined || signature === "") {
        throw new FakeEnvironmentError("not a three-part token");
    }
    return signature;
}
//# sourceMappingURL=registration.js.map