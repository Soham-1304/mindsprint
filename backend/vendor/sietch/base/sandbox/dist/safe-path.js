/**
 * One path segment the fake home and the tar builder accept: ASCII letters, digits, and `. _ @ + = , ~ -`.
 * Hidden names such as `.npmrc` are fine. `.` and `..` are not, and neither is anything with a space,
 * a control character, a backslash, or a non-ASCII character.
 */
export const SAFE_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._@+=,~-]+$/;
//# sourceMappingURL=safe-path.js.map