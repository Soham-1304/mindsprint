import { type TarPathErrorCode, type TarPathLimits } from "../../tar-path.js";
import { type TarReadErrorCode } from "./tar-reader.js";
/**
 * Extracts one delivery part under a root directory. Init runs it, and init's own file events are dropped
 * from the trace, so this code and the tar-path validator are the only guard on where entries land.
 *
 * The tar-path validator is asked about every header before anything is written. Names are written only
 * under the `name` it returns, joined to `root` and checked to still be inside it. The extractor adds what
 * the validator can't see: it makes directories one segment at a time and refuses any segment that is
 * already a symlink or a file (so a link that is already on disk is never followed), it creates files with
 * `O_EXCL` and `O_NOFOLLOW` (so a duplicate or a link in the last segment fails), and it masks every mode
 * to `0o777`. A directory always keeps the owner's read, write and execute bits so later entries can be
 * written into it.
 *
 * The first problem ends the extraction with a typed result. Entries written before it stay on disk: the
 * caller (init) exits without starting install, and the container is destroyed.
 */
export type ExtractErrorCode = TarPathErrorCode | TarReadErrorCode | "EXTRACT_ESCAPE" | "EXTRACT_NOT_DIRECTORY" | "EXTRACT_DUPLICATE" | "EXTRACT_TOP_LEVEL" | "EXTRACT_IO";
export type ExtractResult = {
    readonly ok: true;
    readonly files: number;
    readonly directories: number;
} | {
    readonly ok: false;
    readonly code: ExtractErrorCode;
    readonly reason: string;
};
export type PathKind = "directory" | "file" | "symlink" | "other";
/** The file system calls the extractor makes. Tests use the real one on a temp directory. */
export interface ExtractFs {
    /** What is at `path` without following a link, or `null` if nothing is. */
    kind(path: string): Promise<PathKind | null>;
    /** One directory, not recursive. */
    mkdir(path: string, mode: number): Promise<void>;
    /** A new file that must not exist and must not be reached through a link in its last segment. */
    createFile(path: string, data: Uint8Array, mode: number): Promise<void>;
}
export interface ExtractOptions {
    /** An absolute directory that already exists. */
    readonly root: string;
    readonly limits: TarPathLimits;
    /** When set, the first path segment of every entry must be one of these (the cache part: `_cacache`). */
    readonly allowedTopLevel?: readonly string[];
    readonly fs?: ExtractFs;
}
/** Permission bits only. The setuid, setgid and sticky bits and any file type bits are dropped. */
export declare function maskMode(mode: number): number;
export declare function createNodeExtractFs(): ExtractFs;
export declare function extractTar(bytes: Uint8Array, options: ExtractOptions): Promise<ExtractResult>;
//# sourceMappingURL=extract.d.ts.map