import type { RandomBytes } from "./scan-id.js";
/**
 * The injected source of randomness for everything fake. `crypto.randomBytes` in production, a
 * seeded stream in tests. Nothing in the fake environment draws randomness from anywhere else.
 */
export type Rng = RandomBytes;
/** `length` bytes from the source, checked: a wrong type or length is an error, never padded or cut. */
export declare function drawBytes(rng: Rng, length: number): Uint8Array;
/**
 * `length` characters, each drawn uniformly from `alphabet` (2 to 256 distinct characters). Bytes that
 * would bias the choice are rejected rather than reduced with a plain modulo.
 */
export declare function randomChars(rng: Rng, alphabet: string, length: number): string;
/** Lowercase hex, `length` characters. */
export declare function randomHex(rng: Rng, length: number): string;
/** An integer in [0, maxExclusive), uniform. `maxExclusive` is 1 to 2^32. */
export declare function randomInt(rng: Rng, maxExclusive: number): number;
/** An integer in [min, max], both included. */
export declare function randomRange(rng: Rng, min: number, max: number): number;
/** One element of a non-empty list. */
export declare function pick<T>(rng: Rng, items: readonly T[]): T;
/** A lowercase UUID-shaped string (8-4-4-4-12 hex). Not a real UUID: the version bits are random too. */
export declare function randomUuid(rng: Rng): string;
/** A decimal string of `digits` digits that doesn't start with 0. */
export declare function randomDigits(rng: Rng, digits: number): string;
//# sourceMappingURL=rng.d.ts.map