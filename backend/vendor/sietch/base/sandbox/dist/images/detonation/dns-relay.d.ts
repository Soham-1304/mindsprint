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
export declare const MAX_PENDING_UDP = 256;
export declare const UDP_TIMEOUT_MS = 3000;
export declare const MAX_TCP_BYTES: number;
export declare const TCP_IDLE_MS = 10000;
export declare const MAX_TCP_CONNECTIONS = 64;
export interface RelayOptions {
    readonly listenAddress: string;
    /** 53 in the container. 0 picks a free port (tests); the handle reports the port it got. */
    readonly listenPort: number;
    readonly upstreamAddress: string;
    readonly upstreamPort: number;
}
export interface RelayHandle {
    readonly udpPort: number;
    readonly tcpPort: number;
    close(): Promise<void>;
}
/** Binds UDP and TCP. It resolves only when both are bound, and closes the one that did bind if the other fails. */
export declare function startDnsRelay(options: RelayOptions): Promise<RelayHandle>;
//# sourceMappingURL=dns-relay.d.ts.map