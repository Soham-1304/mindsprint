import { type Rng } from "../rng.js";
/** Split `text` into lines of `width` characters (the last one may be shorter). */
export declare function wrapLines(text: string, width: number): string[];
/** One of `lines`, at an index chosen by the rng from `eligible`. */
export declare function pickLine(rng: Rng, lines: readonly string[], eligible: readonly number[]): string;
/** A registered body line is base64 text only: no armor line, no `=` padding, no whitespace. */
export declare function isBodyLine(value: string): boolean;
/** The signature segment of a compact JWT (`header.payload.signature`). */
export declare function jwtSignature(jwt: string): string;
//# sourceMappingURL=registration.d.ts.map