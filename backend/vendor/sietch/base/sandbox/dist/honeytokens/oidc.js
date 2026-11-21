import { z } from "zod";
import { drawBytes, randomUuid } from "../rng.js";
import { jwtSignature } from "./registration.js";
/** An RS256 signature over a 2048-bit key is 256 bytes, which is 342 base64url characters without padding. */
export const SIGNATURE_BYTES = 256;
export const SIGNATURE_LENGTH = 342;
/** How long the fake token claims to be valid. */
const LIFETIME_SECONDS = 6 * 60 * 60;
const ISSUER = "vstoken.actions.githubusercontent.com";
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const jsonSegment = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** A JWT-shaped fake with a random signature. The signature is not a real one and verifies against nothing. */
export function generate(rng, input) {
    if (!Number.isSafeInteger(input.nowSeconds) || input.nowSeconds < 0) {
        throw new RangeError("nowSeconds must be a non-negative integer");
    }
    const header = jsonSegment({ typ: "JWT", alg: "RS256", x5t: b64url(drawBytes(rng, 20)) });
    const payload = jsonSegment({
        nameid: randomUuid(rng),
        scp: `Actions.Results:${randomUuid(rng)}:${randomUuid(rng)}`,
        iss: ISSUER,
        aud: ISSUER,
        nbf: input.nowSeconds,
        exp: input.nowSeconds + LIFETIME_SECONDS,
    });
    const signature = b64url(drawBytes(rng, SIGNATURE_BYTES));
    return { token: `${header}.${payload}.${signature}`, signature };
}
const headerSchema = z.looseObject({ typ: z.literal("JWT"), alg: z.literal("RS256") });
const SEGMENT = /^[A-Za-z0-9_-]+$/;
/** True if `token` has three base64url segments, an RS256 JWT header, a JSON payload, and a 342-character signature. */
export function validate(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3 || !parts.every((p) => SEGMENT.test(p)))
            return false;
        const [header, payload] = parts;
        if (header === undefined || payload === undefined)
            return false;
        if (!headerSchema.safeParse(JSON.parse(Buffer.from(header, "base64url").toString("utf8"))).success) {
            return false;
        }
        const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (typeof body !== "object" || body === null || Array.isArray(body))
            return false;
        return jwtSignature(token).length === SIGNATURE_LENGTH;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=oidc.js.map