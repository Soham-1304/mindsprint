// Strict schemas for the rules engine's input. Everything in a trace was caused by hostile code,
// so unknown fields, unknown event types, and oversized values are rejected, never ignored.
import { z } from "zod";
import { canonicalIp, compileAllowlist } from "./hosts.js";
import { INTEGRITY_PATTERN, MAX_ADDRESS, MAX_ALLOWLIST, MAX_ARG, MAX_ARGV, MAX_BODY, MAX_DNS_NAME, MAX_EVENTS, MAX_EXTRA_CREDENTIAL_PATHS, MAX_HEADER_NAME, MAX_HEADER_VALUE, MAX_HEADERS, MAX_HONEYTOKEN, MAX_HONEYTOKENS, MAX_HOST, MAX_HTTP_PATH, MAX_NAME, MAX_PATH, MAX_PID, MAX_QTYPE, MAX_REASON, MAX_SEQ, MAX_SIGNAL, MAX_SINK_ADDRESSES, MAX_TIME_MS, MAX_TMP_DIRS, MAX_TOTAL_BODY, MAX_TOTAL_SCANNED_TEXT, MAX_VERSION, MIN_HONEYTOKEN, } from "./limits.js";
import { isInside, normalisePath } from "./paths.js";
import { hasUnsafeChars, quote } from "./text.js";
const wellFormed = (s) => s.isWellFormed() && !s.includes("\u0000");
const text = (max) => z.string().max(max).refine(wellFormed, { message: "malformed" });
const nonEmptyText = (max) => text(max).min(1);
/** An absolute path with no control characters. */
const absolutePath = z
    .string()
    .min(1)
    .max(MAX_PATH)
    .refine((s) => wellFormed(s) && s.startsWith("/") && !hasUnsafeChars(s), {
    message: "not a clean absolute path",
});
const isByteString = (s) => {
    for (let i = 0; i < s.length; i++)
        if (s.charCodeAt(i) > 0xff)
            return false;
    return true;
};
const seq = z.int().min(0).max(MAX_SEQ);
const pid = z.int().min(0).max(MAX_PID);
const phase = z.enum(["install", "load", "linger"]);
const common = { seq, t: z.number().min(0).max(MAX_TIME_MS), phase };
const processFields = { pid, ppid: pid };
export const FILE_WRITE_OPS = [
    "create",
    "write",
    "truncate",
    "delete",
    "rename",
    "chmod",
    "mkdir",
    "symlink",
    "hardlink",
];
const OPS_WITH_TARGET = new Set(["rename", "symlink", "hardlink"]);
const execEvent = z.strictObject({
    type: z.literal("exec"),
    ...common,
    ...processFields,
    path: absolutePath,
    argv: z.array(text(MAX_ARG)).max(MAX_ARGV),
    /** The recorder cut the argument list short, so part of the command wasn't seen (R13). */
    argvTruncated: z.boolean().optional(),
});
const fileReadEvent = z.strictObject({
    type: z.literal("file_read"),
    ...common,
    ...processFields,
    path: absolutePath,
});
const fileWriteEvent = z.strictObject({
    type: z.literal("file_write"),
    ...common,
    ...processFields,
    op: z.enum(FILE_WRITE_OPS),
    path: absolutePath,
    target: absolutePath.optional(),
});
const connectEvent = z.strictObject({
    type: z.literal("connect"),
    ...common,
    ...processFields,
    protocol: z.enum(["tcp", "udp"]),
    /** null: data was sent somewhere the recorder didn't show (UDP sendmsg). R3 treats it as external. */
    address: z
        .string()
        .min(1)
        .max(MAX_ADDRESS)
        .regex(/^[0-9A-Fa-f:.]+$/)
        .nullable(),
    port: z.int().min(0).max(65535),
});
const exitEvent = z.strictObject({
    type: z.literal("exit"),
    ...common,
    ...processFields,
    code: z.int().nullable(),
    signal: z
        .string()
        .max(MAX_SIGNAL)
        .regex(/^[A-Z0-9]*$/)
        .nullable(),
});
const dnsEvent = z.strictObject({
    type: z.literal("dns"),
    ...common,
    name: nonEmptyText(MAX_DNS_NAME),
    qtype: z
        .string()
        .max(MAX_QTYPE)
        .regex(/^[A-Z0-9]*$/),
});
const httpEvent = z.strictObject({
    type: z.literal("http"),
    ...common,
    method: z.string().regex(/^[A-Z]{1,16}$/),
    scheme: z.enum(["http", "https"]),
    host: nonEmptyText(MAX_HOST),
    path: text(MAX_HTTP_PATH),
    headers: z.array(z.tuple([text(MAX_HEADER_NAME), text(MAX_HEADER_VALUE)])).max(MAX_HEADERS),
    body: z.string().max(MAX_BODY).refine(isByteString, { message: "not a byte string" }),
    bodyTruncated: z.boolean(),
});
export const eventSchema = z.discriminatedUnion("type", [
    execEvent,
    fileReadEvent,
    fileWriteEvent,
    connectEvent,
    exitEvent,
    dnsEvent,
    httpEvent,
]);
export const HONEYTOKEN_KINDS = [
    "npm",
    "github",
    "aws-access-key",
    "aws-secret-key",
    "gcp",
    "ssh-key",
    "env",
    "generic",
];
const honeytoken = z.strictObject({
    id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
    kind: z.enum(HONEYTOKEN_KINDS),
    value: z
        .string()
        .min(MIN_HONEYTOKEN)
        .max(MAX_HONEYTOKEN)
        .regex(/^[!-~]+$/),
});
export const scanInputSchema = z
    .strictObject({
    package: z.strictObject({
        name: nonEmptyText(MAX_NAME),
        version: nonEmptyText(MAX_VERSION),
        integrity: z.string().regex(INTEGRITY_PATTERN),
    }),
    environment: z.strictObject({
        home: absolutePath,
        projectDir: absolutePath,
        nodeModulesDir: absolutePath,
        tmpDirs: z.array(absolutePath).max(MAX_TMP_DIRS),
        packageManagerPid: pid,
        sinkAddresses: z.array(z.string().min(1).max(MAX_ADDRESS)).max(MAX_SINK_ADDRESSES),
        extraCredentialPaths: z.array(absolutePath).max(MAX_EXTRA_CREDENTIAL_PATHS),
    }),
    allowlist: z
        .array(z
        .string()
        .min(1)
        .max(MAX_HOST + 2))
        .max(MAX_ALLOWLIST),
    honeytokens: z.array(honeytoken).max(MAX_HONEYTOKENS),
    events: z.array(eventSchema).max(MAX_EVENTS),
    eventsTruncated: z.boolean(),
})
    .superRefine((input, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: "custom", path, message });
    const seqs = new Set();
    let totalBody = 0;
    let totalScanned = 0;
    input.events.forEach((event, i) => {
        if (seqs.has(event.seq))
            issue(["events", i, "seq"], "duplicate");
        seqs.add(event.seq);
        if (event.type === "file_write") {
            const needsTarget = OPS_WITH_TARGET.has(event.op);
            if (needsTarget && event.target === undefined)
                issue(["events", i, "target"], "missing");
            if (!needsTarget && event.target !== undefined)
                issue(["events", i, "target"], "not allowed");
        }
        if (event.type === "http") {
            totalBody += event.body.length;
            totalScanned += event.host.length + event.path.length + event.body.length;
            for (const [name, value] of event.headers)
                totalScanned += name.length + value.length;
        }
        if (event.type === "dns")
            totalScanned += event.name.length * 2;
    });
    if (totalBody > MAX_TOTAL_BODY)
        issue(["events"], "total body too large");
    if (totalScanned > MAX_TOTAL_SCANNED_TEXT)
        issue(["events"], "total traffic text too large");
    const ids = new Set();
    const values = new Set();
    input.honeytokens.forEach((token, i) => {
        if (ids.has(token.id))
            issue(["honeytokens", i, "id"], "duplicate");
        if (values.has(token.value))
            issue(["honeytokens", i, "value"], "duplicate");
        ids.add(token.id);
        values.add(token.value);
    });
    // The environment comes from our own runner, but a wrong one would quietly allow everything,
    // so it is checked too (security review SR-5).
    const env = input.environment;
    const home = normalisePath(env.home);
    const project = normalisePath(env.projectDir);
    const nodeModules = normalisePath(env.nodeModulesDir);
    if (!isInside(nodeModules, project) || nodeModules === project) {
        issue(["environment", "nodeModulesDir"], "not strictly inside projectDir");
    }
    if (home === "/")
        issue(["environment", "home"], "is the root");
    if (project === "/")
        issue(["environment", "projectDir"], "is the root");
    env.tmpDirs.forEach((dir, i) => {
        const tmp = normalisePath(dir);
        if (tmp === "/" || isInside(home, tmp) || isInside(project, tmp)) {
            issue(["environment", "tmpDirs", i], "contains home or the project");
        }
    });
    env.sinkAddresses.forEach((address, i) => {
        if (canonicalIp(address) === null)
            issue(["environment", "sinkAddresses", i], "not an IP address");
    });
    try {
        compileAllowlist(input.allowlist);
    }
    catch {
        issue(["allowlist"], "invalid pattern");
    }
});
/**
 * Validate an untrusted value as a ScanInput. The failure reason is built only from field paths
 * and issue codes, never from the rejected values or zod's messages, which can contain
 * attacker-chosen text.
 */
export function validateScanInput(input) {
    // Check the cheapest limit before parsing, so a huge event array is refused at once.
    if (typeof input === "object" && input !== null && "events" in input) {
        const events = input.events;
        if (Array.isArray(events) && events.length > MAX_EVENTS)
            return { ok: false, reason: "events: too_big" };
    }
    const result = scanInputSchema.safeParse(input);
    if (result.success)
        return { ok: true, value: result.data };
    const parts = result.error.issues.slice(0, 5).map((i) => {
        const where = i.path
            .map((p) => (typeof p === "number" || typeof p === "string" ? String(p) : "?"))
            .join(".");
        const what = i.code === "custom" ? `invalid (${i.message})` : i.code;
        return `${where || "(root)"}: ${what}`;
    });
    return { ok: false, reason: quote(`invalid scan input: ${parts.join("; ")}`, MAX_REASON) };
}
//# sourceMappingURL=schema.js.map