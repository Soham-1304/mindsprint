export const SEVERITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
/** Group drafts by a key, so one finding covers every event about the same subject. */
export class Grouper {
    groups = new Map();
    add(key, severity, explanation, seq) {
        const g = this.groups.get(key);
        if (g === undefined) {
            this.groups.set(key, { severity, explanation, evidence: [seq] });
            return;
        }
        g.evidence.push(seq);
        if (SEVERITY_RANK[severity] > SEVERITY_RANK[g.severity])
            g.severity = severity;
    }
    drafts() {
        return [...this.groups.values()];
    }
}
//# sourceMappingURL=types.js.map