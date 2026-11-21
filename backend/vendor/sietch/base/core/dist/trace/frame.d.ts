export declare const MAX_LOG_CHARS: number;
export declare const MAX_RECORDS = 500000;
export interface StraceRecord {
    /** 1-based line number, for error messages. */
    readonly line: number;
    /** The message after "strace.go:<n>] ". */
    readonly body: string;
    readonly timeMs: number;
}
/** Records from strace, in log order. Throws TraceFailure on anything that isn't clean framing. */
export declare function frameLog(log: string): StraceRecord[];
/** Most records one line may hold. The boot race puts two or three on a line; more is not gVisor. */
export declare const MAX_GLUED_RECORDS = 8;
export declare function isDigits(s: string): boolean;
/** Milliseconds since the Unix epoch for an RFC 3339 timestamp, or null. Pure (no Date). */
export declare function parseRfc3339(s: string): number | null;
//# sourceMappingURL=frame.d.ts.map