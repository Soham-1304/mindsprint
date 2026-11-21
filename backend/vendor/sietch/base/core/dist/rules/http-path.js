import { percentDecode } from "../encoding.js";
/**
 * Normalise an HTTP path for matching: decode percent-escapes once, lowercase, collapse repeated
 * slashes, and drop the query. Servers often accept "//-/whoami" or "/%2D/whoami", so the rules
 * must too.
 */
export function normaliseHttpPath(path) {
    const noQuery = path.split("?")[0] ?? "";
    return percentDecode(noQuery)
        .toLowerCase()
        .replace(/\/{2,}/g, "/");
}
//# sourceMappingURL=http-path.js.map