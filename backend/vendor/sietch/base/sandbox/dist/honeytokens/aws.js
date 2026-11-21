import { randomChars } from "../rng.js";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const ACCESS_KEY_PREFIX = "AKIA";
const ACCESS_KEY_PATTERN = /^AKIA[A-Z2-7]{16}$/;
const SECRET_PATTERN = /^[A-Za-z0-9+/]{40}$/;
/** A fake AWS access key id and secret in the real formats. There is no checksum to satisfy. */
export function generate(rng) {
    return {
        accessKeyId: `${ACCESS_KEY_PREFIX}${randomChars(rng, BASE32, 16)}`,
        secretAccessKey: randomChars(rng, BASE64_CHARS, 40),
    };
}
export function validateAccessKeyId(value) {
    return ACCESS_KEY_PATTERN.test(value);
}
export function validateSecretAccessKey(value) {
    return SECRET_PATTERN.test(value);
}
/** True if both halves are well formed. */
export function validate(value) {
    return validateAccessKeyId(value.accessKeyId) && validateSecretAccessKey(value.secretAccessKey);
}
//# sourceMappingURL=aws.js.map