import { SietchError } from "@sietch/core";
import { createLeafIssuer, loadCa } from "../../ca.js";
import { decodeFrames } from "../../framing.js";
/**
 * The sink's start-up input: three frames on stdin (`framing.ts`), in this order and with these caps:
 * the CA certificate PEM (16 KiB), the CA private key PEM (16 KiB), and the sink's own IPv4 address (64 B).
 * The key goes nowhere else: it is parsed here, handed to the leaf issuer, and never written, logged or
 * put in an error. Any failure throws `SinkStartError` with fixed text that holds no part of the input, and the
 * sink then exits before it binds a port or writes a record.
 */
export const SINK_STDIN_CAPS = [16 * 1024, 16 * 1024, 64];
/** The most stdin bytes worth reading: the three caps plus the three frame headers. */
export const SINK_STDIN_MAX_BYTES = SINK_STDIN_CAPS.reduce((total, cap) => total + cap + 8, 0);
export class SinkStartError extends SietchError {
    constructor(message) {
        super("SINK_START_FAILED", message);
    }
}
/** Strict dotted-quad IPv4: four decimal octets 0-255 without leading zeros (kept here so the image needs no docker-args). */
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const isIPv4 = (value) => IPV4.test(value);
const strictText = new TextDecoder("utf-8", { fatal: true });
function decodeText(bytes, what) {
    try {
        return strictText.decode(bytes);
    }
    catch {
        throw new SinkStartError(`the ${what} is not valid UTF-8`);
    }
}
/**
 * Reads stdin until the three frames are complete, and returns exactly those bytes. It does not wait for
 * end-of-file (the runner may keep stdin open), and it stops with `SinkStartError` on a bad length, bytes after
 * the last frame, or an end of input inside a frame.
 */
export async function readSinkStdin(stdin) {
    const chunks = [];
    let total = 0;
    for await (const chunk of stdin) {
        chunks.push(chunk);
        total += chunk.length;
        if (total > SINK_STDIN_MAX_BYTES)
            throw new SinkStartError("the start-up input is too long");
        const joined = Buffer.concat(chunks);
        const decoded = decodeFrames(joined, SINK_STDIN_CAPS);
        if (decoded.ok)
            return joined;
        if (decoded.error.code !== "FRAME_TRUNCATED") {
            throw new SinkStartError(`the start-up input is malformed (${decoded.error.code})`);
        }
    }
    throw new SinkStartError("the start-up input ended early");
}
/** Decodes and validates the whole stdin. `deps` supplies the clock and the serial source for leaf certificates. */
export function readSinkConfig(stdin, deps) {
    const decoded = decodeFrames(stdin, SINK_STDIN_CAPS);
    if (!decoded.ok)
        throw new SinkStartError(`the start-up input is malformed (${decoded.error.code})`);
    const [certBytes, keyBytes, addressBytes] = decoded.parts;
    const certPem = decodeText(certBytes, "CA certificate");
    const keyPem = decodeText(keyBytes, "CA key");
    const address = decodeText(addressBytes, "address");
    if (!isIPv4(address))
        throw new SinkStartError("the sink address is not an IPv4 address");
    let ca;
    let issuer;
    try {
        ca = loadCa(certPem, keyPem);
        issuer = createLeafIssuer(ca, deps);
    }
    catch {
        // The CaError text is fixed too, but nothing about the key needs to reach a log line.
        throw new SinkStartError("the CA certificate and key are not a valid per-scan CA");
    }
    return { ca, issuer, address };
}
//# sourceMappingURL=config.js.map