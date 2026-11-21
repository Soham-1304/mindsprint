import { BASE_IMAGE_REF } from "./image-spec.js";
/**
 * A strict check of an image Dockerfile, run before every build. It returns fixed-text violations (never
 * a copy of the text it read), and an empty list means the file is acceptable. It is a gate, not a
 * Dockerfile parser: anything it doesn't recognise is a violation (fail closed).
 *
 * The rules keep a build free of the network and of anything the base image didn't already pin: one
 * `FROM` of the pinned base, no `ADD`/`ARG`/`VOLUME`/`HEALTHCHECK`, no package manager or downloader in a
 * `RUN`, only a short list of account and file commands, a non-root `USER`, and an exec-form
 * `ENTRYPOINT` with an absolute path.
 */
export const DOCKERFILE_MESSAGES = {
    notText: "the Dockerfile must be text without NUL bytes",
    tooLarge: "the Dockerfile is too large",
    directive: "parser directives (syntax, escape, check) are not allowed",
    heredoc: "here-documents are not allowed",
    notInstruction: "a line is not a Dockerfile instruction",
    unknownInstruction: "an instruction outside the allowed set is used",
    forbiddenVolume: "VOLUME is not allowed",
    forbiddenAdd: "ADD is not allowed",
    forbiddenArg: "ARG is not allowed",
    forbiddenHealthcheck: "HEALTHCHECK is not allowed",
    fromCount: "exactly one FROM is required",
    fromFirst: "FROM must be the first instruction",
    fromRef: "FROM must be exactly the pinned base image",
    runFlags: "RUN flags are not allowed",
    runShape: "RUN may not use redirects or command substitution",
    runTool: "RUN names a forbidden tool",
    runVerb: "RUN uses a command outside the allowed list",
    productName: "ENV, LABEL and COPY must not contain the product name",
    copyFrom: "COPY --from is not allowed",
    copyPath: "COPY sources must be plain relative paths",
    userMissing: "a USER instruction is required",
    userNotAllowed: "the last USER must be 1000:1000, runner or node",
    entrypointCount: "exactly one ENTRYPOINT is required",
    entrypointForm: "ENTRYPOINT must be exec form (a JSON array of strings)",
    entrypointPath: "the ENTRYPOINT program must be an absolute path and not a shell",
};
const MAX_DOCKERFILE_CHARS = 64 * 1024;
const ALLOWED_INSTRUCTIONS = new Set([
    "FROM",
    "RUN",
    "COPY",
    "ENV",
    "LABEL",
    "WORKDIR",
    "USER",
    "ENTRYPOINT",
]);
const FORBIDDEN_INSTRUCTIONS = {
    VOLUME: DOCKERFILE_MESSAGES.forbiddenVolume,
    ADD: DOCKERFILE_MESSAGES.forbiddenAdd,
    ARG: DOCKERFILE_MESSAGES.forbiddenArg,
    HEALTHCHECK: DOCKERFILE_MESSAGES.forbiddenHealthcheck,
};
/** The only programs a `RUN` may start (account setup and plain file work in the base image). */
export const ALLOWED_RUN_VERBS = [
    "deluser",
    "addgroup",
    "adduser",
    "mkdir",
    "cp",
    "chmod",
];
const FORBIDDEN_RUN_TOOLS = /\b(apk|npm|curl|wget|pip|git|sudo)\b/i;
/** The working product name. It is kept out of image metadata so a rename never leaves a trace in an image. */
const PRODUCT_NAME = /sietch/i;
const ALLOWED_USERS = new Set(["1000:1000", "runner", "node"]);
const SHELL_NAMES = new Set(["sh", "ash", "bash", "dash", "zsh"]);
const DIRECTIVE_LINE = /^#\s*(syntax|escape|check)\s*=/i;
const INSTRUCTION_LINE = /^([A-Za-z]+)(?:\s+([\s\S]*))?$/;
/** Joins `\` continuations and drops comments and blank lines. Parser directives are reported. */
function logicalLines(text, violations) {
    const lines = [];
    let pending = null;
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
        const line = raw.trim();
        if (line.startsWith("#")) {
            if (DIRECTIVE_LINE.test(line))
                violations.add(DOCKERFILE_MESSAGES.directive);
            continue;
        }
        if (line === "")
            continue;
        const continued = line.endsWith("\\");
        const piece = continued ? line.slice(0, -1).trim() : line;
        pending = pending === null ? piece : `${pending} ${piece}`;
        if (!continued) {
            lines.push(pending);
            pending = null;
        }
    }
    if (pending !== null)
        lines.push(pending);
    return lines;
}
function checkRun(args, violations) {
    if (args.startsWith("--"))
        violations.add(DOCKERFILE_MESSAGES.runFlags);
    if (/[<>`]|\$\(/.test(args))
        violations.add(DOCKERFILE_MESSAGES.runShape);
    if (FORBIDDEN_RUN_TOOLS.test(args))
        violations.add(DOCKERFILE_MESSAGES.runTool);
    for (const segment of args.split(/&&|\|\||[;&|]/)) {
        const verb = segment.trim().split(/\s+/)[0] ?? "";
        if (verb !== "" && !ALLOWED_RUN_VERBS.includes(verb))
            violations.add(DOCKERFILE_MESSAGES.runVerb);
        if (verb === "")
            violations.add(DOCKERFILE_MESSAGES.runVerb);
    }
}
function checkCopy(args, violations) {
    const tokens = args.split(/\s+/).filter((token) => token !== "");
    if (tokens.some((token) => /^--from(=|$)/i.test(token)))
        violations.add(DOCKERFILE_MESSAGES.copyFrom);
    // Everything but the last token and the flags is a source.
    const sources = tokens.slice(0, -1).filter((token) => !token.startsWith("--"));
    for (const source of sources) {
        if (source.includes("://") || source.startsWith("/") || source.split("/").includes("..")) {
            violations.add(DOCKERFILE_MESSAGES.copyPath);
        }
    }
}
function checkEntrypoint(args, violations) {
    let parsed;
    try {
        parsed = JSON.parse(args);
    }
    catch {
        violations.add(DOCKERFILE_MESSAGES.entrypointForm);
        return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((item) => typeof item === "string")) {
        violations.add(DOCKERFILE_MESSAGES.entrypointForm);
        return;
    }
    const program = parsed[0];
    const base = program.split("/").pop() ?? "";
    if (!program.startsWith("/") || program.split("/").includes("..") || SHELL_NAMES.has(base)) {
        violations.add(DOCKERFILE_MESSAGES.entrypointPath);
    }
}
/** Returns the violations in `text`, each once, in the order the rules are listed above. */
export function lintDockerfile(text) {
    const violations = new Set();
    if (typeof text !== "string" || text.includes("\0"))
        return [DOCKERFILE_MESSAGES.notText];
    if (text.length > MAX_DOCKERFILE_CHARS)
        return [DOCKERFILE_MESSAGES.tooLarge];
    if (text.includes("<<"))
        violations.add(DOCKERFILE_MESSAGES.heredoc);
    const instructions = [];
    for (const line of logicalLines(text, violations)) {
        const match = INSTRUCTION_LINE.exec(line);
        if (match === null) {
            violations.add(DOCKERFILE_MESSAGES.notInstruction);
            continue;
        }
        instructions.push({ name: (match[1] ?? "").toUpperCase(), args: (match[2] ?? "").trim() });
    }
    const froms = instructions.filter((item) => item.name === "FROM");
    if (froms.length !== 1)
        violations.add(DOCKERFILE_MESSAGES.fromCount);
    if (instructions[0]?.name !== "FROM")
        violations.add(DOCKERFILE_MESSAGES.fromFirst);
    for (const from of froms) {
        if (from.args !== BASE_IMAGE_REF)
            violations.add(DOCKERFILE_MESSAGES.fromRef);
    }
    for (const item of instructions) {
        const forbidden = FORBIDDEN_INSTRUCTIONS[item.name];
        if (forbidden !== undefined) {
            violations.add(forbidden);
            continue;
        }
        if (!ALLOWED_INSTRUCTIONS.has(item.name)) {
            violations.add(DOCKERFILE_MESSAGES.unknownInstruction);
            continue;
        }
        if (item.name === "RUN")
            checkRun(item.args, violations);
        if (item.name === "COPY")
            checkCopy(item.args, violations);
        if ((item.name === "ENV" || item.name === "LABEL" || item.name === "COPY") &&
            PRODUCT_NAME.test(item.args)) {
            violations.add(DOCKERFILE_MESSAGES.productName);
        }
    }
    const users = instructions.filter((item) => item.name === "USER");
    const lastUser = users[users.length - 1];
    if (lastUser === undefined)
        violations.add(DOCKERFILE_MESSAGES.userMissing);
    else if (!ALLOWED_USERS.has(lastUser.args))
        violations.add(DOCKERFILE_MESSAGES.userNotAllowed);
    const entrypoints = instructions.filter((item) => item.name === "ENTRYPOINT");
    if (entrypoints.length !== 1)
        violations.add(DOCKERFILE_MESSAGES.entrypointCount);
    for (const entrypoint of entrypoints)
        checkEntrypoint(entrypoint.args, violations);
    return [...violations];
}
//# sourceMappingURL=dockerfile-lint.js.map