import { SietchError } from "@sietch/core";
import { MAX_DEPS_BYTES, MAX_HOME_BYTES } from "./limits.js";
/** The fake-home part: small, few entries. */
export const HOME_TAR_LIMITS = {
    maxEntryBytes: MAX_HOME_BYTES,
    maxTotalBytes: MAX_HOME_BYTES,
    maxEntries: 1_000,
};
/** The dependency-cache part: an npm cache has several files per package. */
export const DEPS_TAR_LIMITS = {
    maxEntryBytes: MAX_DEPS_BYTES,
    maxTotalBytes: MAX_DEPS_BYTES,
    maxEntries: 200_000,
};
/** The largest pax or GNU long-name data the validator accepts. A path is at most 4096 characters. */
export const MAX_TAR_META_BYTES = 8192;
export class TarPathConfigError extends SietchError {
    constructor(message) {
        super("TAR_PATH_CONFIG_INVALID", message);
    }
}
const BLOCK = 512;
const MAX_NAME_LENGTH = 4096;
const MAX_SEGMENT_LENGTH = 255;
const REASONS = {
    TAR_BAD_NAME: "an entry name is empty, too long, or has a control character or backslash",
    TAR_ABSOLUTE_PATH: "an entry name is absolute",
    TAR_PATH_ESCAPE: "an entry name has a '..' segment",
    TAR_LINK_UNSUPPORTED: "a symlink or hardlink entry",
    TAR_DEVICE: "a device entry",
    TAR_FIFO: "a FIFO entry",
    TAR_UNSUPPORTED_TYPE: "an entry of an unsupported type",
    TAR_BAD_SIZE: "an entry has an invalid size",
    TAR_BAD_META: "a pax or long-name header is malformed or misplaced",
    TAR_BAD_MODE: "an entry has a setuid, setgid or sticky bit, or a mode that is not a whole number",
    TAR_ENTRY_TOO_LARGE: "an entry is over the per-entry size cap",
    TAR_ARCHIVE_TOO_LARGE: "the archive is over the total size cap",
    TAR_TOO_MANY_ENTRIES: "the archive has too many entries",
};
/** Map a tar header type flag to an entry type. Anything not listed is `unknown`, which is rejected. */
export function tarEntryTypeFromFlag(flag) {
    switch (flag) {
        case "0":
        case "\0":
        case "":
            return "file";
        case "1":
            return "hardlink";
        case "2":
            return "symlink";
        case "3":
            return "character-device";
        case "4":
            return "block-device";
        case "5":
            return "directory";
        case "6":
            return "fifo";
        case "x":
            return "pax-header";
        case "L":
            return "gnu-long-name";
        default:
            return "unknown";
    }
}
function hasForbiddenChar(text) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x20 || code === 0x7f || code === 0x5c)
            return true;
    }
    return false;
}
/** Check a name's segments. `.` and empty segments are harmless; `..` is rejected outright. */
function checkName(name) {
    if (name.length === 0 || name.length > MAX_NAME_LENGTH || hasForbiddenChar(name)) {
        return { ok: false, code: "TAR_BAD_NAME" };
    }
    if (name.startsWith("/"))
        return { ok: false, code: "TAR_ABSOLUTE_PATH" };
    let empty = true;
    for (const segment of name.split("/")) {
        if (segment === "" || segment === ".")
            continue;
        if (segment === "..")
            return { ok: false, code: "TAR_PATH_ESCAPE" };
        if (segment.length > MAX_SEGMENT_LENGTH)
            return { ok: false, code: "TAR_BAD_NAME" };
        empty = false;
    }
    return { ok: true, empty };
}
const FATAL_UTF8 = new TextDecoder("utf-8", { fatal: true });
const PAX_LENGTH = /^[1-9][0-9]{0,5}$/;
const PAX_SIZE = /^(?:0|[1-9][0-9]{0,15})$/;
/**
 * Parse the data of a pax extended header: records of `<length> <key>=<value>\n`, where `<length>` counts
 * the whole record. Only `path` and `size` are accepted, each at most once.
 */
