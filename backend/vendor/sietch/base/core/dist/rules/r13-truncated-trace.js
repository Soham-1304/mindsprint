import { Grouper } from "./types.js";
/**
 * R13: part of the behaviour wasn't seen. Either the trace hit the event limit, or the capture
 * sink cut off a request body, so a honeytoken could be in the part R1 never saw (blue-team BT-20).
 */
export const r13TruncatedTrace = {
    id: "R13",
    title: "Part of the trace is missing",
    evaluate(ctx) {
        const g = new Grouper();
        for (const event of ctx.events) {
            const v = ctx.viewsOf(event);
            if (v.path?.complete === false || v.target?.complete === false) {
                g.add("resolution", "High", "Some paths couldn't be fully resolved through the symlinks the package created (a loop, a long chain, or too many links), so where they really point wasn't checked.", event.seq);
            }
        }
        for (const event of ctx.events) {
            if (event.type === "exec" && event.argvTruncated === true) {
                g.add("argv", "High", `The argument list of ${ctx.show(event.path)} was cut off, so part of the command wasn't checked.`, event.seq);
            }
        }
        if (ctx.input.eventsTruncated) {
            g.add("events", "High", "The trace reached the event limit and was cut off, so anything the package did afterwards wasn't seen.", ctx.lastSeq);
        }
        for (const event of ctx.events) {
            if (event.type === "http" && event.bodyTruncated) {
                g.add(`body:${event.host}`, "High", `A ${event.method} request to ${ctx.show(event.host)} had a body larger than the capture limit, so part of what was sent wasn't checked.`, event.seq);
            }
        }
        return g.drafts();
    },
};
//# sourceMappingURL=r13-truncated-trace.js.map