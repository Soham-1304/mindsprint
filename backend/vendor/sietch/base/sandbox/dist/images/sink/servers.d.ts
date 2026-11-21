import { SietchError } from "@sietch/core";
import { type LeafIssuer } from "../../ca.js";
import type { Recorder } from "./recorder.js";
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
export declare class SinkBindError extends SietchError {
    constructor(message: string);
}
/** Most bytes kept from before a TLS handshake finishes (a ClientHello is a few KiB). */
export declare const MAX_HANDSHAKE_CAPTURE_BYTES: number;
/** The name of the certificate a client without SNI gets. Reserved by RFC 2606: it never resolves. */
export declare const DEFAULT_TLS_NAME = "sink.invalid";
export interface SinkServersOptions {
    readonly recorder: Recorder;
    readonly issuer: LeafIssuer;
    /** The IPv4 address handed out in DNS answers. */
    readonly address: string;
    /** The address the listeners bind: `0.0.0.0` in the container. */
    readonly bindAddress: string;
    /** Ports to bind. 0 picks an ephemeral port (tests). Production: 53, 53, 80, 443. */
    readonly ports: {
        readonly dnsUdp: number;
        readonly dnsTcp: number;
        readonly http: number;
        readonly https: number;
    };
    readonly maxConnections?: number;
    readonly idleMs?: number;
    readonly totalMs?: number;
    readonly handshakeMs?: number;
    readonly settleMs?: number;
}
export interface SinkServers {
    /** The ports actually bound. */
    readonly ports: {
        readonly dnsUdp: number;
        readonly dnsTcp: number;
        readonly http: number;
        readonly https: number;
    };
    readonly activeConnections: () => number;
    /** Stops accepting, ends every open connection as cut (their last records are written), closes the sockets. */
    close(): Promise<void>;
}
export declare function startSinkServers(options: SinkServersOptions): Promise<SinkServers>;
//# sourceMappingURL=servers.d.ts.map