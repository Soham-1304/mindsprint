import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { Duplex } from "node:stream";
import { createSecureContext, TLSSocket } from "node:tls";
import { SietchError } from "@sietch/core";
import { LEAF_CACHE_LIMIT } from "../../ca.js";
import { MAX_SINK_BODY_BYTES } from "../../limits.js";
import { bytesToBase64, sanitiseHostName } from "../../sink/records.js";
import { createTcpDnsSplitter, handleDnsPacket, withTcpLength, } from "./dns-responder.js";
import { createHttpConnection } from "./http-connection.js";
import { CONN_IDLE_MS, CONN_TOTAL_MS, MAX_SINK_CONNECTIONS, MAX_TCP_DNS_BYTES, SETTLE_MS, TLS_HANDSHAKE_MS, } from "./limits.js";
/**
 * The capture sink's four listeners: UDP and TCP for DNS, TCP for HTTP, TCP for HTTPS (design D6).
 * Everything a client sends is untrusted. The parsers and the record schema do the checking; this file owns
 * the sockets, the timers and the caps:
 * - at most `maxConnections` TCP connections at once (one more sets overflow, so the run has no end record),
 * - an idle timeout and a total timeout per connection, and a handshake timeout on 443,
 * - at most `MAX_CONN_INPUT_BYTES` read per HTTP connection and `MAX_TCP_DNS_BYTES` per DNS connection.
 *
 * HTTPS: the raw socket is wrapped in a tap that keeps the bytes seen before the handshake finishes. If the
 * handshake fails (the client does not trust our CA, or speaks something else), those bytes and the SNI
 * name become one `tlsfail` record, so the client's destination is still recorded. The leaf certificate for
 * the SNI name comes from the per-scan CA (`issuer.mint`), which rejects any name that is not a valid host
 * name. A client with no SNI gets a certificate for `sink.invalid`.
 *
 * Nothing is logged here. The listeners write only records (through the recorder) and replies.
 */
