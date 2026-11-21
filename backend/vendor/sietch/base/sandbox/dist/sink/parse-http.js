import { MAX_SINK_BODY_BYTES } from "../limits.js";
import { MAX_RECORD_HEADER_NAME, MAX_RECORD_HEADER_VALUE, MAX_RECORD_HEADERS, MAX_RECORD_PATH, sanitiseHostName, } from "./records.js";
/**
 * Parse the bytes the sink received on one HTTP connection (port 80, or port 443 after TLS) into one
 * request. Pure, and it never throws: any input gives either a request or a typed "unparsable" result.
 * The sink records unparsable bytes as a `RAW` event (design D6), so nothing the client sent is dropped.
 *
 * The parser is deliberately stricter than a server. Whatever a real server would argue about is
 * unparsable: a bare LF, a folded header, a duplicate or conflicting length, a duplicate Host, a method that
 * is not upper-case letters, an HTTP version other than 1.0 or 1.1, more headers or longer values than the
 * engine's event can hold. The bytes then still reach rule R1 as a raw body, which is always better than a
 * request that the engine would have to cut.
 *
 * Caps (Requirement 6.3): the body is cut at `maxBodyBytes`, the head (request line and headers) must fit
 * `maxHeadBytes`. `bodyTruncated` is true exactly when a body byte the client sent is missing from `body`,
 * either because of the body cap or because the caller's own input was cut (`inputTruncated`). A client that
 * sends fewer bytes than it announced and then hangs up has lost nothing to us, so that is not truncation.
 *
 * `consumed` is how many input bytes the request took. A keep-alive connection can hold more requests, so
 * the caller parses `bytes.subarray(consumed)` again until the input is used up. A request without length
 * information takes everything that follows, unless the rest starts like another request.
 */
export const DEFAULT_MAX_HEAD_BYTES = 64 * 1024;
/** First size of the chunked decoder's body buffer. It doubles up to the body cap. */
const INITIAL_CHUNK_BUFFER_BYTES = 256;
/** Longest chunk-size line the chunked decoder accepts. */
const MAX_CHUNK_LINE_BYTES = 256;
/**
 * Chunk sizes are at most 13 hex digits (2^52), so they stay exact in a number. A chunk extension (`;...`)
 * is refused: the decoder would drop it, and a dropped byte never reaches rule R1. The request is then
 * unparsable and its bytes are recorded whole as `RAW`.
 */
const CHUNK_SIZE = /^[0-9A-Fa-f]{1,13}$/;
/** What a chunk-size line cut short by a hang-up may hold: size digits and at most the CR of the CRLF. */
const INCOMPLETE_CHUNK_LINE = /^[0-9A-Fa-f]{0,13}\r?$/;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const METHOD = /^[A-Z]{1,16}$/;
const VERSION = /^HTTP\/1\.[01]$/;
const DIGITS = /^\d{1,15}$/;
const unparsable = (reason) => ({ kind: "unparsable", reason });
/**
 * Cut `bytes` to at most `max` bytes (copying), and say whether anything was lost: true if `bytes` was
 * longer than `max` or the caller already knew the input was cut. For recording non-HTTP bytes as `RAW` or
 * `TLSFAIL`.
 */
export function capBytes(bytes, max = MAX_SINK_BODY_BYTES, alreadyTruncated = false) {
    const limit = clampCap(max, MAX_SINK_BODY_BYTES);
    return { body: bytes.slice(0, limit), bodyTruncated: alreadyTruncated || bytes.length > limit };
}
function clampCap(value, fallback) {
    if (value === undefined || !Number.isFinite(value))
        return fallback;
    return Math.min(Math.max(0, Math.floor(value)), fallback);
}
export function parseHttp(bytes, options = {}) {
    try {
        return parse(bytes, options);
    }
    catch {
        // Not expected: the property test asserts this branch is never taken. Fail closed to "unparsable".
        return unparsable("INTERNAL");
    }
}
const latin1 = (bytes, start, end) => Buffer.from(bytes.buffer, bytes.byteOffset + start, end - start).toString("latin1");
function findCrlfCrlf(bytes, limit) {
    const last = Math.min(bytes.length, limit) - 3;
    for (let i = 0; i < last; i++) {
        if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a && bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a) {
            return i;
        }
    }
    return -1;
}
/** True if `bytes` starts like a request line: 1 to 16 upper-case letters, a space, then a non-space byte. */
function startsLikeRequest(bytes) {
    let i = 0;
    while (i < bytes.length && i <= 16 && bytes[i] >= 0x41 && bytes[i] <= 0x5a)
        i++;
    return i >= 1 && i <= 16 && bytes[i] === 0x20 && bytes.length > i + 1 && bytes[i + 1] > 0x20;
}
/**
 * `line` from `from` on, without leading and trailing spaces and tabs. Index scans, not a regex: an
 * alternation like `^[ \t]+|[ \t]+$` is quadratic on a long run of blanks inside the value.
 */
