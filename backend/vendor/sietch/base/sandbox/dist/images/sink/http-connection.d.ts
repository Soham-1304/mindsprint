import type { SinkRecordDraft } from "./dns-responder.js";
export interface HttpConnectionOptions {
    readonly scheme: "http" | "https";
    /** The TLS server name for https, else null. A valid host name (the caller checks it). */
    readonly sni: string | null;
    /** Receives each record. Returns nothing: the caller's recorder handles overflow. */
    readonly emit: (draft: SinkRecordDraft) => void;
    /** Default `MAX_CONN_INPUT_BYTES`. */
    readonly maxInputBytes?: number;
}
export interface FeedResult {
    /** Bytes to send to the client now. May be empty. */
    readonly reply: Uint8Array;
    /** The input cap was reached: the caller closes the connection and calls `end(true)`. */
    readonly full: boolean;
}
export interface HttpConnection {
    feed(chunk: Uint8Array): FeedResult;
    /** The client went quiet: parse once more and answer a request that has no length information. */
    settle(): Uint8Array;
    /**
     * The connection is over. `cut` is true if we closed it (timeout, cap) or it failed. Records what is left
     * and returns the replies for requests that were still waiting (a client that half-closes after its
     * request still reads the answer).
     */
    end(cut: boolean): Uint8Array;
}
export declare function createHttpConnection(options: HttpConnectionOptions): HttpConnection;
//# sourceMappingURL=http-connection.d.ts.map