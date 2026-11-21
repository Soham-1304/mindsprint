import { SietchError } from "@sietch/core";
/**
 * Length-prefixed framing for the two byte streams the runner handles: the delivery stream it writes to
 * the detonation entrypoint's stdin (`[u64 length][fake-home tar][u64 length][cache tar]`) and the fetch
 * container's stdout (lockfile, report, cache tar). Pure.
 *
 * Each part is an 8-byte big-endian length followed by exactly that many bytes. The caller names one cap
 * per part. The decoder checks a length against its cap when the header is complete, before it keeps a
 * single body byte, and it demands exact lengths and no trailing bytes. It never throws on any input:
 * it returns a typed error. Only the encoder throws, and only for a caller bug (a part over its cap).
 */
export declare const FRAME_HEADER_BYTES = 8;
export type FrameErrorCode = "FRAME_OVER_CAP" | "FRAME_TRUNCATED" | "FRAME_TRAILING_BYTES";
export interface FrameError {
    readonly code: FrameErrorCode;
    /** Zero-based index of the part where the problem was found. */
    readonly part: number;
    /** Fixed text built from the part index and the cap only, never from stream content. */
    readonly reason: string;
}
export type DecodeResult = {
    readonly ok: true;
    readonly parts: readonly Uint8Array[];
} | {
    readonly ok: false;
    readonly error: FrameError;
};
/** The encoder was asked for something the format can't carry. A bug in the caller, not in a stream. */
export declare class FramingError extends SietchError {
    constructor(message: string);
}
/** Encode parts as `[u64 length][bytes]` frames, one cap per part. Throws `FramingError` on a bug. */
export declare function encodeFrames(parts: readonly Uint8Array[], caps: readonly number[]): Uint8Array;
/**
 * A streaming decoder. Feed it chunks with `push`, then call `finish`. After the first error it is
 * finished: it ignores further input and `finish` returns that error.
 */
export declare class FrameDecoder {
    #private;
    constructor(caps: readonly number[]);
    /** Feed one chunk. Returns the error if this or an earlier chunk was bad, otherwise undefined. */
    push(chunk: Uint8Array): FrameError | undefined;
    /** The decoded parts, or the first error. A stream that ended early is `FRAME_TRUNCATED`. */
    finish(): DecodeResult;
}
/** Decode a complete stream held in memory. Never throws for any `bytes`. */
export declare function decodeFrames(bytes: Uint8Array, caps: readonly number[]): DecodeResult;
//# sourceMappingURL=framing.d.ts.map