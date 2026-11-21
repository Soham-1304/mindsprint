import { type Rng } from "../rng.js";
export declare const ACCESS_KEY_PREFIX = "AKIA";
export interface AwsCredentials {
    /** `AKIA` + 16 base32 characters (20 in all). */
    readonly accessKeyId: string;
    /** 40 base64 characters. */
    readonly secretAccessKey: string;
}
/** A fake AWS access key id and secret in the real formats. There is no checksum to satisfy. */
export declare function generate(rng: Rng): AwsCredentials;
export declare function validateAccessKeyId(value: string): boolean;
export declare function validateSecretAccessKey(value: string): boolean;
/** True if both halves are well formed. */
export declare function validate(value: AwsCredentials): boolean;
//# sourceMappingURL=aws.d.ts.map