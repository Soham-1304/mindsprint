import { createSocket } from "node:dgram";
import { createServer, Socket } from "node:net";
/**
 * The in-container DNS relay. Docker's embedded resolver at 127.0.0.11 doesn't work under gVisor, and the
 * container's `resolv.conf` points there, so init starts this relay on that address (UDP and TCP, port 53)
 * and it forwards every query to the capture sink, which answers and records it. The relay reads no DNS:
 * it moves bytes, so what a package asks is what the sink records.
 *
 * Limits keep a flood of queries from exhausting the container: at most `MAX_PENDING_UDP` queries wait for
 * an upstream answer (a datagram over that is dropped, which a resolver treats as packet loss), each waits at
 * most `UDP_TIMEOUT_MS`, and a TCP connection carries at most `MAX_TCP_BYTES` in both directions, is closed
 * after `TCP_IDLE_MS` without traffic, and counts against `MAX_TCP_CONNECTIONS`.
 */
export const MAX_PENDING_UDP = 256;
export const UDP_TIMEOUT_MS = 3_000;
export const MAX_TCP_BYTES = 128 * 1024;
export const TCP_IDLE_MS = 10_000;
export const MAX_TCP_CONNECTIONS = 64;
function bindUdp(options, pending) {
    return new Promise((resolve, reject) => {
        const socket = createSocket("udp4");
        socket.once("error", reject);
        socket.on("message", (query, remote) => {
            if (pending.size >= MAX_PENDING_UDP)
                return;
            const upstream = createSocket("udp4");
            pending.add(upstream);
            let done = false;
            const finish = () => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                pending.delete(upstream);
                try {
                    upstream.close();
                }
                catch {
                    // already closed
                }
            };
            const timer = setTimeout(finish, UDP_TIMEOUT_MS);
            upstream.on("error", finish);
            // A connected socket receives datagrams from the sink only.
            upstream.connect(options.upstreamPort, options.upstreamAddress, () => {
                upstream.once("message", (answer) => {
                    socket.send(answer, remote.port, remote.address, () => undefined);
                    finish();
                });
                upstream.send(query, (error) => {
                    if (error !== null)
                        finish();
                });
            });
        });
        socket.bind(options.listenPort, options.listenAddress, () => {
            socket.removeListener("error", reject);
            // After the bind, a socket error must not end the process: drop it.
            socket.on("error", () => undefined);
            resolve({ socket, port: socket.address().port });
        });
    });
}
function bindTcp(options, open) {
    return new Promise((resolve, reject) => {
        const server = createServer((client) => {
            if (open.size >= MAX_TCP_CONNECTIONS) {
                client.destroy();
                return;
            }
            const upstream = new Socket();
            open.add(client);
            open.add(upstream);
            let bytes = 0;
            const end = () => {
                client.destroy();
                upstream.destroy();
                open.delete(client);
                open.delete(upstream);
            };
            const count = (chunk) => {
                bytes += chunk.length;
                if (bytes > MAX_TCP_BYTES)
                    end();
            };
            client.on("data", count);
            upstream.on("data", count);
            for (const socket of [client, upstream]) {
                socket.setTimeout(TCP_IDLE_MS, end);
                socket.on("error", end);
                socket.on("close", end);
            }
            // Piping before the connect completes is safe: the upstream socket buffers writes until it is connected.
            client.pipe(upstream);
            upstream.pipe(client);
            upstream.connect(options.upstreamPort, options.upstreamAddress);
        });
        server.once("error", reject);
        server.listen(options.listenPort, options.listenAddress, () => {
            server.removeListener("error", reject);
            server.on("error", () => undefined);
            const address = server.address();
            resolve({ server, port: typeof address === "object" && address !== null ? address.port : 0 });
        });
    });
}
/** Binds UDP and TCP. It resolves only when both are bound, and closes the one that did bind if the other fails. */
export async function startDnsRelay(options) {
    const pending = new Set();
    const open = new Set();
    const udp = await bindUdp(options, pending);
    let tcp;
    try {
        tcp = await bindTcp(options, open);
    }
    catch (error) {
        udp.socket.close();
        throw error;
    }
    let closed = false;
    return {
        udpPort: udp.port,
        tcpPort: tcp.port,
        close: async () => {
            if (closed)
                return;
            closed = true;
            for (const socket of pending)
                socket.close();
            for (const socket of open)
                socket.destroy();
            await Promise.all([
                new Promise((resolve) => udp.socket.close(() => resolve())),
                new Promise((resolve) => tcp.server.close(() => resolve())),
            ]);
        },
    };
}
//# sourceMappingURL=dns-relay.js.map