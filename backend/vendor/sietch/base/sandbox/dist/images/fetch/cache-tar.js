import { CACHE_ARCHIVE_ROOT, TAR_PROGRAM } from "./limits.js";
/** The `tar` argument vector. Every value is a constant of this image. */
export function cacheTarArgv(cacheDir, outFile) {
    return ["-C", cacheDir, "-cf", outFile, CACHE_ARCHIVE_ROOT];
}
export async function createCacheTar(deps, options) {
    let code;
    try {
        code = await deps.run(TAR_PROGRAM, cacheTarArgv(options.cacheDir, options.outFile));
    }
    catch {
        return { ok: false, reason: "tar could not run" };
    }
    if (code !== 0)
        return { ok: false, reason: "tar failed" };
    let size;
    try {
        size = await deps.fileSize(options.outFile);
    }
    catch {
        return { ok: false, reason: "the cache archive could not be read" };
    }
    if (!Number.isSafeInteger(size) || size <= 0)
        return { ok: false, reason: "the cache archive is empty" };
    if (size > options.maxBytes)
        return { ok: false, reason: "the cache archive is over the size cap" };
    return { ok: true, size };
}
//# sourceMappingURL=cache-tar.js.map