function trimBlanks(line, from) {
    let start = from;
    let end = line.length;
    while (start < end && (line.charCodeAt(start) === 0x20 || line.charCodeAt(start) === 0x09))
        start++;
    while (end > start && (line.charCodeAt(end - 1) === 0x20 || line.charCodeAt(end - 1) === 0x09))
        end--;
    return line.slice(start, end);
}
/** A header value or request target must not hold control characters (tab is allowed in values). */
function hasControl(value, allowTab) {
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if ((c < 0x20 && !(allowTab && c === 0x09)) || c === 0x7f)
            return true;
    }
    return false;
}
function parse(bytes, options) {
    if (bytes.length === 0)
        return unparsable("EMPTY");
    const maxBody = clampCap(options.maxBodyBytes, MAX_SINK_BODY_BYTES);
    const maxHead = clampCap(options.maxHeadBytes, DEFAULT_MAX_HEAD_BYTES);
    const inputTruncated = options.inputTruncated === true;
    const headEnd = findCrlfCrlf(bytes, maxHead + 4);
    if (headEnd < 0)
        return unparsable(bytes.length > maxHead + 4 ? "HEAD_TOO_LARGE" : "NO_HEAD_END");
    const lines = latin1(bytes, 0, headEnd).split("\r\n");
    const requestLine = lines[0];
    const parts = requestLine.split(" ");
    const [method, path, version] = parts;
    if (parts.length !== 3 ||
        !METHOD.test(method) ||
        path.length === 0 ||
        path.length > MAX_RECORD_PATH ||
        hasControl(path, false) ||
        !VERSION.test(version)) {
        return unparsable("BAD_REQUEST_LINE");
    }
    const headers = [];
    const hosts = [];
    const lengths = [];
    const codings = [];
    for (const line of lines.slice(1)) {
        const colon = line.indexOf(":");
        const name = colon < 0 ? "" : line.slice(0, colon);
        if (name.length === 0 || name.length > MAX_RECORD_HEADER_NAME || !TOKEN.test(name)) {
            return unparsable("BAD_HEADER");
        }
        const value = trimBlanks(line, colon + 1);
        if (value.length > MAX_RECORD_HEADER_VALUE || hasControl(value, true))
            return unparsable("BAD_HEADER");
        if (headers.length >= MAX_RECORD_HEADERS)
            return unparsable("TOO_MANY_HEADERS");
        headers.push([name, value]);
        const lower = name.toLowerCase();
        if (lower === "host")
            hosts.push(value);
        else if (lower === "content-length")
            lengths.push(value);
        else if (lower === "transfer-encoding")
            codings.push(value.toLowerCase());
    }
    if (hosts.length > 1)
        return unparsable("BAD_HEADER");
    const bodyStart = headEnd + 4;
    const rest = bytes.subarray(bodyStart);
    const host = hosts.length === 1 ? sanitiseHostName(hosts[0]) : null;
    const done = (body, bodyTruncated, used, framing) => ({
        kind: "http",
        method,
        path,
        host,
        headers,
        body,
        bodyTruncated,
        consumed: used,
        ...framing,
    });
    if (codings.length > 0) {
        // Only a single, exact `chunked`, and never together with a length (request smuggling shape).
        if (codings.length !== 1 || codings[0] !== "chunked" || lengths.length > 0) {
            return unparsable("BAD_FRAMING");
        }
        const chunked = decodeChunked(rest, maxBody, inputTruncated);
        if (chunked === null)
            return unparsable("BAD_CHUNK");
        return done(chunked.body, chunked.truncated, bodyStart + chunked.used, {
            framed: true,
            complete: chunked.complete,
            missing: chunked.complete ? 0 : 1,
        });
    }
    if (lengths.length > 0) {
        const first = lengths[0];
        if (!DIGITS.test(first) || lengths.some((l) => l !== first))
            return unparsable("BAD_FRAMING");
        const announced = Number(first);
        const available = Math.min(announced, rest.length);
        const kept = Math.min(available, maxBody);
        const truncated = available > maxBody || (inputTruncated && rest.length < announced);
        return done(rest.slice(0, kept), truncated, bodyStart + available, {
            framed: true,
            complete: available === announced,
            missing: announced - available,
        });
    }
    // No length information. If the rest looks like the next request, this one has no body.
    if (startsLikeRequest(rest)) {
        return done(new Uint8Array(0), false, bodyStart, { framed: false, complete: true, missing: 0 });
    }
    const kept = Math.min(rest.length, maxBody);
    return done(rest.slice(0, kept), rest.length > maxBody || inputTruncated, bytes.length, {
        framed: false,
        complete: false,
        missing: 1,
    });
}
/** Index of the next CRLF at or after `from` within `limit` bytes, or -1. */
function findCrlf(bytes, from, limit) {
    const last = Math.min(bytes.length - 1, from + limit);
    for (let i = from; i < last; i++) {
        if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a)
            return i;
    }
    return -1;
}
/** Whether a CRLF starts at `pos`: yes, no, or not yet known because the input ends first. */
function crlfAt(bytes, pos) {
    if (pos >= bytes.length)
        return "short";
    if (bytes[pos] !== 0x0d)
        return "no";
    if (pos + 1 >= bytes.length)
        return "short";
    return bytes[pos + 1] === 0x0a ? "yes" : "no";
}
/**
 * Decode a chunked body, keeping at most `max` bytes but still walking the rest to find where the message
 * ends. Returns null for a malformed chunk, a chunk extension, or trailers (all of which would be dropped,
 * and an unparsable request keeps every byte). A body that ends early (the client hung up, or `inputTruncated`)
 * returns what was decoded, with `truncated` true only if the caller's input was cut. A cut inside a chunk-size
 * line is accepted only when the tail is hex digits and at most a CR, so no client byte is dropped unseen.
 */
