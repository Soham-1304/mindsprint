import type { Event } from "@sietch/core";
import type { PhasedSinkEvent } from "./sink/phases.js";
/**
 * Merge the normaliser's process events with the sink's events into one list ordered by a common wall clock
 * (design D8, Requirement 6.9). Pure and deterministic.
 *
 * - **Common clock.** A process event's time is `originMs + t` (`t` is milliseconds since the first log
 *   record, `originMs` is the wall-clock time of that record). A sink event's time is the sink's own `atMs`.
 * - **Order.** Process events keep their order: each one's time is raised to the largest time before it, so
 *   a log line that arrives out of order never moves an event ahead of its cause. Sink events are ordered by
 *   time. Ties go to process events, then to input order, so the merge is stable.
 * - **Numbers.** `seq` is renumbered 1, 2, 3, ... across the result, strictly increasing and unique (the
 *   engine orders by `seq` and `validateScanInput` rejects duplicates). `t` becomes milliseconds since the
 *   earliest event, which is never negative.
 *
 * Every input event appears once in the output and nothing else does. Phases are kept as given.
 */
export declare function mergeEvents(processEvents: readonly Event[], originMs: number, sinkEvents: readonly PhasedSinkEvent[]): Event[];
//# sourceMappingURL=merge.d.ts.map