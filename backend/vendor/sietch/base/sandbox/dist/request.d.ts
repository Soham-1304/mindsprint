import { z } from "zod";
export declare const MAX_FIXTURE_PATH = 200;
/** Optional @scope/, then a name that starts with a letter or digit. Uppercase is allowed for legacy packages. */
export declare const NAME_PATTERN: RegExp;
/**
 * An exact SemVer 2.0 version. The version goes into a synthetic package.json as `name@version`, so
 * ranges, tags ("latest"), and specifiers ("git+https://...", "file:...") must not get through.
 */
export declare const VERSION_PATTERN: RegExp;
export declare const REQUEST_ARCHES: readonly ["arm64", "x64"];
export declare const REQUEST_MODES: readonly ["sandbox", "dev"];
export type RequestArch = (typeof REQUEST_ARCHES)[number];
export type RequestMode = (typeof REQUEST_MODES)[number];
export declare const scanRequestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    integrity: z.ZodString;
    allowlist: z.ZodArray<z.ZodString>;
    arch: z.ZodEnum<{
        arm64: "arm64";
        x64: "x64";
    }>;
    mode: z.ZodEnum<{
        dev: "dev";
        sandbox: "sandbox";
    }>;
    fixture: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type RequestValidation = {
    readonly ok: true;
    readonly value: ScanRequest;
} | {
    readonly ok: false;
    readonly code: "BAD_REQUEST";
    readonly reason: string;
};
/**
 * Validate an untrusted value as a scan request. Never throws. The reason is built only from field
 * paths and issue codes, never from the rejected values or zod's messages, which can carry
 * attacker-chosen text.
 */
export declare function validateRequest(input: unknown): RequestValidation;
//# sourceMappingURL=request.d.ts.map