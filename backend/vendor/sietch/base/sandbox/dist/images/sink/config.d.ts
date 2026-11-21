import { SietchError } from "@sietch/core";
import { type Ca, type CaDeps, type LeafIssuer } from "../../ca.js";
/**
 * The sink's start-up input: three frames on stdin (`framing.ts`), in this order and with these caps:
 * the CA certificate PEM (16 KiB), the CA private key PEM (16 KiB), and the sink's own IPv4 address (64 B).
 * The key goes nowhere else: it is parsed here, handed to the leaf issuer, and never written, logged or
 * put in an error. Any failure throws `SinkStartError` with fixed text that holds no part of the input, and the
 * sink then exits before it binds a port or writes a record.
 */
export declare const SINK_STDIN_CAPS: readonly number[];
/** The most stdin bytes worth reading: the three caps plus the three frame headers. */
export declare const SINK_STDIN_MAX_BYTES: number;
export declare class SinkStartError extends SietchError {
    constructor(message: string);
}
export interface SinkConfig {
    readonly ca: Ca;
    readonly issuer: LeafIssuer;
    /** The IPv4 address the sink hands out in DNS answers. */
    readonly address: string;
}
/**
 * Reads stdin until the three frames are complete, and returns exactly those bytes. It does not wait for
 * end-of-file (the runner may keep stdin open), and it stops with `SinkStartError` on a bad length, bytes after
 * the last frame, or an end of input inside a frame.
 */
export declare function readSinkStdin(stdin: AsyncIterable<Uint8Array>): Promise<Uint8Array>;
/** Decodes and validates the whole stdin. `deps` supplies the clock and the serial source for leaf certificates. */
export declare function readSinkConfig(stdin: Uint8Array, deps: CaDeps): SinkConfig;
//# sourceMappingURL=config.d.ts.map