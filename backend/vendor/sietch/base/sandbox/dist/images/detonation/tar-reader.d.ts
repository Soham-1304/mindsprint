import { type TarEntryType } from "../../tar-path.js";
/**
 * A reader for one whole tar part held in memory (a delivery part is already a whole `Uint8Array` by the
 * time init has it). Pure, and compiled into the detonation entrypoint. It never throws: a malformed
 * archive ends the walk with one typed error.
 *
 * It reads the headers the two writers produce: ustar (the fake-home builder) and the GNU/ustar flavour
 * busybox `tar` writes for the npm cache, including the pax (`x`) and GNU long-name (`L`) headers that
 * precede an entry. It decides nothing about names, types or sizes: it hands each header to the caller,
 * which asks the tar-path validator whether the entry may be extracted. What it does check is that the
 * bytes are a well-formed archive: the header checksum, the magic, plain octal numbers (the base-256
 * form is refused), data that is all there, two zero blocks at the end, and nothing but zero padding after.
 *
 * A reason is fixed text and never carries entry names or archive bytes.
 */
export type TarReadErrorCode = "TAR_BAD_HEADER" | "TAR_BAD_CHECKSUM" | "TAR_BAD_FIELD" | "TAR_TRUNCATED" | "TAR_TRAILING_BYTES";
export interface TarReadError {
    readonly code: TarReadErrorCode;
    readonly reason: string;
}
export interface TarItem {
    /** The full path as stored: the ustar `prefix` and `name` joined. For an extension header, its own name. */
    readonly name: string;
    readonly type: TarEntryType;
    /** The size field. For a file or extension header this is the length of `data`. */
    readonly size: number;
    /** Permission bits as stored (the extractor masks them). */
    readonly mode: number;
    /** A view into the input, exactly `size` bytes. Do not keep it past the input's life. */
    readonly data: Uint8Array;
}
export type TarReadStep = {
    readonly ok: true;
    readonly item: TarItem;
} | {
    readonly ok: false;
    readonly error: TarReadError;
};
/**
 * Walks the archive one header at a time. The generator ends after the end marker, or after the first
 * error step. It never throws.
 */
export declare function readTar(bytes: Uint8Array): Generator<TarReadStep, void, undefined>;
//# sourceMappingURL=tar-reader.d.ts.map