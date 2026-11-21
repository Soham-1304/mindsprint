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
export function mergeEvents(processEvents, originMs, sinkEvents) {
    let running = Number.NEGATIVE_INFINITY;
    const processTimed = processEvents.map((event) => {
        running = Math.max(running, originMs + event.t);
        return { atMs: running, event };
    });
    const sinkTimed = sinkEvents
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => a.entry.atMs - b.entry.atMs || a.index - b.index);
    const first = Math.min(processTimed[0]?.atMs ?? Number.POSITIVE_INFINITY, sinkTimed[0]?.entry.atMs ?? Number.POSITIVE_INFINITY);
    const out = [];
    let p = 0;
    let s = 0;
    while (p < processTimed.length || s < sinkTimed.length) {
        const proc = processTimed[p];
        const sink = sinkTimed[s];
        if (proc !== undefined && (sink === undefined || proc.atMs <= sink.entry.atMs)) {
            out.push({ ...proc.event, seq: out.length + 1, t: proc.atMs - first });
            p++;
        }
        else if (sink !== undefined) {
            const { atMs, phase, event } = sink.entry;
            out.push({ ...event, seq: out.length + 1, t: atMs - first, phase });
            s++;
        }
    }
    return out;
}
//# sourceMappingURL=merge.js.map