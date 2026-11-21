import { z } from "zod";
/**
 * The scan request: what the worker asks the runner to scan. It crosses a trust boundary (queue job),
 * so it is a zod `.strict()` schema. There is deliberately no `runtime` field: every container uses
 * gVisor in every mode, and nothing a request says can change that.
 */
// Same limits as the engine's scan input (base/core limits.ts), so a request that passes here can
// also pass `validateScanInput`. request.test.ts checks the shared values against the engine.
const MAX_NAME = 214;
const MAX_VERSION = 256;
const MAX_ALLOWLIST = 500;
const MAX_ALLOWLIST_ENTRY = 257;
export const MAX_FIXTURE_PATH = 200;
/** npm-style SRI, SHA-512 only. Same pattern as the engine. */
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]{86}==$/;
/** Optional @scope/, then a name that starts with a letter or digit. Uppercase is allowed for legacy packages. */
export const NAME_PATTERN = /^(?:@[A-Za-z0-9][A-Za-z0-9._~-]*\/)?[A-Za-z0-9][A-Za-z0-9._~-]*$/;
/**
 * An exact SemVer 2.0 version. The version goes into a synthetic package.json as `name@version`, so
 * ranges, tags ("latest"), and specifiers ("git+https://...", "file:...") must not get through.
 */
export const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** A host, `*.suffix`, or IP literal. The engine's own allowlist compiler is the final check. */
const ALLOWLIST_ENTRY_PATTERN = /^(?:\*\.)?[A-Za-z0-9._:[\]-]+$/;
/** `demo/` plus one or more path segments that start with a letter or digit, so no "." or ".." segment. */
const FIXTURE_PATTERN = /^demo(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/;
export const REQUEST_ARCHES = ["arm64", "x64"];
export const REQUEST_MODES = ["sandbox", "dev"];
export const scanRequestSchema = z
    .strictObject({
    name: z.string().min(1).max(MAX_NAME).regex(NAME_PATTERN),
    version: z.string().min(1).max(MAX_VERSION).regex(VERSION_PATTERN),
    integrity: z.string().regex(INTEGRITY_PATTERN),
    allowlist: z
        .array(z.string().min(1).max(MAX_ALLOWLIST_ENTRY).regex(ALLOWLIST_ENTRY_PATTERN))
        .max(MAX_ALLOWLIST),
    arch: z.enum(REQUEST_ARCHES),
    /**
     * `sandbox` is the normal mode. `dev` is the local fixture-only mode (the Mac): same runtime and
     * settings, but only demo/ fixtures may be scanned, and the run is labelled as dev.
     */
    mode: z.enum(REQUEST_MODES),
    /** Repo-relative path of the fixture to scan. Required in dev mode, forbidden otherwise. */
    fixture: z.string().max(MAX_FIXTURE_PATH).regex(FIXTURE_PATTERN).optional(),
})
    .superRefine((request, ctx) => {
    if (request.mode === "dev" && request.fixture === undefined) {
        ctx.addIssue({ code: "custom", path: ["fixture"], message: "required in dev mode" });
    }
    if (request.mode !== "dev" && request.fixture !== undefined) {
        ctx.addIssue({ code: "custom", path: ["fixture"], message: "only allowed in dev mode" });
    }
});
const MAX_REASON = 300;
/**
 * Validate an untrusted value as a scan request. Never throws. The reason is built only from field
 * paths and issue codes, never from the rejected values or zod's messages, which can carry
 * attacker-chosen text.
 */
export function validateRequest(input) {
    const result = scanRequestSchema.safeParse(input);
    if (result.success)
        return { ok: true, value: result.data };
    const parts = result.error.issues.slice(0, 5).map((issue) => {
        const where = issue.path
            .map((p) => (typeof p === "number" || typeof p === "string" ? String(p) : "?"))
            .join(".");
        const what = issue.code === "custom" ? `invalid (${issue.message})` : issue.code;
        return `${where || "(root)"}: ${what}`;
    });
    const reason = `invalid scan request: ${parts.join("; ")}`;
    return { ok: false, code: "BAD_REQUEST", reason: reason.slice(0, MAX_REASON) };
}
//# sourceMappingURL=request.js.map