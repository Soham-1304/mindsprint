import { type Rng } from "../rng.js";
export interface SshKey {
    /** The file as `ssh-keygen` writes it: armor lines and the base64 body in 70-character lines. */
    readonly file: string;
    /** One full 70-character body line that holds at least 192 bits of the secret seed. Registered as a honeytoken. */
    readonly keyLine: string;
}
/** A fake Ed25519 key file. `comment` is printable ASCII without a newline (for example `runner@host`). */
export declare function generate(rng: Rng, comment: string): SshKey;
/** True if `file` is a well-formed unencrypted Ed25519 key file whose public key matches its seed. */
export declare function validate(file: string): boolean;
//# sourceMappingURL=ssh.d.ts.map