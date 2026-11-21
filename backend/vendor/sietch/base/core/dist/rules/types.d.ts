import type { RuleContext } from "../context.js";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export declare const SEVERITY_RANK: Readonly<Record<Severity, number>>;
export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9" | "R10" | "R13";
export interface FindingDraft {
    readonly severity: Severity;
    readonly explanation: string;
    readonly evidence: readonly number[];
}
export interface Rule {
    readonly id: RuleId;
    readonly title: string;
    evaluate(ctx: RuleContext): FindingDraft[];
}
/** Group drafts by a key, so one finding covers every event about the same subject. */
export declare class Grouper {
    private readonly groups;
    add(key: string, severity: Severity, explanation: string, seq: number): void;
    drafts(): FindingDraft[];
}
//# sourceMappingURL=types.d.ts.map