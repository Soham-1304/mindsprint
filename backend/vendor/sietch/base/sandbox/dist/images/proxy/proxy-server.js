import { createServer, connect as netConnect } from "node:net";
import { CONNECT_ESTABLISHED, decideConnect, findHeadEnd, MAX_HEAD_BYTES, refusalResponse, } from "./connect-policy.js";
import { isPublicIPv4 } from "./ip-class.js";
export const DEFAULT_PROXY_LIMITS = {
    headMs: 10_000,
    resolveMs: 10_000,
    connectMs: 15_000,
    idleMs: 60_000,
    totalMs: 10 * 60_000,
    maxConnections: 32,
};
export const REGISTRY_PORT = 443;
const defaultOpenUpstream = (address) => netConnect({ host: address, port: REGISTRY_PORT });
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error("failed"));
        });
    });
}
export function createProxyServer(options) {
    const limits = { ...DEFAULT_PROXY_LIMITS, ...options.limits };
    const openUpstream = options.openUpstream ?? defaultOpenUpstream;
    const { registryHost, resolver, log } = options;
    const server = createServer((client) => {
        client.setNoDelay(true);
        client.on("error", () => client.destroy());
        const chunks = [];
        let buffered = 0;
        let decided = false;
        const refuse = (status, why) => {
            log({ ev: "refuse", why });
            client.setTimeout(5_000, () => client.destroy());
            client.end(refusalResponse(status), () => client.destroy());
        };
        const headTimer = setTimeout(() => {
            if (!decided) {
                decided = true;
                refuse(400, "head-timeout");
            }
        }, limits.headMs);
        client.once("close", () => clearTimeout(headTimer));
        const onData = (chunk) => {
            chunks.push(chunk);
            buffered += chunk.length;
            const all = Buffer.concat(chunks, buffered);
            const end = findHeadEnd(all);
            if (end === -1) {
                if (buffered >= MAX_HEAD_BYTES) {
                    decided = true;
                    client.removeListener("data", onData);
                    refuse(431, "head-too-large");
                }
                return;
            }
            decided = true;
            clearTimeout(headTimer);
            client.removeListener("data", onData);
            client.pause();
            const decision = decideConnect(all.subarray(0, end), registryHost);
            if (!decision.ok) {
                refuse(decision.status, decision.reason);
                return;
            }
            void tunnel(all.subarray(end));
        };
        client.on("data", onData);
        async function tunnel(leftover) {
            let addresses;
            try {
                addresses = await withTimeout(resolver.resolve4(registryHost), limits.resolveMs);
            }
            catch {
                refuse(502, "resolve-failed");
                return;
            }
            // Every answer must be public: one private answer means the name is being steered somewhere else.
            const first = addresses[0];
            if (first === undefined || !addresses.every((address) => isPublicIPv4(address))) {
                refuse(403, "private-address");
                return;
            }
            if (client.destroyed)
                return;
            let upstream;
            try {
                upstream = openUpstream(first);
            }
            catch {
                refuse(502, "connect-failed");
                return;
            }
            let connected = false;
            const connectTimer = setTimeout(() => {
                if (!connected)
                    upstream.destroy();
            }, limits.connectMs);
            const totalTimer = setTimeout(() => {
                upstream.destroy();
                client.destroy();
            }, limits.totalMs);
            const teardown = () => {
                clearTimeout(connectTimer);
                clearTimeout(totalTimer);
                upstream.destroy();
                client.destroy();
            };
            // `on`, not `once`: a second error event with no listener would throw and stop the proxy.
            upstream.on("error", () => {
                if (!connected) {
                    clearTimeout(connectTimer);
                    clearTimeout(totalTimer);
                    upstream.destroy();
                    refuse(502, "connect-failed");
                }
                else {
                    teardown();
                }
            });
            upstream.once("close", () => {
                if (!connected) {
                    clearTimeout(connectTimer);
                    clearTimeout(totalTimer);
                    if (!client.destroyed && !client.writableEnded)
                        refuse(502, "connect-failed");
                }
                else {
                    // Let the pipe flush what the registry sent before the client side closes; the idle and
                    // total timers still bound a client that never closes.
                    client.end();
                }
            });
            client.once("close", teardown);
            upstream.once("connect", () => {
                connected = true;
                clearTimeout(connectTimer);
                log({ ev: "allow" });
                upstream.setNoDelay(true);
                upstream.setTimeout(limits.idleMs, teardown);
                client.setTimeout(limits.idleMs, teardown);
                client.write(CONNECT_ESTABLISHED);
                if (leftover.length > 0)
                    upstream.write(leftover);
                client.pipe(upstream);
                upstream.pipe(client);
                client.resume();
            });
        }
    });
    server.maxConnections = limits.maxConnections;
    return server;
}
//# sourceMappingURL=proxy-server.js.map