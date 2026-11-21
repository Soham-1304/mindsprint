/**
 * True for characters that can rewrite or disguise what a terminal, log, or page shows:
 * C0 and C1 control characters (including ESC, CR, and NUL), DEL, the Unicode line and paragraph
 * separators, and the bidirectional overrides and isolates.
 */
export declare function isUnsafeChar(code: number): boolean;
/** True if the string contains any character `isUnsafeChar` rejects. */
export declare function hasUnsafeChars(value: string): boolean;
/**
 * Make an untrusted value safe to show inside a finding: unsafe characters become visible
 * `\u{…}` escapes, and the result is capped at `max` characters (ending with "…" when cut).
 */
export declare function quote(value: string, max?: number): string;
/** Show only the start of a honeytoken, so findings never contain the full value. */
export declare function redactToken(value: string): string;
//# sourceMappingURL=text.d.ts.map