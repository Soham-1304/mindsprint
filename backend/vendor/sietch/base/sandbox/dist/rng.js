import { FakeEnvironmentError } from "./errors.js";
/** Each rejected byte costs one draw. A source that keeps returning rejected bytes ends in an error, not a hang. */
const DRAW_BUDGET_FACTOR = 64;
const DRAW_BUDGET_FLOOR = 256;
/** `length` bytes from the source, checked: a wrong type or length is an error, never padded or cut. */
export function drawBytes(rng, length) {
    const bytes = rng(length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
        throw new FakeEnvironmentError("the random source must return exactly the requested number of bytes");
    }
    return bytes;
}
/**
 * `length` characters, each drawn uniformly from `alphabet` (2 to 256 distinct characters). Bytes that
 * would bias the choice are rejected rather than reduced with a plain modulo.
 */
export function randomChars(rng, alphabet, length) {
    if (alphabet.length < 2 || alphabet.length > 256) {
        throw new FakeEnvironmentError("alphabet must have 2 to 256 characters");
    }
    if (!Number.isInteger(length) || length < 0)
        throw new FakeEnvironmentError("length must be a count");
    const limit = 256 - (256 % alphabet.length);
    const budget = length * DRAW_BUDGET_FACTOR + DRAW_BUDGET_FLOOR;
    let out = "";
    let drawn = 0;
    while (out.length < length) {
        const want = length - out.length;
        drawn += want;
        if (drawn > budget)
            throw new FakeEnvironmentError("the random source is rejecting too many bytes");
        for (const byte of drawBytes(rng, want)) {
            if (byte < limit)
                out += alphabet.charAt(byte % alphabet.length);
        }
    }
    return out;
}
const HEX = "0123456789abcdef";
/** Lowercase hex, `length` characters. */
export function randomHex(rng, length) {
    return randomChars(rng, HEX, length);
}
/** An integer in [0, maxExclusive), uniform. `maxExclusive` is 1 to 2^32. */
export function randomInt(rng, maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 32) {
        throw new FakeEnvironmentError("maxExclusive must be an integer from 1 to 2^32");
    }
    if (maxExclusive === 1)
        return 0;
    const space = 2 ** 32;
    const limit = space - (space % maxExclusive);
    for (let attempt = 0; attempt < DRAW_BUDGET_FLOOR; attempt++) {
        const b = drawBytes(rng, 4);
        const value = ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 2 ** 16 + (b[2] ?? 0) * 2 ** 8 + (b[3] ?? 0)) >>> 0;
        if (value < limit)
            return value % maxExclusive;
    }
    throw new FakeEnvironmentError("the random source is rejecting too many values");
}
/** An integer in [min, max], both included. */
export function randomRange(rng, min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new FakeEnvironmentError("invalid range");
    }
    return min + randomInt(rng, max - min + 1);
}
/** One element of a non-empty list. */
export function pick(rng, items) {
    const item = items[randomInt(rng, items.length)];
    if (item === undefined)
        throw new FakeEnvironmentError("cannot pick from an empty list");
    return item;
}
/** A lowercase UUID-shaped string (8-4-4-4-12 hex). Not a real UUID: the version bits are random too. */
export function randomUuid(rng) {
    const hex = randomHex(rng, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** A decimal string of `digits` digits that doesn't start with 0. */
export function randomDigits(rng, digits) {
    return randomChars(rng, "123456789", 1) + randomChars(rng, "0123456789", digits - 1);
}
//# sourceMappingURL=rng.js.map