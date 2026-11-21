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
export declare const DOCKERFILE_MESSAGES: {
    readonly notText: "the Dockerfile must be text without NUL bytes";
    readonly tooLarge: "the Dockerfile is too large";
    readonly directive: "parser directives (syntax, escape, check) are not allowed";
    readonly heredoc: "here-documents are not allowed";
    readonly notInstruction: "a line is not a Dockerfile instruction";
    readonly unknownInstruction: "an instruction outside the allowed set is used";
    readonly forbiddenVolume: "VOLUME is not allowed";
    readonly forbiddenAdd: "ADD is not allowed";
    readonly forbiddenArg: "ARG is not allowed";
    readonly forbiddenHealthcheck: "HEALTHCHECK is not allowed";
    readonly fromCount: "exactly one FROM is required";
    readonly fromFirst: "FROM must be the first instruction";
    readonly fromRef: "FROM must be exactly the pinned base image";
    readonly runFlags: "RUN flags are not allowed";
    readonly runShape: "RUN may not use redirects or command substitution";
    readonly runTool: "RUN names a forbidden tool";
    readonly runVerb: "RUN uses a command outside the allowed list";
    readonly productName: "ENV, LABEL and COPY must not contain the product name";
    readonly copyFrom: "COPY --from is not allowed";
    readonly copyPath: "COPY sources must be plain relative paths";
    readonly userMissing: "a USER instruction is required";
    readonly userNotAllowed: "the last USER must be 1000:1000, runner or node";
    readonly entrypointCount: "exactly one ENTRYPOINT is required";
    readonly entrypointForm: "ENTRYPOINT must be exec form (a JSON array of strings)";
    readonly entrypointPath: "the ENTRYPOINT program must be an absolute path and not a shell";
};
/** The only programs a `RUN` may start (account setup and plain file work in the base image). */
export declare const ALLOWED_RUN_VERBS: readonly string[];
/** Returns the violations in `text`, each once, in the order the rules are listed above. */
export declare function lintDockerfile(text: string): readonly string[];
//# sourceMappingURL=dockerfile-lint.d.ts.map