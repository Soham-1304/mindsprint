import { randomChars } from "../rng.js";
import { BASE62_ALPHABET } from "./checksum.js";
export const DEFAULT_LENGTH = 32;
const MIN_LENGTH = 16;
const MAX_LENGTH = 128;
/** A random base62 secret (a netrc password, a Docker access token body). `length` is 16 to 128. */
export function generate(rng, length = DEFAULT_LENGTH) {
    if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
        throw new RangeError(`length must be ${MIN_LENGTH} to ${MAX_LENGTH}`);
    }
    return randomChars(rng, BASE62_ALPHABET, length);
}
/** True if `value` is base62 of the given length (default 32). */
export function validate(value, length = DEFAULT_LENGTH) {
    return value.length === length && /^[0-9A-Za-z]+$/.test(value);
}
//# sourceMappingURL=generic.js.map