import { type Rng } from "../rng.js";
export interface GcpInput {
    /** GCP project id: 6 to 30 lowercase letters, digits, and hyphens. */
    readonly projectId: string;
    /** Service account name (the part of the email before `@`): 6 to 30 lowercase letters, digits, hyphens. */
    readonly serviceAccount: string;
}
export interface GcpKey {
    /** The whole service-account key file, as `google-github-actions/auth` writes it. */
    readonly json: string;
    /** 40 hex characters. Registered as a honeytoken on its own. */
    readonly privateKeyId: string;
    /**
     * One full 64-character line from the secret part of the PEM body, chosen by the rng. Registered as a
     * honeytoken. Never the armor lines, the fixed `MII...` first line, or the public modulus lines.
     */
    readonly keyLine: string;
}
/** A fake GCP service-account key file with a freshly generated RSA-2048 private key. */
export declare function generate(rng: Rng, input: GcpInput): GcpKey;
/**
 * True if `json` is a well-formed key file whose private key is a working RSA-2048 key (a signature
 * made with it verifies against the public half).
 */
export declare function validate(json: string): boolean;
//# sourceMappingURL=gcp.d.ts.map