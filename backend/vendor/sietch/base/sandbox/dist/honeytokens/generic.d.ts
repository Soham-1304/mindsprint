import { type Rng } from "../rng.js";
export declare const DEFAULT_LENGTH = 32;
/** A random base62 secret (a netrc password, a Docker access token body). `length` is 16 to 128. */
export declare function generate(rng: Rng, length?: number): string;
/** True if `value` is base62 of the given length (default 32). */
export declare function validate(value: string, length?: number): boolean;
//# sourceMappingURL=generic.d.ts.map