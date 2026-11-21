import { type Rule } from "./types.js";
/**
 * R13: part of the behaviour wasn't seen. Either the trace hit the event limit, or the capture
 * sink cut off a request body, so a honeytoken could be in the part R1 never saw (blue-team BT-20).
 */
export declare const r13TruncatedTrace: Rule;
//# sourceMappingURL=r13-truncated-trace.d.ts.map