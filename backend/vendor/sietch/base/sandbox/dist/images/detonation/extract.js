import { constants } from "node:fs";
import { chmod, lstat, mkdir, open } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createTarPathValidator } from "../../tar-path.js";
import { readTar } from "./tar-reader.js";
const REASONS = {
    EXTRACT_ESCAPE: "an entry resolves outside the extraction root",
    EXTRACT_NOT_DIRECTORY: "an entry path runs through something that is not a directory",
    EXTRACT_DUPLICATE: "an entry would replace something that already exists",
    EXTRACT_TOP_LEVEL: "an entry is outside the allowed top-level names",
    EXTRACT_IO: "a file could not be written",
};
/** Permission bits only. The setuid, setgid and sticky bits and any file type bits are dropped. */
export function maskMode(mode) {
    return mode & 0o777;
}
const DIRECTORY_OWNER_BITS = 0o700;
export function createNodeExtractFs() {
    return {
        async kind(path) {
            try {
                const info = await lstat(path);
                if (info.isSymbolicLink())
                    return "symlink";
                if (info.isDirectory())
                    return "directory";
                return info.isFile() ? "file" : "other";
            }
            catch (error) {
                if (error.code === "ENOENT")
                    return null;
                throw error;
            }
        },
        async mkdir(path, mode) {
            await mkdir(path, { mode });
            await chmod(path, mode);
        },
        async createFile(path, data, mode) {
            const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
            try {
                await handle.writeFile(data);
                await handle.chmod(mode);
            }
            finally {
                await handle.close();
            }
        },
    };
}
function fail(code, reason) {
    return { ok: false, code, reason };
}
function refuse(code) {
    return fail(code, REASONS[code]);
}
/** The name's real segments: empty and `.` segments dropped. `..` can't reach here, but is refused anyway. */
function segmentsOf(name) {
    const segments = [];
    for (const segment of name.split("/")) {
        if (segment === "" || segment === ".")
            continue;
        if (segment === "..")
            return null;
        segments.push(segment);
    }
    return segments;
}
function insideRoot(root, path) {
    const rel = relative(root, path);
    return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
export async function extractTar(bytes, options) {
    try {
        return await extract(bytes, options);
    }
    catch {
        return refuse("EXTRACT_IO");
    }
}
async function extract(bytes, options) {
    const { limits, allowedTopLevel } = options;
    const fs = options.fs ?? createNodeExtractFs();
    if (!isAbsolute(options.root))
        return refuse("EXTRACT_ESCAPE");
    const root = resolve(options.root);
    const validator = createTarPathValidator(limits);
    let files = 0;
    let directories = 0;
    /** Makes every directory on the way to `segments`, one at a time. Returns an error result or null. */
    const ensureDirectories = async (segments, finalMode) => {
        let current = root;
        for (let index = 0; index < segments.length; index++) {
            current = `${current}${sep}${segments[index]}`;
            if (!insideRoot(root, current))
                return refuse("EXTRACT_ESCAPE");
            const last = index === segments.length - 1;
            const existing = await fs.kind(current);
            if (existing === null) {
                await fs.mkdir(current, last && finalMode !== null ? finalMode : 0o755);
                if (last && finalMode !== null)
                    directories += 1;
            }
            else if (existing !== "directory") {
                return refuse("EXTRACT_NOT_DIRECTORY");
            }
        }
        return null;
    };
    for (const step of readTar(bytes)) {
        if (!step.ok)
            return fail(step.error.code, step.error.reason);
        const { item } = step;
        const checked = validator.check({ name: item.name, type: item.type, size: item.size, mode: item.mode });
        if (!checked.ok)
            return fail(checked.code, checked.reason);
        if (item.type === "pax-header" || item.type === "gnu-long-name") {
            const applied = validator.applyMeta(item.data);
            if (!applied.ok)
                return fail(applied.code, applied.reason);
            continue;
        }
        if (checked.name === undefined)
            return fail("TAR_BAD_NAME", "an entry name is empty");
        const segments = segmentsOf(checked.name);
        if (segments === null)
            return fail("TAR_PATH_ESCAPE", "an entry name has a '..' segment");
        if (segments.length === 0) {
            // The archive root itself ("./"): it exists already.
            if (item.type === "directory")
                continue;
            return fail("TAR_BAD_NAME", "an entry name is empty");
        }
        if (allowedTopLevel !== undefined && !allowedTopLevel.includes(segments[0] ?? "")) {
            return refuse("EXTRACT_TOP_LEVEL");
        }
        const mode = maskMode(item.mode);
        if (item.type === "directory") {
            const failure = await ensureDirectories(segments, mode | DIRECTORY_OWNER_BITS);
            if (failure !== null)
                return failure;
            continue;
        }
        const failure = await ensureDirectories(segments.slice(0, -1), null);
        if (failure !== null)
            return failure;
        const path = `${root}${sep}${segments.join(sep)}`;
        if (!insideRoot(root, path))
            return refuse("EXTRACT_ESCAPE");
        if ((await fs.kind(path)) !== null)
            return refuse("EXTRACT_DUPLICATE");
        await fs.createFile(path, item.data, mode);
        files += 1;
    }
    const finished = validator.finish();
    if (!finished.ok)
        return fail(finished.code, finished.reason);
    return { ok: true, files, directories };
}
//# sourceMappingURL=extract.js.map