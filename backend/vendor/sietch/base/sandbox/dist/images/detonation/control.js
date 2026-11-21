import { z } from "zod";
import { WORK_ROOT } from "./layout.js";
/**
 * `.init/control.json`: what the runner tells init, carried in the fake-home part because the detonation
 * container is started with no environment and no arguments. Init is the only reader and removes the file
 * before it starts install.
 *
 *   env           the environment of install and load (the profile's variables, honeytokens included)
 *   projectDir    the working directory of both, under /home/runner/work/
 *   sinkAddress   where the DNS relay forwards to
 *   observeSeconds how long init watches after install and load have both exited
 *
 * Strict at every level. Names are plain identifiers, values are printable ASCII, there are at most 128
 * variables, and `PATH` and `NODE_EXTRA_CA_CERTS` are init's alone to set. A value that holds `PRIVATE KEY`
 * is refused: nothing in the environment is meant to be a key, and the CA private key must never reach
 * this container by this route.
 */
export const MAX_CONTROL_BYTES = 768 * 1024;
export const MAX_ENV_ENTRIES = 128;
export const MAX_ENV_VALUE_CHARS = 4096;
export const MIN_OBSERVE_SECONDS = 1;
export const MAX_OBSERVE_SECONDS = 60;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ENV_VALUE = /^[\x20-\x7e]*$/;
const PROJECT_DIR = /^\/home\/runner\/work(?:\/[A-Za-z0-9._@+=,~-]+){1,8}$/;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
/** Names init sets itself. A control file that sets them is refused rather than overridden silently. */
const RESERVED_NAMES = new Set(["PATH", "NODE_EXTRA_CA_CERTS", "__proto__"]);
/** True for an absolute path under the work root with plain segments and no `.` or `..` segment. */
export function isProjectPath(value) {
    if (!PROJECT_DIR.test(value) || !value.startsWith(`${WORK_ROOT}/`))
        return false;
    return !value.split("/").some((segment) => segment === "." || segment === "..");
}
const controlSchema = z.strictObject({
    env: z
        .record(z.string().regex(ENV_NAME), z.string().max(MAX_ENV_VALUE_CHARS).regex(ENV_VALUE))
        .superRefine((env, context) => {
        const entries = Object.entries(env);
        if (entries.length > MAX_ENV_ENTRIES)
            context.addIssue({ code: "custom", message: "too many variables" });
        for (const [name, value] of entries) {
            if (RESERVED_NAMES.has(name))
                context.addIssue({ code: "custom", message: "reserved name" });
            if (value.includes("PRIVATE KEY"))
                context.addIssue({ code: "custom", message: "key text" });
        }
        const temp = env.RUNNER_TEMP;
        if (temp !== undefined && !isProjectPath(temp)) {
            context.addIssue({ code: "custom", message: "RUNNER_TEMP is not under the work root" });
        }
    }),
    projectDir: z.string().refine(isProjectPath),
    sinkAddress: z.string().regex(IPV4),
    observeSeconds: z.number().int().min(MIN_OBSERVE_SECONDS).max(MAX_OBSERVE_SECONDS),
});
const INVALID = { ok: false, reason: "control.json is not a valid control file" };
const FATAL_UTF8 = new TextDecoder("utf-8", { fatal: true });
/** Parses `control.json`. Never throws. */
export function parseControl(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_CONTROL_BYTES) {
        return INVALID;
    }
    let json;
    try {
        json = JSON.parse(FATAL_UTF8.decode(bytes));
    }
    catch {
        return INVALID;
    }
    // JSON.parse makes "__proto__" an own key, which a schema may quietly drop. Refuse it outright.
    const env = typeof json === "object" && json !== null ? json.env : undefined;
    if (typeof env === "object" && env !== null && Object.hasOwn(env, "__proto__"))
        return INVALID;
    const parsed = controlSchema.safeParse(json);
    return parsed.success ? { ok: true, control: parsed.data } : INVALID;
}
//# sourceMappingURL=control.js.map