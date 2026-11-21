import { type Base64Alphabet } from "./encoding.js";
export type HoneytokenEncoding = "raw" | "hex" | "base64" | "double-base64";
export declare const ENCODING_ORDER: readonly HoneytokenEncoding[];
export interface HoneytokenSpec {
    readonly id: string;
    readonly value: string;
}
export interface HoneytokenMatch {
    readonly tokenId: string;
    readonly encoding: HoneytokenEncoding;
    /** How many rounds of percent-decoding the text needed first (0, 1, or 2). */
    readonly percentDecoded: number;
}
type SearchForm = "asIs" | "lower" | "noSpace";
interface Pattern {
    readonly tokenIndex: number;
    readonly tokenId: string;
    readonly encoding: HoneytokenEncoding;
    readonly text: string;
    readonly form: SearchForm;
}
export interface CompiledHoneytokens {
    readonly patterns: readonly Pattern[];
    readonly rawLower: readonly {
        tokenIndex: number;
        tokenId: string;
        text: string;
    }[];
}
/**
 * The base64 characters that depend only on `value`, when `value` starts at byte offset `k`
 * (mod 3) inside a larger payload.
 */
export declare function stableSlice(value: string, k: 0 | 1 | 2, alphabet: Base64Alphabet): string;
/** Build the search patterns for a set of honeytokens. Values must be printable ASCII. */
export declare function compileHoneytokens(tokens: readonly HoneytokenSpec[]): CompiledHoneytokens;
export interface FindOptions {
    /** Also compare raw values case-insensitively (for DNS names, which resolvers may re-case). */
    readonly caseInsensitiveRaw?: boolean;
}
/** Report every honeytoken found in `text`, once per (token, encoding), fewest decodes first. */
export declare function findHoneytokens(compiled: CompiledHoneytokens, text: string, options?: FindOptions): HoneytokenMatch[];
export {};
//# sourceMappingURL=honeytokens.d.ts.map