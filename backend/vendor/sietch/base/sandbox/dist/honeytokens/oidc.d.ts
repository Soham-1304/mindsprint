import { type Rng } from "../rng.js";
/** An RS256 signature over a 2048-bit key is 256 bytes, which is 342 base64url characters without padding. */
export declare const SIGNATURE_BYTES = 256;
export declare const SIGNATURE_LENGTH = 342;
export interface OidcInput {
    /** Current time in whole seconds. Injected, so the token is a pure function of the rng and the clock. */
    readonly nowSeconds: number;
}
export interface OidcToken {
    /** The whole `ACTIONS_ID_TOKEN_REQUEST_TOKEN` value: three base64url segments joined by dots. */
    readonly token: string;
    /** The random signature segment. This is what gets registered as a honeytoken. */
    readonly signature: string;
}
/** A JWT-shaped fake with a random signature. The signature is not a real one and verifies against nothing. */
export declare function generate(rng: Rng, input: OidcInput): OidcToken;
/** True if `token` has three base64url segments, an RS256 JWT header, a JSON payload, and a 342-character signature. */
export declare function validate(token: string): boolean;
//# sourceMappingURL=oidc.d.ts.map