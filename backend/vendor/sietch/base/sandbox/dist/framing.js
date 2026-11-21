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
export const FRAME_HEADER_BYTES = 8;
/** The encoder was asked for something the format can't carry. A bug in the caller, not in a stream. */
export class FramingError extends SietchError {
    constructor(message) {
        super("FRAMING_FAILED", message);
    }
}
function checkCaps(caps) {
    if (caps.length === 0)
        throw new FramingError("at least one part cap is required");
    for (const cap of caps) {
        if (!Number.isSafeInteger(cap) || cap < 0)
            throw new FramingError("a part cap must be a non-negative integer");
    }
}
/** Encode parts as `[u64 length][bytes]` frames, one cap per part. Throws `FramingError` on a bug. */
export function encodeFrames(parts, caps) {
    checkCaps(caps);
    if (parts.length !== caps.length)
        throw new FramingError("one cap is required per part");
    let total = 0;
    parts.forEach((part, index) => {
        if (part.length > (caps[index] ?? 0))
            throw new FramingError(`part ${index} is over its cap`);
        total += FRAME_HEADER_BYTES + part.length;
    });
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    let offset = 0;
    for (const part of parts) {
        view.setBigUint64(offset, BigInt(part.length));
        out.set(part, offset + FRAME_HEADER_BYTES);
        offset += FRAME_HEADER_BYTES + part.length;
    }
    return out;
}
/**
 * A streaming decoder. Feed it chunks with `push`, then call `finish`. After the first error it is
 * finished: it ignores further input and `finish` returns that error.
 */
export class FrameDecoder {
    #caps;
    #parts = [];
    #header = new Uint8Array(FRAME_HEADER_BYTES);
    #headerFill = 0;
    #body = [];
    #bodyFill = 0;
    /** Length of the part being read, or -1 while its header is incomplete. */
    #expected = -1;
    #error;
    constructor(caps) {
        checkCaps(caps);
        this.#caps = [...caps];
    }
    /** Feed one chunk. Returns the error if this or an earlier chunk was bad, otherwise undefined. */
    push(chunk) {
        let offset = 0;
        while (offset < chunk.length && this.#error === undefined) {
            if (this.#parts.length === this.#caps.length) {
                this.#fail("FRAME_TRAILING_BYTES", this.#parts.length, "bytes after the last part");
                break;
            }
            if (this.#expected < 0) {
                const take = Math.min(FRAME_HEADER_BYTES - this.#headerFill, chunk.length - offset);
                this.#header.set(chunk.subarray(offset, offset + take), this.#headerFill);
                this.#headerFill += take;
                offset += take;
                if (this.#headerFill === FRAME_HEADER_BYTES)
                    this.#startPart();
            }
            else {
                const take = Math.min(this.#expected - this.#bodyFill, chunk.length - offset);
                // A real copy: Buffer#slice is a view, so a caller that reuses its read buffer would change what was accepted.
                this.#body.push(new Uint8Array(chunk.subarray(offset, offset + take)));
                this.#bodyFill += take;
                offset += take;
                if (this.#bodyFill === this.#expected)
                    this.#endPart();
            }
        }
        return this.#error;
    }
    /** The decoded parts, or the first error. A stream that ended early is `FRAME_TRUNCATED`. */
    finish() {
        if (this.#error === undefined && this.#parts.length < this.#caps.length) {
            this.#fail("FRAME_TRUNCATED", this.#parts.length, `stream ended inside part ${this.#parts.length}`);
        }
        if (this.#error !== undefined)
            return { ok: false, error: this.#error };
        return { ok: true, parts: this.#parts };
    }
    #startPart() {
        const index = this.#parts.length;
        const cap = this.#caps[index] ?? 0;
        const length = new DataView(this.#header.buffer).getBigUint64(0);
        if (length > BigInt(cap)) {
            this.#fail("FRAME_OVER_CAP", index, `part ${index} is longer than its cap of ${cap} bytes`);
            return;
        }
        this.#expected = Number(length);
        this.#bodyFill = 0;
        this.#body = [];
        if (this.#expected === 0)
            this.#endPart();
    }
    #endPart() {
        const part = new Uint8Array(this.#expected);
        let at = 0;
        for (const piece of this.#body) {
            part.set(piece, at);
            at += piece.length;
        }
        this.#parts.push(part);
        this.#body = [];
        this.#expected = -1;
        this.#headerFill = 0;
    }
    #fail(code, part, reason) {
        this.#error = { code, part, reason };
        this.#body = [];
    }
}
/** Decode a complete stream held in memory. Never throws for any `bytes`. */
export function decodeFrames(bytes, caps) {
    const decoder = new FrameDecoder(caps);
    decoder.push(bytes);
    return decoder.finish();
}
//# sourceMappingURL=framing.js.map