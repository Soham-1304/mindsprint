import { MAX_SINK_BODY_BYTES } from "../../limits.js";
import { capBytes, parseHttp } from "../../sink/parse-http.js";
import { bytesToBase64 } from "../../sink/records.js";
import { MAX_CONN_INPUT_BYTES, REPARSE_MIN_GROWTH_BYTES } from "./limits.js";
/**
 * One HTTP (port 80) or decrypted HTTPS (port 443) connection, as a pure state machine. Bytes go in with
 * `feed`, records come out through `emit`, and the bytes to send back are returned. No sockets, no timers:
 * the caller owns those, and calls `settle` after a quiet moment and `end` when the connection is over.
 *
 * Every request the parser accepts becomes one `http` record, and the loop continues on the bytes after
 * it, so pipelined requests give one record each. The first bytes the parser refuses, and everything
 * after them, become one `raw` record when the connection ends, so no byte the client sent is dropped
 * (up to the caps): at most `MAX_CONN_INPUT_BYTES` are read per connection, at most `MAX_SINK_BODY_BYTES`
 * of a `raw` record are kept, and every cut sets `bodyTruncated`. A connection our own timeout closed counts
 * as cut (`end(true)`), because the client may have had more to send.
 *
 * Replies: `200` with the body `ok`. A `HEAD` request or one with a `Range` header gets `404` with no body,
 * because the sink cannot satisfy it (design D7). Nothing the client sent is echoed back.
 *
 * Cost: a request is parsed again only when it can have changed. The head is searched for its end in
 * the new bytes only. A body is parsed again when the announced length is present, or after the buffer grew
 * by an eighth (and at least `REPARSE_MIN_GROWTH_BYTES`), so dribbling one byte at a time costs a linear
 * total, not a quadratic one. `settle` parses once more without the throttle and answers a request that has
 * no length information (a `GET`), which is complete only because the client went quiet.
 */
