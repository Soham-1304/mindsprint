export type NormaliseErrorCode = "TRACE_TOO_LARGE" | "UNFRAMED_RECORD" | "MALFORMED_RECORD" | "AMBIGUOUS_RECORD" | "UNEXPECTED_SYSCALL" | "UNRESOLVED_PATH" | "TRUNCATED_PATH" | "MISSING_PHASE" | "INTERNAL";
/** Thrown inside the normaliser only, and always caught by normaliseTrace. Never carries record text. */
export declare class TraceFailure extends Error {
    readonly code: NormaliseErrorCode;
    readonly record: number;
    constructor(code: NormaliseErrorCode, record: number);
}
//# sourceMappingURL=errors.d.ts.map