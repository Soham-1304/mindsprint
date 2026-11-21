import type { Event } from "@sietch/core";
import type { SinkEventDraft, TimedSinkEvent } from "./to-events.js";
/**
 * The phase of a sink event (design D8, Requirement 6.12). Sink events have no pid, so the phase comes from
 * the event's time against the exits of the install and load processes on the common wall clock. An event
 * within `CLOCK_TOLERANCE_MS` of a boundary gets the later phase, because the sink's clock and the gVisor
 * log's clock are two different clocks. Pure.
 */
export type Phase = Event["phase"];
/** When the install process and the load process exited, in wall-clock milliseconds. */
export interface PhaseBoundaries {
    readonly installExitMs: number;
    readonly loadExitMs: number;
}
export type BoundariesResult = {
    readonly ok: true;
    readonly boundaries: PhaseBoundaries;
} | {
    readonly ok: false;
    readonly code: "MISSING_PHASE_BOUNDARY";
    readonly reason: string;
};
/**
 * The boundaries from the normaliser's events. The normaliser flips the phase when the install (or load)
 * process exits, and it emits that exit event with the phase it is leaving. So the exit of the install
 * process is the last event of phase `install`, and the exit of the load process is the last event of phase
 * `load`. `t` is milliseconds since the first log record; `originMs` is the wall-clock time of that record.
 *
 * A missing boundary is `MISSING_PHASE_BOUNDARY`, unless `eventsTruncated`: then the normaliser stopped
 * emitting events, so the missing boundary is treated as never reached (the trace is flagged by R13).
 */
export declare function phaseBoundaries(events: readonly Event[], originMs: number, eventsTruncated: boolean, packageManagerPid: number): BoundariesResult;
/** The phase for a sink event at `atMs`. At or within the tolerance of a boundary, the later phase. */
export declare function phaseAt(atMs: number, boundaries: PhaseBoundaries, toleranceMs?: number): Phase;
/** A sink event with its phase. `merge.ts` adds `seq` and `t`. */
export interface PhasedSinkEvent {
    readonly atMs: number;
    readonly phase: Phase;
    readonly event: SinkEventDraft;
}
export declare function assignPhases(events: readonly TimedSinkEvent[], boundaries: PhaseBoundaries, toleranceMs?: number): PhasedSinkEvent[];
//# sourceMappingURL=phases.d.ts.map