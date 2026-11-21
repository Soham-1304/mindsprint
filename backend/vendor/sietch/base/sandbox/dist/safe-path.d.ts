/**
 * One path segment the fake home and the tar builder accept: ASCII letters, digits, and `. _ @ + = , ~ -`.
 * Hidden names such as `.npmrc` are fine. `.` and `..` are not, and neither is anything with a space,
 * a control character, a backslash, or a non-ASCII character.
 */
export declare const SAFE_SEGMENT: RegExp;
//# sourceMappingURL=safe-path.d.ts.map