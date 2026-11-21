import type { Event } from "@sietch/core";
import { type SinkRecord } from "./records.js";
/**
 * Sink records to engine `dns` and `http` events (design D6, Requirement 6.9). Pure.
 *
 * The result has no `seq`, `t`, or `phase` yet: the time comes from the sink's own wall clock (`atMs`),
 * the phase from `phases.ts`, and `seq` from `merge.ts`.
 *
 * Non-HTTP traffic is mapped to an `http` event so that its bytes still reach rule R1 and its destination
 * still reaches R3 (design D6 table):
 *
 * | Record | `method` | `scheme` | `host` |
 * |---|---|---|---|
 * | `raw` on port 53 (a DNS packet `parseDns` refused) | `RAW` | `http` | `raw.sink.invalid` |
 * | `raw` on port 80 | `RAW` | `http` | `raw.sink.invalid` |
 * | `raw` on port 443 (decrypted bytes that are not HTTP) | `RAW` | `https` | the SNI, else `raw.sink.invalid` |
 * | `tlsfail` (port 443, handshake failed) | `TLSFAIL` | `https` | the SNI, else `raw.sink.invalid` |
 *
 * For a parsed request the host is the SNI on https (it is what the client asked to reach, before any
 * header), else the Host header, else `raw.sink.invalid`. `raw.sink.invalid` is never on an allowlist and
 * is not a sink address, so R3 flags it.
 */
/** The host used when the traffic names none. Reserved by RFC 2606, so it never resolves. */
export declare const SINK_RAW_HOST = "raw.sink.invalid";
/** The name for a numeric query type, for example `A` for 1 and `TYPE999` for 999. */
export declare function qtypeName(qtype: number): string;
type Draft<E> = E extends Event ? Omit<E, "seq" | "t" | "phase"> : never;
export type SinkEventDraft = Draft<Extract<Event, {
    type: "dns" | "http";
}>>;
/** A sink event with the wall-clock time the sink recorded it at. */
export interface TimedSinkEvent {
    readonly atMs: number;
    readonly event: SinkEventDraft;
}
/** One timed event per record, in the order given. */
export declare function sinkRecordsToEvents(records: readonly SinkRecord[]): TimedSinkEvent[];
export {};
//# sourceMappingURL=to-events.d.ts.map