const OK_REPLY = new TextEncoder().encode("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\nok");
const NOT_FOUND_REPLY = new TextEncoder().encode("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
const NO_REPLY = new Uint8Array(0);
/** How many throttled parses per request an ending that looks like the end of a chunked body may force. */
const LAST_CHUNK_PARSES = 64;
function join(parts) {
    if (parts.length === 0)
        return NO_REPLY;
    if (parts.length === 1)
        return parts[0];
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}
/** True if `bytes` ends with the end of a chunked body: the last chunk `0` and the final blank line. */
function endsWithLastChunk(bytes) {
    const n = bytes.length;
    return (n >= 5 &&
        bytes[n - 5] === 0x30 &&
        bytes[n - 4] === 0x0d &&
        bytes[n - 3] === 0x0a &&
        bytes[n - 2] === 0x0d &&
        bytes[n - 1] === 0x0a);
}
function hasRange(headers) {
    return headers.some(([name]) => name.toLowerCase() === "range");
}
/** True if `bytes` holds a CRLFCRLF that starts at or after `from - 3`, so a scan resumes where the last one ended. */
function hasHeadEnd(bytes, from) {
    for (let i = Math.max(0, from - 3); i + 3 < bytes.length; i++) {
        if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a && bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a) {
            return true;
        }
    }
    return false;
}
export function createHttpConnection(options) {
    const maxInput = Math.min(options.maxInputBytes ?? MAX_CONN_INPUT_BYTES, MAX_CONN_INPUT_BYTES);
    let buffer = new Uint8Array(1024);
    /** Unconsumed bytes are `buffer[start, length)`. */
    let start = 0;
    let length = 0;
    let received = 0;
    let cutByCap = false;
    let rawMode = false;
    let finished = false;
    /** Do not parse before the buffered length reaches this (a throttle for an incomplete request). */
    let nextParseAt = 0;
    let waitingForHead = true;
    /** Parses allowed when the buffer ends like the end of a chunked body, whatever the throttle says. */
    let lastChunkBudget = LAST_CHUNK_PARSES;
    /** How many unconsumed bytes were already searched for the end of the head. */
    let scanned = 0;
    const pending = () => buffer.subarray(start, length);
    function append(chunk) {
        if (start > 0 && start === length) {
            start = 0;
            length = 0;
        }
        if (length + chunk.length > buffer.length) {
            const live = length - start;
            let capacity = Math.max(buffer.length, 1024);
            while (capacity < live + chunk.length)
                capacity *= 2;
            const grown = new Uint8Array(capacity);
            grown.set(pending(), 0);
            buffer = grown;
            length = live;
            start = 0;
        }
        buffer.set(chunk, length);
        length += chunk.length;
    }
    function rawRecord(bytes, cut) {
        const kept = capBytes(bytes, MAX_SINK_BODY_BYTES, cut);
        return {
            type: "raw",
            port: options.scheme === "https" ? 443 : 80,
            sni: options.sni,
            bodyBase64: bytesToBase64(kept.body),
            bodyTruncated: kept.bodyTruncated,
        };
    }
    /** Parses what is buffered. `mode` says how much to commit. Returns the replies for committed requests. */
    function drain(mode, cut) {
        const replies = [];
        while (!rawMode && length > start) {
            const live = length - start;
            const result = parseHttp(pending(), { inputTruncated: cut });
            if (result.kind === "http") {
                const commit = result.complete || mode === "final" || (mode === "settle" && !result.framed);
                if (!commit) {
                    waitingForHead = false;
                    nextParseAt =
                        result.framed && result.missing > 1
                            ? live + result.missing
                            : live + Math.max(REPARSE_MIN_GROWTH_BYTES, Math.ceil(live / 8));
                    break;
                }
                options.emit({
                    type: "http",
                    scheme: options.scheme,
                    host: result.host,
                    sni: options.sni,
                    method: result.method,
                    path: result.path,
                    headers: result.headers,
                    bodyBase64: bytesToBase64(result.body),
                    bodyTruncated: result.bodyTruncated,
                });
                replies.push(result.method === "HEAD" || hasRange(result.headers) ? NOT_FOUND_REPLY : OK_REPLY);
                start += result.consumed;
                waitingForHead = true;
                scanned = 0;
                nextParseAt = 0;
                lastChunkBudget = LAST_CHUNK_PARSES;
            }
            else if (result.reason === "NO_HEAD_END" && mode !== "final") {
                waitingForHead = true;
                scanned = live;
                break;
            }
            else {
                rawMode = true;
            }
        }
        return join(replies);
    }
    function finish(cut) {
        if (finished)
            return NO_REPLY;
        finished = true;
        const reply = drain("final", cut);
        if (length > start)
            options.emit(rawRecord(pending(), cut));
        start = length;
        return reply;
    }
    return {
        feed(chunk) {
            if (finished || cutByCap)
                return { reply: NO_REPLY, full: cutByCap };
            let accepted = chunk;
            if (received + chunk.length > maxInput) {
                accepted = chunk.subarray(0, Math.max(0, maxInput - received));
                cutByCap = true;
            }
            received += accepted.length;
            append(accepted);
            // At the cap, `finish` parses what is there as if the connection had ended, and records the rest as `raw`.
            if (cutByCap)
                return { reply: finish(true), full: true };
            if (rawMode)
                return { reply: NO_REPLY, full: false };
            let due;
            if (waitingForHead) {
                due = hasHeadEnd(pending(), scanned);
            }
            else {
                due = length - start >= nextParseAt;
                // A chunked body that is complete ends in `0 CRLF CRLF`. That lets the client's last bytes get an answer
                // at once. A client that fakes the ending over and over gets only a few such parses, then the throttle.
                if (!due && lastChunkBudget > 0 && endsWithLastChunk(pending())) {
                    lastChunkBudget--;
                    due = true;
                }
            }
            if (!due) {
                if (waitingForHead)
                    scanned = length - start;
                return { reply: NO_REPLY, full: false };
            }
            return { reply: drain("wait", false), full: false };
        },
        settle() {
            if (finished || rawMode)
                return NO_REPLY;
            return drain("settle", false);
        },
        end(cut) {
            return finish(cut || cutByCap);
        },
    };
}
//# sourceMappingURL=http-connection.js.map