export class SinkBindError extends SietchError {
    constructor(message) {
        super("SINK_BIND_FAILED", message);
    }
}
/** Most bytes kept from before a TLS handshake finishes (a ClientHello is a few KiB). */
export const MAX_HANDSHAKE_CAPTURE_BYTES = 64 * 1024;
/** The name of the certificate a client without SNI gets. Reserved by RFC 2606: it never resolves. */
export const DEFAULT_TLS_NAME = "sink.invalid";
function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        const onError = () => reject(new SinkBindError("a listening port could not be bound"));
        server.once("error", onError);
        server.listen({ port, host }, () => {
            server.off("error", onError);
            const address = server.address();
            if (address === null || typeof address === "string")
                reject(new SinkBindError("no listening address"));
            else
                resolve(address.port);
        });
    });
}
function bindUdp(socket, port, host) {
    return new Promise((resolve, reject) => {
        const onError = () => reject(new SinkBindError("a listening port could not be bound"));
        socket.once("error", onError);
        socket.bind({ port, address: host }, () => {
            socket.off("error", onError);
            resolve(socket.address().port);
        });
    });
}
/** Wraps a socket in a Duplex that shows every inbound chunk to `onChunk` before TLS reads it. */
function tap(socket, onChunk) {
    const duplex = new Duplex({
        read() {
            socket.resume();
        },
        write(chunk, _encoding, callback) {
            socket.write(chunk, (error) => callback(error ?? null));
        },
        final(callback) {
            socket.end(() => callback());
        },
        destroy(error, callback) {
            socket.destroy(error ?? undefined);
            callback(error);
        },
    });
    socket.on("data", (chunk) => {
        onChunk(chunk);
        if (!duplex.push(chunk))
            socket.pause();
    });
    socket.on("end", () => duplex.push(null));
    socket.on("error", (error) => duplex.destroy(error));
    socket.on("close", () => duplex.destroy());
    return duplex;
}
export async function startSinkServers(options) {
    const { recorder, issuer, address, bindAddress } = options;
    const maxConnections = options.maxConnections ?? MAX_SINK_CONNECTIONS;
    const idleMs = options.idleMs ?? CONN_IDLE_MS;
    const totalMs = options.totalMs ?? CONN_TOTAL_MS;
    const handshakeMs = options.handshakeMs ?? TLS_HANDSHAKE_MS;
    const settleMs = options.settleMs ?? SETTLE_MS;
    const emit = (draft) => void recorder.record(draft);
    /** Every open TCP connection, with the function that ends it as cut. */
    const active = new Set();
    let closing = false;
    /** True if the connection may proceed. A connection over the cap sets overflow and is dropped. */
    function admit(socket) {
        if (closing) {
            socket.destroy();
            return false;
        }
        if (active.size >= maxConnections) {
            recorder.fail();
            socket.destroy();
            return false;
        }
        return true;
    }
    // --- HTTP and HTTPS ---------------------------------------------------------------------------
    /**
     * Drives `connection` with the bytes of `stream`. `raw` is the socket under it (the same object for
     * plain HTTP). `done` runs once when the connection is over.
     */
    function runHttp(stream, raw, connection, done) {
        let over = false;
        let settleTimer;
        const totalTimer = setTimeout(() => finish(true), totalMs);
        raw.setTimeout(idleMs, () => finish(true));
        const send = (reply) => {
            if (reply.length > 0 && stream.writable && !stream.destroyed)
                stream.write(reply);
        };
        function finish(cut) {
            if (over)
                return;
            over = true;
            if (settleTimer !== undefined)
                clearTimeout(settleTimer);
            send(connection.end(cut));
            if (cut) {
                stream.destroy();
                raw.destroy();
            }
            else {
                stream.end();
            }
        }
        stream.on("data", (chunk) => {
            if (over)
                return;
            const result = connection.feed(chunk);
            send(result.reply);
            if (result.full) {
                over = true;
                stream.destroy();
                raw.destroy();
                return;
            }
            if (settleTimer !== undefined)
                clearTimeout(settleTimer);
            settleTimer = setTimeout(() => send(connection.settle()), settleMs);
        });
        stream.on("end", () => finish(false));
        stream.on("error", () => finish(true));
        raw.on("error", () => finish(true));
        raw.on("close", () => {
            finish(true);
            clearTimeout(totalTimer);
            if (settleTimer !== undefined)
                clearTimeout(settleTimer);
            done();
        });
        return () => finish(true);
    }
    const httpServer = createServer({ allowHalfOpen: true }, (socket) => {
        if (!admit(socket))
            return;
        const connection = createHttpConnection({ scheme: "http", sni: null, emit });
        let abort = () => undefined;
        const done = () => void active.delete(abort);
        abort = runHttp(socket, socket, connection, done);
        active.add(abort);
    });
    // The default context is for a client that sends no SNI. The others are made per name and kept (bounded).
    const contexts = new Map();
    function contextFor(name) {
        const cached = contexts.get(name.toLowerCase());
        if (cached !== undefined)
            return cached;
        const { certPem } = issuer.mint(name);
        const context = createSecureContext({ key: issuer.leafKeyPem, cert: certPem });
        if (contexts.size >= LEAF_CACHE_LIMIT) {
            const oldest = contexts.keys().next();
            if (!oldest.done)
                contexts.delete(oldest.value);
        }
        contexts.set(name.toLowerCase(), context);
        return context;
    }
    const defaultContext = contextFor(DEFAULT_TLS_NAME);
    const httpsServer = createServer({ allowHalfOpen: true }, (socket) => {
        if (!admit(socket))
            return;
        let sni = null;
        let secured = false;
        let failed = false;
        const captured = [];
        let capturedBytes = 0;
        let captureTruncated = false;
        const duplex = tap(socket, (chunk) => {
            if (secured)
                return;
            const room = MAX_HANDSHAKE_CAPTURE_BYTES - capturedBytes;
            if (chunk.length > room)
                captureTruncated = true;
            if (room > 0) {
                const piece = chunk.subarray(0, room);
                captured.push(Buffer.from(piece));
                capturedBytes += piece.length;
            }
            if (captureTruncated)
                failHandshake(true);
        });
        const tlsSocket = new TLSSocket(duplex, {
            isServer: true,
            secureContext: defaultContext,
            ALPNProtocols: ["http/1.1"],
            SNICallback: (servername, callback) => {
                sni = sanitiseHostName(servername);
                try {
                    callback(null, contextFor(servername));
                }
                catch {
                    callback(new Error("the server name was refused"));
                }
            },
        });
        /** What ends this connection as cut: the handshake failure until TLS is up, then the HTTP loop's. */
        let abortCurrent = () => failHandshake(true);
        const abort = () => abortCurrent();
        active.add(abort);
        const handshakeTimer = setTimeout(() => failHandshake(true), handshakeMs);
        /** The handshake did not finish: record the bytes and the SNI once, then drop the connection. */
        function failHandshake(cut) {
            if (secured || failed)
                return;
            failed = true;
            clearTimeout(handshakeTimer);
            if (capturedBytes > 0) {
                emit({
                    type: "tlsfail",
                    sni,
                    bodyBase64: bytesToBase64(Buffer.concat(captured).subarray(0, MAX_SINK_BODY_BYTES)),
                    bodyTruncated: cut || captureTruncated,
                });
            }
            tlsSocket.destroy();
            socket.destroy();
        }
        tlsSocket.on("error", () => failHandshake(false));
        duplex.on("error", () => undefined); // the TLS socket reports it; an unhandled one would end the process
        socket.once("close", () => {
            clearTimeout(handshakeTimer);
            failHandshake(false);
            active.delete(abort);
        });
        // A client that gives up (it rejected our certificate, or just hung up) half-closes, and the socket stays open.
        socket.once("end", () => failHandshake(false));
        tlsSocket.on("close", () => socket.destroy());
        socket.setTimeout(idleMs, () => failHandshake(true));
        tlsSocket.once("secure", () => {
            if (failed)
                return;
            secured = true;
            clearTimeout(handshakeTimer);
            captured.length = 0;
            const connection = createHttpConnection({ scheme: "https", sni, emit });
            abortCurrent = runHttp(tlsSocket, socket, connection, () => undefined);
        });
    });
    // --- DNS over TCP -------------------------------------------------------------------------------
    const dnsTcpServer = createServer({ allowHalfOpen: true }, (socket) => {
        if (!admit(socket))
            return;
        const splitter = createTcpDnsSplitter(MAX_TCP_DNS_BYTES);
        let over = false;
        const totalTimer = setTimeout(() => finish(true), totalMs);
        socket.setTimeout(idleMs, () => finish(true));
        const abort = () => finish(true);
        active.add(abort);
        function finish(cut) {
            if (over)
                return;
            over = true;
            clearTimeout(totalTimer);
            const rest = splitter.remainder();
            if (rest.length > 0) {
                emit({
                    type: "raw",
                    port: 53,
                    sni: null,
                    bodyBase64: bytesToBase64(rest.subarray(0, MAX_SINK_BODY_BYTES)),
                    bodyTruncated: cut || rest.length > MAX_SINK_BODY_BYTES,
                });
            }
            if (cut)
                socket.destroy();
            else
                socket.end();
        }
        socket.on("data", (chunk) => {
            if (over)
                return;
            const pushed = splitter.push(chunk);
            for (const message of pushed.messages) {
                const outcome = handleDnsPacket(message, "tcp", address);
                for (const record of outcome.records)
                    emit(record);
                if (outcome.response === null) {
                    finish(false);
                    return;
                }
                if (socket.writable)
                    socket.write(withTcpLength(outcome.response));
            }
            // A zero length or the byte cap: the stream is unusable. What was read is recorded, and the connection closes.
            if (!pushed.ok)
                finish(true);
        });
        socket.on("end", () => finish(false));
        socket.on("error", () => finish(true));
        socket.on("close", () => {
            finish(true);
            clearTimeout(totalTimer);
            active.delete(abort);
        });
    });
    // --- DNS over UDP -------------------------------------------------------------------------------
    const udp = createSocket({ type: "udp4" });
    udp.on("error", () => recorder.fail());
    udp.on("message", (message, remote) => {
        const outcome = handleDnsPacket(message, "udp", address);
        for (const record of outcome.records)
            emit(record);
        if (outcome.response !== null)
            udp.send(outcome.response, remote.port, remote.address, () => undefined);
    });
    const servers = [httpServer, httpsServer, dnsTcpServer];
    // A listener that fails after it started means records may be missing: no end record.
    for (const server of servers)
        server.on("error", () => recorder.fail());
    const closeAll = async () => {
        closing = true;
        for (const abort of [...active])
            abort();
        await Promise.all(servers.map((server) => new Promise((resolve) => {
            if (!server.listening)
                resolve();
            else
                server.close(() => resolve());
        })));
        await new Promise((resolve) => {
            try {
                udp.close(() => resolve());
            }
            catch {
                resolve(); // already closed
            }
        });
    };
    try {
        const ports = {
            dnsUdp: await bindUdp(udp, options.ports.dnsUdp, bindAddress),
            dnsTcp: await listen(dnsTcpServer, options.ports.dnsTcp, bindAddress),
            http: await listen(httpServer, options.ports.http, bindAddress),
            https: await listen(httpsServer, options.ports.https, bindAddress),
        };
        return { ports, activeConnections: () => active.size, close: closeAll };
    }
    catch (error) {
        await closeAll();
        throw error instanceof SinkBindError ? error : new SinkBindError("a listening port could not be bound");
    }
}
//# sourceMappingURL=servers.js.map