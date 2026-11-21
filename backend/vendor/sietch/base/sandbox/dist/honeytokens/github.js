import { randomChars } from "../rng.js";
import { BASE62_ALPHABET, checksumOf, ENTROPY_LENGTH, hasValidChecksum } from "./checksum.js";
/** Token types the runner plants: personal access token, OAuth access token, server-to-server token. */
export const GITHUB_PREFIXES = ["ghp_", "gho_", "ghs_"];
/** Every GitHub prefix a validator or the repo guard recognises (adds user-to-server and refresh tokens). */
export const KNOWN_GITHUB_PREFIXES = ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"];
const PATTERN = /^gh[pousr]_[0-9A-Za-z]{36}$/;
/** A fake GitHub token: prefix + 30 base62 characters + a 6-character CRC32 checksum. 40 characters in all. */
export function generate(rng, prefix = "ghp_") {
    const entropy = randomChars(rng, BASE62_ALPHABET, ENTROPY_LENGTH);
    return `${prefix}${entropy}${checksumOf(entropy)}`;
}
/** True if `value` has the GitHub token shape and a correct checksum. */
export function validate(value) {
    return PATTERN.test(value) && hasValidChecksum(value.slice(4));
}
//# sourceMappingURL=github.js.map