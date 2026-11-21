// The decision. judge() never throws: any unexpected condition becomes an ERROR verdict, and only
// SAFE allows an install (fail closed).
import { buildContext } from "./context.js";
import { MAX_EVIDENCE_PER_FINDING, MAX_FINDINGS_PER_RULE, MAX_REASON } from "./limits.js";
import { RULE_ORDER, RULES } from "./rules/index.js";
import { SEVERITY_RANK } from "./rules/types.js";
import { validateScanInput } from "./schema.js";
import { quote } from "./text.js";
/** Bump whenever any rule's behaviour changes. Verdicts from other versions are never reused. */
export const RULESET_VERSION = "1.2.0"; // 1.1.0: more credential stores (BT-R2-2). 1.2.0: unrecorded UDP destinations (R3), cut-off argv (R13)
/** A verdict for a scan that failed, timed out, or couldn't be judged. It blocks. */
export function errorVerdict(reason) {
    return {
        kind: "ERROR",
        rulesetVersion: RULESET_VERSION,
        reason: quote(reason, MAX_REASON),
        findings: [],
        omittedFindings: 0,
    };
}
/** The only way to decide whether an install may go ahead: true for SAFE, false for everything else. */
export function allowsInstall(verdict) {
    return verdict.kind === "SAFE";
}
/** Any Critical gives MALICIOUS, any High gives SUSPICIOUS, otherwise SAFE. */
export function kindFromFindings(findings) {
    let max = 0;
    for (const f of findings)
        max = Math.max(max, SEVERITY_RANK[f.severity]);
    if (max >= SEVERITY_RANK.Critical)
        return "MALICIOUS";
    if (max >= SEVERITY_RANK.High)
        return "SUSPICIOUS";
    return "SAFE";
}
/** Judge an untrusted scan input. */
export function judge(input) {
    return judgeWith(input, RULES);
}
/**
 * judge() with an explicit rule list. Exported for tests (to prove that a broken rule gives ERROR),
 * and deliberately not exported from the package's index.
 */
export function judgeWith(input, rules) {
    try {
        const validated = validateScanInput(input);
        if (!validated.ok)
            return errorVerdict(validated.reason);
        const scan = validated.value;
        if (scan.eventsTruncated && scan.events.length === 0)
            return errorVerdict("the trace was truncated but has no events");
        if (!scan.events.some((e) => e.type === "exec")) {
            return errorVerdict("the trace has no exec events, so the recording probably failed");
        }
        const ctx = buildContext(scan);
        const all = [];
        for (const rule of rules) {
            for (const draft of rule.evaluate(ctx)) {
                const evidence = [...new Set(draft.evidence)].sort((a, b) => a - b);
                if (evidence.length === 0 || evidence.some((seq) => !ctx.seqs.has(seq))) {
                    return errorVerdict(`rule ${rule.id} produced invalid evidence`);
                }
                all.push({
                    ruleId: rule.id,
                    severity: draft.severity,
                    title: rule.title,
                    explanation: draft.explanation,
                    evidence,
                });
            }
        }
        // The kind comes from every finding, before anything is capped for display.
        const kind = kindFromFindings(all);
        const order = (id) => {
            const i = RULE_ORDER.indexOf(id);
            return i < 0 ? RULE_ORDER.length : i;
        };
        all.sort((a, b) => order(a.ruleId) - order(b.ruleId) ||
            (a.evidence[0] ?? 0) - (b.evidence[0] ?? 0) ||
            (a.explanation < b.explanation ? -1 : a.explanation > b.explanation ? 1 : 0));
        const perRule = new Map();
        const findings = [];
        let omittedFindings = 0;
        for (const f of all) {
            const count = perRule.get(f.ruleId) ?? 0;
            if (count >= MAX_FINDINGS_PER_RULE) {
                omittedFindings++;
                continue;
            }
            perRule.set(f.ruleId, count + 1);
            findings.push({ ...f, evidence: f.evidence.slice(0, MAX_EVIDENCE_PER_FINDING) });
        }
        return { kind, rulesetVersion: RULESET_VERSION, findings, omittedFindings };
    }
    catch (error) {
        const name = error instanceof Error ? error.name : "unknown";
        return errorVerdict(`internal error (${name}), so the package is blocked`);
    }
}
//# sourceMappingURL=verdict.js.map