function parsePax(data) {
    let path;
    let size;
    let pos = 0;
    while (pos < data.length) {
        let space = pos;
        while (space < data.length && space - pos <= 7 && data[space] !== 0x20)
            space += 1;
        if (data[space] !== 0x20)
            return { ok: false };
        const digits = new TextDecoder("ascii").decode(data.subarray(pos, space));
        if (!PAX_LENGTH.test(digits))
            return { ok: false };
        const length = Number(digits);
        const end = pos + length;
        if (end > data.length || length <= space - pos + 1 || data[end - 1] !== 0x0a)
            return { ok: false };
        let body;
        try {
            body = FATAL_UTF8.decode(data.subarray(space + 1, end - 1));
        }
        catch {
            return { ok: false };
        }
        const equals = body.indexOf("=");
        if (equals < 1)
            return { ok: false };
        const key = body.slice(0, equals);
        const value = body.slice(equals + 1);
        if (key === "path" && path === undefined) {
            path = value;
        }
        else if (key === "size" && size === undefined && PAX_SIZE.test(value)) {
            size = Number(value);
        }
        else {
            return { ok: false };
        }
        pos = end;
    }
    if (path === undefined && size === undefined)
        return { ok: false };
    return {
        ok: true,
        override: { ...(path === undefined ? {} : { path }), ...(size === undefined ? {} : { size }) },
    };
}
/** Parse the data of a GNU long-name header: the name, NUL-terminated and padded with NULs. */
function parseLongName(data) {
    let end = data.length;
    while (end > 0 && data[end - 1] === 0)
        end -= 1;
    if (end === 0)
        return { ok: false };
    try {
        return { ok: true, override: { path: FATAL_UTF8.decode(data.subarray(0, end)) } };
    }
    catch {
        return { ok: false };
    }
}
export class TarPathValidator {
    #limits;
    #entries = 0;
    #total = 0;
    #rejection;
    /** An extension header was checked and its data has not been applied yet. */
    #awaiting;
    /** The size `check` charged for the extension header in `#awaiting`. */
    #awaitingSize = 0;
    /** An extension header was applied and the entry it describes has not arrived yet. */
    #override;
    constructor(limits) {
        for (const value of [limits.maxEntryBytes, limits.maxTotalBytes, limits.maxEntries]) {
            if (!Number.isSafeInteger(value) || value < 0) {
                throw new TarPathConfigError("limits must be non-negative integers");
            }
        }
        this.#limits = { ...limits };
    }
    /** Check one header, in archive order. Never throws. After a rejection it keeps returning that rejection. */
    check(entry) {
        if (this.#rejection !== undefined)
            return this.#rejection;
        const outcome = this.#find(entry);
        if (typeof outcome === "string")
            return this.#reject(outcome);
        return outcome;
    }
    /**
     * Hand over the data of the extension header that `check` just accepted. Call it after reading exactly
     * that header's `size` bytes (at most `MAX_TAR_META_BYTES`), before the next `check`.
     */
    applyMeta(data) {
        if (this.#rejection !== undefined)
            return this.#rejection;
        const kind = this.#awaiting;
        if (kind === undefined || data.length > MAX_TAR_META_BYTES || data.length !== this.#awaitingSize) {
            return this.#reject("TAR_BAD_META");
        }
        const parsed = kind === "pax-header" ? parsePax(data) : parseLongName(data);
        if (!parsed.ok)
            return this.#reject("TAR_BAD_META");
        this.#awaiting = undefined;
        this.#override = parsed.override;
        return { ok: true };
    }
    /** Call at the end of the archive. Rejects an extension header that no entry followed. */
    finish() {
        if (this.#rejection !== undefined)
            return this.#rejection;
        if (this.#awaiting !== undefined || this.#override !== undefined)
            return this.#reject("TAR_BAD_META");
        return { ok: true };
    }
    #reject(code) {
        this.#rejection = { ok: false, code, reason: REASONS[code] };
        return this.#rejection;
    }
    #find(entry) {
        this.#entries += 1;
        if (this.#entries > this.#limits.maxEntries)
            return "TAR_TOO_MANY_ENTRIES";
        // The data of the previous extension header must have been applied before the next header.
        if (this.#awaiting !== undefined)
            return "TAR_BAD_META";
        const meta = entry.type === "pax-header" || entry.type === "gnu-long-name";
        switch (entry.type) {
            case "file":
            case "directory":
            case "pax-header":
            case "gnu-long-name":
                break;
            case "symlink":
            case "hardlink":
                return "TAR_LINK_UNSUPPORTED";
            case "character-device":
            case "block-device":
                return "TAR_DEVICE";
            case "fifo":
                return "TAR_FIFO";
            default:
                return "TAR_UNSUPPORTED_TYPE";
        }
        // An extension header may only be followed by a file or a directory.
        if (this.#override !== undefined && meta)
            return "TAR_BAD_META";
        // A name that is never written (an extension header's own name) is not checked. The name that is
        // written is the override's, if there is one.
        const name = meta ? undefined : (this.#override?.path ?? entry.name);
        if (name !== undefined) {
            const checked = checkName(name);
            if (!checked.ok)
                return checked.code;
            // A file at the root itself (name "." or "./") has no place; only a directory may name the root.
            if (checked.empty && entry.type !== "directory")
                return "TAR_BAD_NAME";
        }
        if (entry.mode !== undefined &&
            (!Number.isInteger(entry.mode) || entry.mode < 0 || (entry.mode & 0o7000) !== 0)) {
            return "TAR_BAD_MODE";
        }
        // Size: a whole number, zero for everything but a regular file and an extension header, and within both caps.
        if (!Number.isSafeInteger(entry.size) || entry.size < 0)
            return "TAR_BAD_SIZE";
        if (entry.type !== "file" && !meta && entry.size !== 0)
            return "TAR_BAD_SIZE";
        if (meta && (entry.size === 0 || entry.size > MAX_TAR_META_BYTES))
            return "TAR_BAD_META";
        if (entry.size > this.#limits.maxEntryBytes)
            return "TAR_ENTRY_TOO_LARGE";
        if (this.#override?.size !== undefined && this.#override.size !== entry.size)
            return "TAR_BAD_SIZE";
        const padded = Math.ceil(entry.size / BLOCK) * BLOCK;
        if (this.#total + BLOCK + padded > this.#limits.maxTotalBytes)
            return "TAR_ARCHIVE_TOO_LARGE";
        this.#total += BLOCK + padded;
        if (meta) {
            this.#awaiting = entry.type === "pax-header" ? "pax-header" : "gnu-long-name";
            this.#awaitingSize = entry.size;
            return { ok: true };
        }
        this.#override = undefined;
        return name === undefined ? { ok: true } : { ok: true, name };
    }
}
/** A fresh validator for one archive. */
export function createTarPathValidator(limits) {
    return new TarPathValidator(limits);
}
//# sourceMappingURL=tar-path.js.map