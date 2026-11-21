import { SietchError } from "@sietch/core";
/**
 * The tar-path validator (Requirement 14). Pure, and compiled into the detonation entrypoint, which
 * extracts both delivery parts as init, whose own file events are dropped from the trace. This check is
 * therefore the only guard on where those entries land.
 *
 * The extractor calls `check` once per header, in archive order, before it writes anything for that
 * entry, and writes only under the `name` that `check` returned. The first rejection is final: every
 * later call returns the same rejection, and the entrypoint exits without starting install. A rejection's
 * `reason` is fixed text and never carries entry names.
 *
 * What is rejected: `..` segments, absolute names, empty or oversized or control-character names, every
 * symlink and hardlink, devices, FIFOs, unknown entry types, sizes that are not whole non-negative
 * numbers, entries over `maxEntryBytes`, more than `maxEntries` entries, and an archive whose headers
 * plus padded data exceed `maxTotalBytes`.
 *
 * Links are rejected outright rather than resolved. Resolving a link target lexically is unsound once a
 * hardlink can name a symlink, or a symlink can be re-pointed by a later entry, and the two delivery
 * parts hold only regular files and directories (the fake home, and `_cacache` content and index files).
 * Rejecting them removes the whole class and with it any need to track what earlier entries created.
 *
 * Long names. A real `_cacache` tree has names longer than the 100-byte ustar field, so a tar writer
 * emits a pax extended header (flag `x`) or a GNU long-name header (flag `L`) before the entry. These
 * are accepted in a narrow form. The extractor reads the header's data (at most `MAX_TAR_META_BYTES`),
 * hands it to `applyMeta`, and the validator checks the resulting name instead of the entry's own. A
 * pax header may carry only `path` and `size`; `size` must equal the entry's header size. Anything else
 * in a pax header is rejected, as are the global pax header (`g`), the GNU long-link header (`K`), two
 * extension headers in a row, and an extension header not followed by a regular file or directory.
 * Call `finish` at the end of the archive to catch a trailing extension header.
 *
 * Modes. An entry may carry its `mode`. A mode with any of the setuid, setgid or sticky bits (`0o7000`)
 * is rejected, so such an archive never starts extraction. An entry that omits `mode` is not checked
 * for it. The extractor also masks every mode to `0o777` before it creates anything (defence in depth;
 * the container is non-root with `no-new-privileges`).
 *
 * Extension data. `applyMeta` requires exactly as many bytes as the extension header declared in the
 * size that `check` charged against the caps, so the archive can't charge a small header and hand over
 * a different amount of data.
 */
export type TarEntryType = "file" | "directory" | "symlink" | "hardlink" | "character-device" | "block-device" | "fifo" | "pax-header" | "gnu-long-name" | "unknown";
export interface TarPathEntry {
    /** The entry's full path as stored in the archive (prefix and name already joined). */
    readonly name: string;
    readonly type: TarEntryType;
    /** Data bytes that follow the header. Must be 0 for everything except a regular file and an extension header. */
    readonly size: number;
    /** The header's permission bits, when the caller has them. Any bit in `0o7000` rejects the entry. */
    readonly mode?: number;
}
export interface TarPathLimits {
    readonly maxEntryBytes: number;
    readonly maxTotalBytes: number;
    readonly maxEntries: number;
}
export type TarPathErrorCode = "TAR_BAD_NAME" | "TAR_ABSOLUTE_PATH" | "TAR_PATH_ESCAPE" | "TAR_LINK_UNSUPPORTED" | "TAR_DEVICE" | "TAR_FIFO" | "TAR_UNSUPPORTED_TYPE" | "TAR_BAD_SIZE" | "TAR_BAD_META" | "TAR_BAD_MODE" | "TAR_ENTRY_TOO_LARGE" | "TAR_ARCHIVE_TOO_LARGE" | "TAR_TOO_MANY_ENTRIES";
export type TarPathResult = 
/** `name` is the name to extract under, present for a file or directory and absent for an extension header. */
{
    readonly ok: true;
    readonly name?: string;
} | {
    readonly ok: false;
    readonly code: TarPathErrorCode;
    readonly reason: string;
};
/** The fake-home part: small, few entries. */
export declare const HOME_TAR_LIMITS: TarPathLimits;
/** The dependency-cache part: an npm cache has several files per package. */
export declare const DEPS_TAR_LIMITS: TarPathLimits;
/** The largest pax or GNU long-name data the validator accepts. A path is at most 4096 characters. */
export declare const MAX_TAR_META_BYTES = 8192;
export declare class TarPathConfigError extends SietchError {
    constructor(message: string);
}
/** Map a tar header type flag to an entry type. Anything not listed is `unknown`, which is rejected. */
export declare function tarEntryTypeFromFlag(flag: string): TarEntryType;
export declare class TarPathValidator {
    #private;
    constructor(limits: TarPathLimits);
    /** Check one header, in archive order. Never throws. After a rejection it keeps returning that rejection. */
    check(entry: TarPathEntry): TarPathResult;
    /**
     * Hand over the data of the extension header that `check` just accepted. Call it after reading exactly
     * that header's `size` bytes (at most `MAX_TAR_META_BYTES`), before the next `check`.
     */
    applyMeta(data: Uint8Array): TarPathResult;
    /** Call at the end of the archive. Rejects an extension header that no entry followed. */
    finish(): TarPathResult;
}
/** A fresh validator for one archive. */
export declare function createTarPathValidator(limits: TarPathLimits): TarPathValidator;
//# sourceMappingURL=tar-path.d.ts.map