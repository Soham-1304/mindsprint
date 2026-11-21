import { type Rng } from "../rng.js";
/** Token types the runner plants: personal access token, OAuth access token, server-to-server token. */
export declare const GITHUB_PREFIXES: readonly ["ghp_", "gho_", "ghs_"];
export type GithubPrefix = (typeof GITHUB_PREFIXES)[number];
/** Every GitHub prefix a validator or the repo guard recognises (adds user-to-server and refresh tokens). */
export declare const KNOWN_GITHUB_PREFIXES: readonly ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"];
/** A fake GitHub token: prefix + 30 base62 characters + a 6-character CRC32 checksum. 40 characters in all. */
export declare function generate(rng: Rng, prefix?: GithubPrefix): string;
/** True if `value` has the GitHub token shape and a correct checksum. */
export declare function validate(value: string): boolean;
//# sourceMappingURL=github.d.ts.map