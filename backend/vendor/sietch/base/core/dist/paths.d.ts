/** Path segments after resolving "." and "..". ".." never goes above the root. */
export declare function segments(path: string): string[];
/** An absolute, normalised path: "/" followed by the segments. */
export declare function normalisePath(path: string): string;
/**
 * True when `child` is `root` or inside it. Compares whole segments, so "/a/bc" is not inside
 * "/a/b" (a plain startsWith check would get that wrong).
 */
export declare function isInside(child: string, root: string): boolean;
/** isInside for paths already split into segments (so long paths are split only once). */
export declare function hasPrefix(child: readonly string[], root: readonly string[]): boolean;
/** The last segment, or "" for the root. Also works on relative strings such as argv entries. */
export declare function basename(path: string): string;
/** Join an absolute directory and a relative path, then normalise. */
export declare function joinPath(dir: string, relative: string): string;
//# sourceMappingURL=paths.d.ts.map