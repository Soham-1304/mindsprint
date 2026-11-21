/**
 * Normalise an HTTP path for matching: decode percent-escapes once, lowercase, collapse repeated
 * slashes, and drop the query. Servers often accept "//-/whoami" or "/%2D/whoami", so the rules
 * must too.
 */
export declare function normaliseHttpPath(path: string): string;
//# sourceMappingURL=http-path.d.ts.map