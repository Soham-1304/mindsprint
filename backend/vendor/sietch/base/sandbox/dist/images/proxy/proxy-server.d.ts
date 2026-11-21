import { type Server, type Socket } from "node:net";
import { type RefusalReason } from "./connect-policy.js";
/**
 * The registry proxy: a one-purpose HTTP `CONNECT` relay. It runs on the fetch network and the egress
 * network, and it is the only way the fetch container reaches the registry.
 *
 * It tunnels bytes and never terminates TLS. For each request it:
 *  1. reads the request head (at most 8 KiB, within `headMs`) and asks `decideConnect`, which allows
 *     exactly `CONNECT <registryHost>:443 HTTP/1.1`;
 *  2. resolves the registry name itself, A records only, through the injected resolver (the container
 *     resolver does not work under gVisor), and refuses unless there is at least one answer and every
 *     answer is a public IPv4 address (`isPublicIPv4`);
 *  3. connects to the validated address itself (`openUpstream(address)`), never to the name, so a
 *     second lookup cannot return a different address (DNS rebinding);
 *  4. answers `200` and pipes bytes, with an idle timeout, a total lifetime and a connection cap.
 *
 * Log events carry fixed words only. Request text, the registry answer and addresses never appear.
 */
export type RefuseReason = RefusalReason | "head-timeout" | "resolve-failed" | "private-address" | "connect-failed";
export type ProxyLogEvent = {
    readonly ev: "listen";
} | {
    readonly ev: "allow";
} | {
    readonly ev: "refuse";
    readonly why: RefuseReason;
};
export interface ProxyResolver {
    /** The A records of `host`, as dotted-quad text. Rejects when there are none or the lookup fails. */
    resolve4(host: string): Promise<readonly string[]>;
}
export interface ProxyLimits {
    readonly headMs: number;
    readonly resolveMs: number;
    readonly connectMs: number;
    readonly idleMs: number;
    readonly totalMs: number;
    readonly maxConnections: number;
}
export declare const DEFAULT_PROXY_LIMITS: ProxyLimits;
export declare const REGISTRY_PORT = 443;
export interface ProxyOptions {
    /** Lower-case registry host name, already validated by the caller. */
    readonly registryHost: string;
    readonly resolver: ProxyResolver;
    readonly log: (event: ProxyLogEvent) => void;
    /** Opens a connection to the validated address. Tests replace it; the default connects to port 443. */
    readonly openUpstream?: (address: string) => Socket;
    readonly limits?: Partial<ProxyLimits>;
}
export declare function createProxyServer(options: ProxyOptions): Server;
//# sourceMappingURL=proxy-server.d.ts.map