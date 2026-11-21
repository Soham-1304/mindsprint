import { CLOCK_TOLERANCE_MS } from "../limits.js";
/**
 * The boundaries from the normaliser's events. The normaliser flips the phase when the install (or load)
 * process exits, and it emits that exit event with the phase it is leaving. So the exit of the install
 * process is the last event of phase `install`, and the exit of the load process is the last event of phase
 * `load`. `t` is milliseconds since the first log record; `originMs` is the wall-clock time of that record.
 *
 * A missing boundary is `MISSING_PHASE_BOUNDARY`, unless `eventsTruncated`: then the normaliser stopped
 * emitting events, so the missing boundary is treated as never reached (the trace is flagged by R13).
 */
export function phaseBoundaries(events, originMs, eventsTruncated, packageManagerPid) {
    const lastExit = (phase) => {
        let last;
        for (const event of events)
            if (event.phase === phase)
                last = event;
        return last?.type === "exit" ? last : undefined;
    };
    const install = lastExit("install");
    const load = lastExit("load");
    const missing = (what) => ({
        ok: false,
        code: "MISSING_PHASE_BOUNDARY",
        reason: `the ${what} exit is not in the trace`,
    });
    if (install === undefined && !eventsTruncated)
        return missing("install");
    if (load === undefined && !eventsTruncated)
        return missing("load");
    // The install exit is npm's own exit: a different last-install event means the trace is not what the
    // normaliser promises, so refuse to guess.
    if (install !== undefined && install.pid !== packageManagerPid)
        return missing("install");
    // The load process is a different process from npm (the normaliser refuses a trace where they match).
    if (load !== undefined && load.pid === packageManagerPid)
        return missing("load");
    return {
        ok: true,
        boundaries: {
            installExitMs: install === undefined ? Number.POSITIVE_INFINITY : originMs + install.t,
            loadExitMs: load === undefined ? Number.POSITIVE_INFINITY : originMs + load.t,
        },
    };
}
/** The phase for a sink event at `atMs`. At or within the tolerance of a boundary, the later phase. */
export function phaseAt(atMs, boundaries, toleranceMs = CLOCK_TOLERANCE_MS) {
    if (atMs < boundaries.installExitMs - toleranceMs)
        return "install";
    if (atMs < boundaries.loadExitMs - toleranceMs)
        return "load";
    return "linger";
}
export function assignPhases(events, boundaries, toleranceMs = CLOCK_TOLERANCE_MS) {
    return events.map(({ atMs, event }) => ({ atMs, phase: phaseAt(atMs, boundaries, toleranceMs), event }));
}
//# sourceMappingURL=phases.js.map