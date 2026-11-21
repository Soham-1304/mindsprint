// POSIX path helpers for paths recorded inside the sandbox. Pure string logic: nothing here
// touches the file system, so symlinks are not resolved (the trace producer resolves them).
/** Path segments after resolving "." and "..". ".." never goes above the root. */
export function segments(path) {
    const out = [];
    for (const part of path.split("/")) {
        if (part === "" || part === ".")
            continue;
        if (part === "..") {
            out.pop();
            continue;
        }
        out.push(part);
    }
    return out;
}
/** An absolute, normalised path: "/" followed by the segments. */
export function normalisePath(path) {
    return `/${segments(path).join("/")}`;
}
/**
 * True when `child` is `root` or inside it. Compares whole segments, so "/a/bc" is not inside
 * "/a/b" (a plain startsWith check would get that wrong).
 */
export function isInside(child, root) {
    const c = segments(child);
    const r = segments(root);
    if (r.length > c.length)
        return false;
    for (let i = 0; i < r.length; i++) {
        if (c[i] !== r[i])
            return false;
    }
    return true;
}
/** isInside for paths already split into segments (so long paths are split only once). */
export function hasPrefix(child, root) {
    if (root.length > child.length)
        return false;
    for (let i = 0; i < root.length; i++) {
        if (child[i] !== root[i])
            return false;
    }
    return true;
}
/** The last segment, or "" for the root. Also works on relative strings such as argv entries. */
export function basename(path) {
    const parts = path.split("/").filter((p) => p !== "");
    return parts[parts.length - 1] ?? "";
}
/** Join an absolute directory and a relative path, then normalise. */
export function joinPath(dir, relative) {
    return normalisePath(`${dir}/${relative}`);
}
//# sourceMappingURL=paths.js.map