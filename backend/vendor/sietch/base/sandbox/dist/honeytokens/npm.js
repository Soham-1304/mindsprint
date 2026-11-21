import { randomChars } from "../rng.js";
import { BASE62_ALPHABET, checksumOf, ENTROPY_LENGTH, hasValidChecksum } from "./checksum.js";
export const PREFIX = "npm_";
const PATTERN = /^npm_[0-9A-Za-z]{36}$/;
/** A fake npm access token: `npm_` + 30 base62 characters + a 6-character CRC32 checksum. 40 characters in all. */
export function generate(rng) {
    const entropy = randomChars(rng, BASE62_ALPHABET, ENTROPY_LENGTH);
    return `${PREFIX}${entropy}${checksumOf(entropy)}`;
}
/** True if `value` has the npm token shape and a correct checksum. */
export function validate(value) {
    return PATTERN.test(value) && hasValidChecksum(value.slice(PREFIX.length));
}
//# sourceMappingURL=npm.js.map