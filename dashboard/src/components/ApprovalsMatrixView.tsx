import { Check, KeyRound, Shield, ShieldAlert, ShieldOff, Undo2, X } from "lucide-react";
import { useState } from "react";
import type { ApprovalRequest, AuditLogEntry } from "../types";

interface ApprovalsMatrixViewProps {
  approvals: ApprovalRequest[];
  auditLog: AuditLogEntry[];
  operatorToken: string;
  onChangeOperatorToken: (token: string) => void;
  approvalError?: string | null;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ApprovalsMatrixView({
  approvals,
  auditLog,
  operatorToken,
  onChangeOperatorToken,
  approvalError,
  onDecideApproval,
}: ApprovalsMatrixViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  async function handleAction(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    try {
      await onDecideApproval(id, decision);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* 3-Column Safety Tier Policy Matrix */}
      <section className="tiers-matrix" aria-label="Safety Tier Policy Matrix">
        <div className="tier-column tier-auto">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="badge badge-auto">
              <Shield size={13} />
              TIER 1: AUTO
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--safe)" }}>
              Autonomous
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)" }}>
            Reversible, non-destructive diagnostics and isolated remediation with zero production IAM keys.
          </p>
          <ul className="tier-list">
            <li>Open Fix PRs on agent/fix-* branches with failing-&gt;passing tests</li>
            <li>Run Sietch 3-Layer sandbox detonations &amp; post GitHub Check Runs</li>
            <li>Restart exited stateless containers (pulseshop-payments) via The Hands</li>
          </ul>
        </div>

        <div className="tier-column tier-ask">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="badge badge-ask">
              <ShieldAlert size={13} />
              TIER 2: ASK_FIRST
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--warn)" }}>
              1-Tap Operator Gate
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)" }}>
            Production traffic or main-branch mutations require explicit human 1-tap approval + recorded undoPlan.
          </p>
          <ul className="tier-list">
            <li>Revert merged releases on main branch</li>
            <li>Roll back Nginx canary weights (orders-v2 10% -&gt; 0%)</li>
            <li>Apply runtime configuration or feature-flag overrides</li>
          </ul>
        </div>

        <div className="tier-column tier-never">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="badge badge-never">
              <ShieldOff size={13} />
              TIER 3: NEVER
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--danger)" }}>
              Hard Policy Block
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)" }}>
            High blast-radius operations are permanently prohibited; agent emits operator runbooks only.
          </p>
          <ul className="tier-list">
            <li>Database drops, destructive migrations, or volume purges</li>
            <li>Cloud IAM, RBAC, secrets rotation, or credential writes</li>
            <li>Force-pushing main or disabling branch protection checks</li>
          </ul>
        </div>
      </section>

      {/* 1-Tap Approvals Queue */}
      <section aria-label="1-Tap Approvals Queue" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="panel-title">ASK_FIRST 1-Tap Approvals Queue</h2>
            <span className="badge badge-ask mono">
              {approvals.filter((a) => a.status === "PENDING").length} awaiting decision
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 10px",
            }}
          >
            <KeyRound size={14} color="var(--accent)" />
            <label htmlFor="operator-token-input" style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
              Operator Key
            </label>
            <input
              id="operator-token-input"
              type={showToken ? "text" : "password"}
              value={operatorToken}
              onChange={(e) => onChangeOperatorToken(e.target.value)}
              placeholder="X-Operator-Token"
              className="mono"
              style={{
                background: "var(--bg-canvas)",
                border: "1px solid var(--border-strong)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                width: 190,
                color: "var(--ink-primary)",
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => setShowToken((prev) => !prev)}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {approvalError && (
          <div
            className="badge badge-critical"
            style={{ marginBottom: 12, padding: "8px 12px", width: "100%", justifyContent: "flex-start" }}
          >
            {approvalError}
          </div>
        )}

        <div className="approval-list">
          {approvals.map((item) => {
            const isPending = item.status === "PENDING";
            const isBusy = busyId === item.id;
            return (
              <div key={item.id} className={`approval-card ${isPending ? "" : "decided"}`}>
                <div className="approval-head">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        {item.id}
                      </span>
                      <span className="badge badge-muted mono">{item.incidentId}</span>
                      <span
                        className={`badge ${
                          isPending
                            ? "badge-ask"
                            : item.status === "REJECTED"
                              ? "badge-critical"
                              : "badge-safe"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        Target: {item.target}
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{item.actionTitle}</h3>
                  </div>

                  {isPending ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-approve"
                        disabled={isBusy}
                        onClick={() => handleAction(item.id, "APPROVE")}
                      >
                        <Check size={15} />
                        <span>{isBusy ? "Executing..." : "Approve & Execute"}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={isBusy}
                        onClick={() => handleAction(item.id, "REJECT")}
                      >
                        <X size={15} />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      {item.status} by {item.decidedBy} at {item.decidedAt ? formatClock(item.decidedAt) : ""}
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)" }}>{item.rationale}</p>

                <ul className="tier-list">
                  {item.evidenceCitations.map((cite, idx) => (
                    <li key={idx}>{cite}</li>
                  ))}
                </ul>

                <div className="undo-plan-box">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent)",
                      marginBottom: 4,
                    }}
                  >
                    <Undo2 size={13} />
                    <span>Auto-Verifier Undo Plan (Triggers if metrics fail 30s post-action check)</span>
                  </div>
                  <div className="mono" style={{ fontSize: 12 }}>
                    {item.undoPlan}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Immutable Audit Log Table */}
      <section className="panel" aria-label="Permissions Audit Log">
        <div className="panel-header">
          <h2 className="panel-title">Immutable Governance &amp; Execution Audit Log</h2>
          <span className="badge badge-muted mono">{auditLog.length} entries</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Tier</th>
                <th>Action</th>
                <th>Target</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((row) => (
                <tr key={row.id}>
                  <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--ink-muted)" }}>
                    {formatClock(row.timestamp)}
                  </td>
                  <td className="mono" style={{ color: "var(--ink-secondary)" }}>
                    {row.actor}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        row.tier === "AUTO"
                          ? "badge-auto"
                          : row.tier === "ASK_FIRST"
                            ? "badge-ask"
                            : "badge-never"
                      }`}
                    >
                      {row.tier}
                    </span>
                  </td>
                  <td>{row.action}</td>
                  <td className="mono" style={{ color: "var(--ink-muted)" }}>
                    {row.target}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        row.outcome === "BLOCKED_POLICY" || row.outcome === "REJECTED"
                          ? "badge-critical"
                          : "badge-safe"
                      }`}
                    >
                      {row.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
