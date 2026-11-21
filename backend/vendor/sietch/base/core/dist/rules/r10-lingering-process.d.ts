import type { Rule } from "./types.js";
/**
 * R10: a process that outlives the install and load steps. Detaching is how Shai-Hulud 2.0 made
 * the install look clean. A pid's events after its exit belong to a new process (PID reuse).
 */
export declare const r10LingeringProcess: Rule;
//# sourceMappingURL=r10-lingering-process.d.ts.map