import { type Rng } from "../rng.js";
export declare const PREFIX = "npm_";
/** A fake npm access token: `npm_` + 30 base62 characters + a 6-character CRC32 checksum. 40 characters in all. */
export declare function generate(rng: Rng): string;
/** True if `value` has the npm token shape and a correct checksum. */
export declare function validate(value: string): boolean;
//# sourceMappingURL=npm.d.ts.map