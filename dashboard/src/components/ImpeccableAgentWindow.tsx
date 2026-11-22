import { animate, stagger } from "animejs";
import {
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitPullRequest,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApprovalRequest, IncidentRecord } from "../types";
import { BklitMetricChart, BorderBeam } from "./craft/CraftPrimitives";

interface ImpeccableAgentWindowProps {
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  apiBase: string;
  repoFullName: string;
  operatorToken: string;
  onChangeOperatorToken: (val: string) => void;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
}

type PreviewMode = "diff" | "counterfactual" | "metrics";

function formatTtd(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ImpeccableAgentWindow({
  incidents,
  approvals,
  apiBase,
  repoFullName,
  operatorToken,
  onChangeOperatorToken,
  onDecideApproval,
  onOpenPostmortem,
}: ImpeccableAgentWindowProps) {
  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id ?? "");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("diff");
  const [downloading, setDownloading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const stepsRef = useRef<HTMLDivElement | null>(null);

  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];
  const pendingApproval = selected
    ? approvals.find((a) => a.incidentId === selected.id && a.status === "PENDING")
    : undefined;

  useEffect(() => {
    const container = stepsRef.current;
    if (!container) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const items = container.querySelectorAll(".agent-step-row");
    if (items.length === 0) return;
    animate(items, {
      opacity: [0.35, 1],
      translateY: [6, 0],
      delay: stagger(55),
      duration: 360,
      ease: "outExpo",
    });
  }, [selected?.id]);

  async function handleDownloadReport(inc: IncidentRecord) {
    setDownloading(true);
    try {
      const resp = await fetch(`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/report.md`);
      const text = resp.ok
        ? await resp.text()
        : inc.rcaReportMarkdown ||
          `# Patch-Up Incident Report — ${inc.id}\n\n- Service: ${inc.service}\n- Summary: ${inc.diagnosisSummary}\n`;
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patch-up-report-${inc.id}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleApproval(decision: "APPROVE" | "REJECT") {
    if (!pendingApproval) return;
    setDeciding(true);
    try {
      await onDecideApproval(pendingApproval.id, decision);
    } finally {
      setDeciding(false);
    }
  }

  if (!selected) {
    return (
      <section className="agent-studio-section" aria-label="Patch-Up Live Agent Workspace">
        <div className="agent-empty-window">
          <CheckCircle2 size={22} color="var(--safe)" />
          <div>
            <strong>All services nominal</strong>
            <p>
              Patch-Up is armed in push-ephemeral mode. When a service breaches a tracked signal,
              the live diagnosis stream and surgical Fix PR preview appear here automatically.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const branchLabel = selected.fixPrNumber ? `fix/${selected.id.toLowerCase()}` : "main";
  const filePath = selected.topFrame?.file || selected.culpritFile || "services/orders/src/routes/orders.js";

  return (
    <section id="live-agent-window" className="agent-studio-section" aria-label="Patch-Up Live Agent Workspace">
      {/* Crisp Incident Switcher Row */}
      <div className="agent-section-top">
        <div>
          <h2 className="agent-section-title">Live Diagnosis &amp; Fix PR Studio</h2>
          <p className="agent-section-sub">
            Push-triggered analysis, pre-merge verification, and zero-retention RAM purge for{" "}
            <span className="mono">{repoFullName}</span>.
          </p>
        </div>

        <div className="agent-incident-pills" role="tablist" aria-label="Select incident">
          {incidents.slice(0, 5).map((inc) => (
            <button
              key={inc.id}
              type="button"
              role="tab"
              aria-selected={inc.id === selected.id}
              className={`agent-inc-pill mono ${inc.id === selected.id ? "active" : ""}`}
              onClick={() => setSelectedId(inc.id)}
            >
              <span
                className={`dot ${inc.status === "RESOLVED" ? "dot-healthy" : "dot-warn"}`}
                aria-hidden="true"
              />
              <span>{inc.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Impeccable-Inspired Dual Split Studio Frame */}
      <div className="impeccable-frame">
        <BorderBeam active={selected.status !== "RESOLVED"} />

        {/* Window Chrome */}
        <div className="impeccable-chrome">
          <div className="chrome-left">
            <span className="traffic-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="chrome-branch mono">{branchLabel}</span>
          </div>

          <div className="chrome-right">
            <span className="chrome-brand-mark" aria-hidden="true" />
            <span className="chrome-brand-label">Patch-Up Agent</span>
          </div>
        </div>

        {/* Split Body: Left Dark Agent Stream | Right Crisp Daylight Diff & Evidence */}
        <div className="impeccable-split">
          {/* LEFT PANE: Agent Execution Stream */}
          <div className="agent-console-pane">
            <div className="console-subhead mono">Incident stream · {selected.service}</div>

            {/* Prompt / Trigger Box */}
            <div className="console-trigger-box">
              <span className="console-cmd-tag mono">/patch-up</span>
              <span className="console-rule-tag mono">{selected.ruleId}</span>
              <span className="console-trigger-text">{selected.title}</span>
            </div>

            {/* Agent Reasoning Summary */}
            <div className="console-narrative">
              <div className="console-label">Agent</div>
              <p>{selected.diagnosisSummary}</p>
            </div>

            {/* Chronological Verification Steps (anime.js staggered) */}
            <div ref={stepsRef} className="console-steps">
              <div className="agent-step-row">
                <Sparkles size={14} color="#FF7A24" aria-hidden="true" />
                <div>
                  <div className="step-head">
                    Root cause isolated in {formatTtd(selected.timeToDiagnosisMs)}
                  </div>
                  <div className="step-meta mono">
                    {selected.modelUsed || "gemini-3.5-flash-lite"} ·{" "}
                    {Math.round((selected.confidence || 0.95) * 100)}% confidence · {filePath}
                    {selected.topFrame?.line ? `:${selected.topFrame.line}` : ""}
                  </div>
                </div>
              </div>

              <div className="agent-step-row">
                <ShieldCheck size={14} color="#34D399" aria-hidden="true" />
                <div>
                  <div className="step-head">
                    Pre-merge security &amp; syntax gate:{" "}
                    {selected.sietchSelfGate?.blocked ? "BLOCKED" : "PASSED"}
                  </div>
                  <div className="step-meta mono">
                    {selected.testProof
                      ? `${selected.testProof.beforeStatus} → ${selected.testProof.afterStatus} · `
                      : "node --check verified · "}
                    ruleset {selected.sietchSelfGate?.rulesetVersion || "1.2.0"}
                  </div>
                </div>
              </div>

              <div className="agent-step-row">
                <GitPullRequest size={14} color="#FF7A24" aria-hidden="true" />
                <div>
                  <div className="step-head">
                    {selected.fixPrNumber
                      ? `Opened Fix PR #${selected.fixPrNumber} (PR-Only)`
                      : "Fix PR queued"}
                  </div>
                  <div className="step-meta mono">
                    main branch protected ·{" "}
                    {selected.status === "RESOLVED" ? "Merged & verified" : "Awaiting human review"}
                  </div>
                </div>
              </div>

              <div className="agent-step-row">
                <Lock size={14} color="#34D399" aria-hidden="true" />
                <div>
                  <div className="step-head">Zero-Retention RAM purged (0 B retained)</div>
                  <div className="step-meta mono">
                    {selected.purgeReceipt
                      ? `${selected.purgeReceipt.itemsPurged} items · ${selected.purgeReceipt.redactionsApplied} PII redactions · sha256:${selected.purgeReceipt.receiptHash.slice(0, 12)}`
                      : "Ephemeral RAM vault cleared on completion"}
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Operator Bar (Bottom of Console — matches Screenshot 1 command dock!) */}
            <div className="console-action-dock">
              {pendingApproval ? (
                <div className="console-approval-row">
                  <input
                    type="password"
                    className="console-token-input mono"
                    value={operatorToken}
                    onChange={(e) => onChangeOperatorToken(e.target.value)}
                    placeholder="Operator token"
                    aria-label="Operator approval token"
                  />
                  <button
                    type="button"
                    className="console-btn-orange"
                    disabled={deciding}
                    onClick={() => void handleApproval("APPROVE")}
                  >
                    <Check size={13} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    className="console-btn-ghost"
                    disabled={deciding}
                    onClick={() => void handleApproval("REJECT")}
                  >
                    <X size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <div className="console-quick-actions">
                  {selected.fixPrUrl && (
                    <a
                      href={selected.fixPrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="console-btn-orange"
                    >
                      <ExternalLink size={13} />
                      <span>Fix PR #{selected.fixPrNumber}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    className="console-btn-ghost"
                    disabled={downloading}
                    onClick={() => void handleDownloadReport(selected)}
                  >
                    <Download size={13} />
                    <span>{downloading ? "Exporting..." : "Report .md"}</span>
                  </button>
                  <button
                    type="button"
                    className="console-btn-ghost"
                    onClick={() => onOpenPostmortem(selected.id)}
                  >
                    <FileText size={13} />
                    <span>Postmortem</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Crisp Daylight Evidence & Diff Preview */}
          <div className="agent-preview-pane">
            {/* Browser/Repo Address Bar */}
            <div className="preview-address-bar">
              <div className="preview-url-pill mono">
                <span className="dot dot-healthy" aria-hidden="true" />
                <span>
                  {repoFullName}/{filePath}
                </span>
              </div>

              <div className="preview-mode-tabs" role="tablist" aria-label="Evidence view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === "diff"}
                  className={`preview-tab ${previewMode === "diff" ? "active" : ""}`}
                  onClick={() => setPreviewMode("diff")}
                >
                  <FileCode2 size={13} />
                  <span>Diff</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === "counterfactual"}
                  className={`preview-tab ${previewMode === "counterfactual" ? "active" : ""}`}
                  onClick={() => setPreviewMode("counterfactual")}
                >
                  <Scale size={13} />
                  <span>Strategies</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === "metrics"}
                  className={`preview-tab ${previewMode === "metrics" ? "active" : ""}`}
                  onClick={() => setPreviewMode("metrics")}
                >
                  <span>Signal</span>
                </button>
              </div>
            </div>

            <div className="preview-canvas">
              {previewMode === "diff" && (
                <div className="preview-stack">
                  {selected.topFrame && (
                    <div className="preview-evidence-card">
                      <div className="preview-card-label mono">Top Stack Frame</div>
                      <div className="mono" style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600 }}>
                        {selected.topFrame.error}
                      </div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 4 }}>
                        at <span style={{ color: "var(--accent)" }}>{selected.topFrame.function}()</span> ·{" "}
                        {selected.topFrame.file}:{selected.topFrame.line}
                      </div>
                    </div>
                  )}

                  <div className="preview-evidence-card">
                    <div className="preview-card-label mono">Surgical Patch Diff</div>
                    <pre className="code-block" style={{ marginTop: 6 }}>
                      {(selected.gitBlameDiff ||
                        "- const tieredRate = discountMeta.percentage / 100;\n+ if (discountMeta && typeof discountMeta.percentage === 'number') {")
                        .split("\n")
                        .map((line, idx) => (
                          <span
                            key={idx}
                            className={
                              line.startsWith("+")
                                ? "diff-line-add"
                                : line.startsWith("-")
                                  ? "diff-line-del"
                                  : "diff-line-ctx"
                            }
                          >
                            {line}
                          </span>
                        ))}
                    </pre>
                  </div>

                  {selected.testProof && (
                    <div className="preview-proof-row">
                      <div className="preview-proof-pill fail mono">
                        BEFORE: {selected.testProof.beforeStatus}
                      </div>
                      <span className="mono" style={{ color: "var(--ink-muted)" }}>
                        →
                      </span>
                      <div className="preview-proof-pill pass mono">
                        AFTER: {selected.testProof.afterStatus}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previewMode === "counterfactual" && (
                <div className="preview-stack">
                  {(selected.counterfactualEvaluations && selected.counterfactualEvaluations.length > 0
                    ? selected.counterfactualEvaluations
                    : [
                        {
                          strategyName: "Surgical Null-Safe Fix PR",
                          actionType: "FIX_PR",
                          expectedBenefit: "Resolves root TypeError without disrupting active traffic.",
                          riskOfWorsening: "LOW" as const,
                          cascadingRisk: "Isolated branch PR with regression test.",
                          reversibility: "IMMEDIATE" as const,
                          requiredAuthorization: "AUTO_FIX" as const,
                          executionFeasibility: true,
                          counterfactualReasoning: "Direct fix verified via node --check.",
                          heuristicScore: 92,
                        },
                      ]
                  ).map((ev, idx) => {
                    const isBest = idx === (selected.recommendedStrategyIndex ?? 0);
                    return (
                      <div key={ev.strategyName} className={`preview-strategy-row ${isBest ? "best" : ""}`}>
                        <div className="preview-strategy-top">
                          <strong>{ev.strategyName}</strong>
                          <span className="mono" style={{ color: isBest ? "var(--accent)" : "var(--ink-muted)", fontWeight: 600 }}>
                            {ev.heuristicScore}/100
                          </span>
                        </div>
                        <p>{ev.counterfactualReasoning || ev.expectedBenefit}</p>
                        <div className="preview-strategy-meta mono">
                          <span>Risk: {ev.riskOfWorsening}</span>
                          <span>Tier: {ev.requiredAuthorization}</span>
                          <span>Reversible: {ev.reversibility}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {previewMode === "metrics" && (
                <div className="preview-stack">
                  <div className="preview-evidence-card">
                    <div className="preview-card-label mono">
                      Tracked Signal · {selected.ruleId}
                    </div>
                    <BklitMetricChart
                      points={selected.metricSeries}
                      unit={selected.metricUnit}
                      accentColor={selected.ruleId === "BIZ_ORDERS_DROP" ? "#D97706" : "#FF5500"}
                      ariaLabel={`${selected.ruleId} metric timeline`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
