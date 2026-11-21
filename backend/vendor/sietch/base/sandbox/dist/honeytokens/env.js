import { randomChars, randomHex } from "../rng.js";
import { BASE62_ALPHABET } from "./checksum.js";
const DB_PASSWORD_LENGTH = 24;
const API_KEY_LENGTH = 40;
export function generate(rng) {
    return {
        databasePassword: randomChars(rng, BASE62_ALPHABET, DB_PASSWORD_LENGTH),
        apiKey: randomHex(rng, API_KEY_LENGTH),
    };
}
const DB_PASSWORD_PATTERN = /^[0-9A-Za-z]{24}$/;
const API_KEY_PATTERN = /^[0-9a-f]{40}$/;
export function validate(value) {
    return DB_PASSWORD_PATTERN.test(value.databasePassword) && API_KEY_PATTERN.test(value.apiKey);
}
//# sourceMappingURL=env.js.map