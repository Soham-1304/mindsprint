import { SietchError } from "@sietch/core";
import type { FakeHome } from "./fake-home.js";
/**
 * A tar stream (ustar) built from an in-memory tree. Pure. The runner builds the fake-home part of the
 * delivery stream with it. The detonation entrypoint extracts it through the tar-path validator.
 *
 * The builder refuses to write an entry that the validator would reject (an absolute name, a `..` or
 * `.` segment, a name with characters outside a safe set), so the two sides agree by construction. It
 * writes only regular files and directories: no links, devices, or FIFOs.
 */
export declare class TarBuildError extends SietchError {
    constructor(message: string);
}
export interface TarEntry {
    /** Relative path with `/` separators, no leading `/`, no `.` or `..` segment. */
    readonly name: string;
    readonly type: "file" | "directory";
    /** Permission bits, 0 to 0o777. */
    readonly mode: number;
    /** File content. Omitted for a directory. */
    readonly data?: Uint8Array;
}
export interface TarOptions {
    /** Modification time of every entry, in whole seconds. Injected, so the output is reproducible. */
    readonly mtimeSeconds: number;
    readonly uid?: number;
    readonly gid?: number;
    readonly uname?: string;
    readonly gname?: string;
    /** The finished stream may not exceed this many bytes. Defaults to `MAX_HOME_BYTES`. */
    readonly maxBytes?: number;
}
/** Build the tar stream: each entry's header and padded data, then two zero blocks. */
export declare function buildTar(entries: readonly TarEntry[], options: TarOptions): Uint8Array;
/** The fake-home part of the delivery stream: directories first, then files, named relative to the home. */
export declare function fakeHomeTar(home: FakeHome, options: TarOptions): Uint8Array;
//# sourceMappingURL=tar.d.ts.map