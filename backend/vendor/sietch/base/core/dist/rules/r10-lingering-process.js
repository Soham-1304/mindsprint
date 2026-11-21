/**
 * R10: a process that outlives the install and load steps. Detaching is how Shai-Hulud 2.0 made
 * the install look clean. A pid's events after its exit belong to a new process (PID reuse).
 */
export const r10LingeringProcess = {
    id: "R10",
    title: "Left a process running",
    evaluate(ctx) {
        const open = new Map();
        const drafts = [];
        const describe = (inc) => `Process ${inc.pid}${inc.program === null ? "" : ` (${ctx.show(inc.program)})`}`;
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event) || !("pid" in event))
                continue;
            let inc = open.get(event.pid);
            if (inc === undefined) {
                inc = { pid: event.pid, firstSeq: event.seq, program: null, lingered: false };
                open.set(event.pid, inc);
            }
            if (event.type === "exec" && inc.program === null)
                inc.program = event.path;
            if (event.phase === "linger")
                inc.lingered = true;
            if (event.type === "exit") {
                if (inc.lingered) {
                    drafts.push({
                        severity: "High",
                        explanation: `${describe(inc)} was still active after the install and load steps finished.`,
                        evidence: [inc.firstSeq],
                    });
                }
                open.delete(event.pid);
            }
        }
        for (const inc of open.values()) {
            drafts.push({
                severity: "High",
                explanation: `${describe(inc)} was still running when the scan ended, so part of its behaviour wasn't seen.`,
                evidence: [inc.firstSeq],
            });
        }
        return drafts;
    },
};
//# sourceMappingURL=r10-lingering-process.js.map