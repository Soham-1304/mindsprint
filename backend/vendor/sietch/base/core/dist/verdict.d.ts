import { type Rule, type RuleId, type Severity } from "./rules/types.js";
/** Bump whenever any rule's behaviour changes. Verdicts from other versions are never reused. */
export declare const RULESET_VERSION = "1.2.0";
export type VerdictKind = "SAFE" | "SUSPICIOUS" | "MALICIOUS" | "ERROR";
export interface Finding {
    readonly ruleId: RuleId;
    readonly severity: Severity;
    readonly title: string;
    readonly explanation: string;
    readonly evidence: readonly number[];
}
export type Verdict = {
    readonly kind: "SAFE" | "SUSPICIOUS" | "MALICIOUS";
    readonly rulesetVersion: string;
    readonly findings: readonly Finding[];
    readonly omittedFindings: number;
} | {
    readonly kind: "ERROR";
    readonly rulesetVersion: string;
    readonly reason: string;
    readonly findings: readonly [];
    readonly omittedFindings: 0;
};
/** A verdict for a scan that failed, timed out, or couldn't be judged. It blocks. */
export declare function errorVerdict(reason: string): Verdict;
/** The only way to decide whether an install may go ahead: true for SAFE, false for everything else. */
export declare function allowsInstall(verdict: Verdict): boolean;
/** Any Critical gives MALICIOUS, any High gives SUSPICIOUS, otherwise SAFE. */
export declare function kindFromFindings(findings: readonly {
    readonly severity: Severity;
}[]): "SAFE" | "SUSPICIOUS" | "MALICIOUS";
/** Judge an untrusted scan input. */
export declare function judge(input: unknown): Verdict;
/**
 * judge() with an explicit rule list. Exported for tests (to prove that a broken rule gives ERROR),
 * and deliberately not exported from the package's index.
 */
export declare function judgeWith(input: unknown, rules: readonly Rule[]): Verdict;
//# sourceMappingURL=verdict.d.ts.map