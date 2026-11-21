import { type SinkRecord } from "../../sink/records.js";
type Draft<T> = T extends unknown ? Omit<T, "ts"> : never;
/** A record the sink has not timestamped yet. */
export type SinkRecordDraft = Draft<SinkRecord>;
export interface DnsOutcome {
    /** The response to send, or null if the packet was refused. */
    readonly response: Uint8Array | null;
    /** One `dns` record per question, or one `raw` record when the packet was refused. Never empty. */
    readonly records: readonly SinkRecordDraft[];
}
/**
 * Handle one DNS packet (a UDP datagram, or one TCP message without its length prefix) received from a
 * client. `sinkAddress` is the IPv4 address handed out in A answers. Never throws for any `packet`.
 */
export declare function handleDnsPacket(packet: Uint8Array, proto: "udp" | "tcp", sinkAddress: string): DnsOutcome;
export type TcpDnsPush = {
    readonly ok: true;
    readonly messages: readonly Uint8Array[];
} | {
    readonly ok: false;
    readonly messages: readonly Uint8Array[];
};
/**
 * Splits a DNS-over-TCP byte stream (RFC 1035 section 4.2.2: a two-byte length, then the message) into
 * messages. Several can share a connection. `ok: false` means the stream is no longer usable: a zero length,
 * or more than `maxBytes` read in total. Messages found before the problem are still returned. Never throws.
 */
export declare function createTcpDnsSplitter(maxBytes: number): {
    push(chunk: Uint8Array): TcpDnsPush;
    /** Bytes received but not yet a whole message (the connection ended inside one). */
    remainder(): Uint8Array;
};
/** A DNS response with the two-byte length prefix TCP needs. */
export declare function withTcpLength(message: Uint8Array): Uint8Array;
export {};
//# sourceMappingURL=dns-responder.d.ts.map