function decodeChunked(rest, max, inputTruncated) {
    // One buffer holds the body. It starts small and doubles up to `max`, so a request with a tiny body
    // doesn't zero-fill up to `max` bytes (a pipelined connection holds thousands of such requests).
    let buffer = new Uint8Array(Math.min(max, rest.length, INITIAL_CHUNK_BUFFER_BYTES));
    let kept = 0;
    let total = 0;
    let pos = 0;
    const finish = (used, complete) => ({
        body: buffer.slice(0, kept),
        truncated: total > kept || (!complete && inputTruncated),
        used,
        complete,
    });
    for (;;) {
        if (pos >= rest.length)
            return finish(rest.length, false);
        const eol = findCrlf(rest, pos, MAX_CHUNK_LINE_BYTES);
        if (eol < 0) {
            // No line end in sight. The client may have hung up inside a chunk-size line, which loses nothing if
            // the remainder is only hex digits and at most a final CR. Anything else would be dropped, and a dropped
            // byte never reaches rule R1, so the request is unparsable and its bytes are kept whole as RAW.
            return INCOMPLETE_CHUNK_LINE.test(latin1(rest, pos, rest.length)) ? finish(rest.length, false) : null;
        }
        if (!CHUNK_SIZE.test(latin1(rest, pos, eol)))
            return null;
        const size = Number.parseInt(latin1(rest, pos, eol), 16);
        pos = eol + 2;
        if (size === 0) {
            const end = crlfAt(rest, pos);
            if (end === "yes")
                return finish(pos + 2, true);
            return end === "short" ? finish(rest.length, false) : null; // "no" means trailers
        }
        const take = Math.min(size, rest.length - pos);
        const keep = Math.min(take, max - kept);
        if (keep > 0) {
            if (kept + keep > buffer.length) {
                let capacity = Math.max(buffer.length, 1);
                while (capacity < kept + keep)
                    capacity *= 2;
                const grown = new Uint8Array(Math.min(capacity, max));
                grown.set(buffer.subarray(0, kept));
                buffer = grown;
            }
            buffer.set(rest.subarray(pos, pos + keep), kept);
            kept += keep;
        }
        total += take;
        pos += take;
        if (take < size)
            return finish(rest.length, false); // the data was cut short
        const after = crlfAt(rest, pos);
        if (after === "no")
            return null;
        if (after === "short")
            return finish(rest.length, false); // the CRLF after the data never arrived
        pos += 2;
    }
}
//# sourceMappingURL=parse-http.js.map