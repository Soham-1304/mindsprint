import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitCommit,
  Lock,
  Scale,
  ServerCrash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { DiagnosisSource, IncidentRecord } from "../types";

function formatDiagnosisSource(source?: DiagnosisSource, modelUsed?: string): {
  label: string;
  badgeClass: string;
} {
  if (source === "AI_GROQ") {
    return { label: modelUsed ? `Groq Backup (${modelUsed})` : "Groq Backup", badgeClass: "badge-ask" };
  }
  if (source === "DETERMINISTIC_HEURISTIC") {
    return { label: "Deterministic Heuristic", badgeClass: "badge-muted" };
  }
  return { label: modelUsed ? `Gemini (${modelUsed})` : "Gemini 3.5 Flash-Lite", badgeClass: "badge-cyan" };
}

interface IncidentTimelineViewProps {
  incidents: IncidentRecord[];
  apiBase?: string;
  onOpenPostmortem: (incidentId: string) => void;
}

function MetricSparkChart({ incident }: { incident: IncidentRecord }) {
  const points = incident.metricSeries;
  const maxVal = Math.max(...points.map((p) => Math.max(p.value, p.baseline)), 1);
  const width = 460;
  const height = 112;
  const padX = 28;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (idx: number) =>
    padX + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * innerW);
  const toY = (val: number) => padY + innerH - (val / maxVal) * innerH;

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(pt.value).toFixed(1)}`)
    .join(" ");
  const baselineY = toY(points[0]?.baseline ?? 0);

  const strokeColor = incident.ruleId === "BIZ_ORDERS_DROP" ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding: "8px 0 4px" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "120px", display: "block" }}
        role="img"
        aria-label={`${incident.ruleId} metric timeline`}
      >
        {/* Baseline reference line */}
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          stroke="rgba(16, 185, 129, 0.45)"
          strokeDasharray="4 4"
          strokeWidth="1.2"
        />
        <text x={width - padX} y={Math.max(11, baselineY - 4)} fill="#6ee7b7" fontSize="10" textAnchor="end">
          baseline ({points[0]?.baseline}
          {incident.metricUnit})
        </text>

        {/* Actual metric curve */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.2" />

        {points.map((pt, idx) => (
          <g key={pt.label}>
            <circle cx={toX(idx)} cy={toY(pt.value)} r="3.2" fill={strokeColor} />
            <text
              x={toX(idx)}
              y={height - 2}
              fill="#64748b"
              fontSize="10"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function renderDiff(diff: string) {
  return diff.split("\n").map((line, i) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return (
        <span key={i} className="diff-line-add">
          {line}
        </span>
      );
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return (
        <span key={i} className="diff-line-del">
          {line}
        </span>
      );
    }
    if (line.startsWith("@@") || line.startsWith("commit ")) {
      return (
        <span key={i} className="diff-line-meta">
          {line}
        </span>
      );
    }
    return (
      <span key={i} style={{ display: "block" }}>
        {line}
      </span>
    );
  });
}

export function IncidentTimelineView({
  incidents,
  apiBase = "",
  onOpenPostmortem,
}: IncidentTimelineViewProps) {
  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id ?? "");
  const [downloadingReport, setDownloadingReport] = useState(false);
  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];

  async function handleDownloadReport(inc: IncidentRecord) {
    setDownloadingReport(true);
    try {
      const resp = await fetch(`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/report.md`);
      if (resp.ok) {
        const text = await resp.text();
        triggerMarkdownDownload(`patch-up-report-${inc.id}.md`, text);
        return;
      }
    } catch {
      // Fallback to client-side Markdown Blob
    } finally {
      setDownloadingReport(false);
    }

    const fallbackMd =
      inc.rcaReportMarkdown ||
      [
        `# Patch-Up Incident & Fix Report — ${inc.id}`,
        "",
        `- **Title:** ${inc.title}`,
        `- **Service:** pulseshop-${inc.service}`,
        `- **Rule:** ${inc.ruleId}`,
        `- **Time-to-Diagnosis:** ${(inc.timeToDiagnosisMs / 1000).toFixed(1)}s`,
        inc.sietchSelfGate
          ? `- **Sietch Self-Gate:** ${inc.sietchSelfGate.verdictKind} (ruleset ${inc.sietchSelfGate.rulesetVersion})`
          : "",
        inc.purgeReceipt
          ? `- **Zero-Retention Purge Receipt:** \`${inc.purgeReceipt.receiptHash}\` (0B retained, ${inc.purgeReceipt.itemsPurged} items purged)`
          : "",
        "",
        "## Diagnosis Summary",
        inc.diagnosisSummary,
      ]
        .filter(Boolean)
        .join("\n");

    triggerMarkdownDownload(`patch-up-report-${inc.id}.md`, fallbackMd);
  }

  function triggerMarkdownDownload(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!selected) {
    return (
      <div className="panel">
        <div className="panel-body">No incidents recorded yet. Deterministic Watcher is polling PulseShop every 10s.</div>
      </div>
    );
  }

  return (
    <div className="incident-grid">
      {/* Left Incident Selector Rail */}
      <aside className="panel" aria-label="Incidents List">
        <div className="panel-header">
          <h2 className="panel-title">Detected Incidents</h2>
          <span className="badge badge-muted mono">{incidents.length} total</span>
        </div>
        <div className="incident-list">
          {incidents.map((inc) => (
            <button
              key={inc.id}
              type="button"
              className={`incident-item ${inc.id === selected.id ? "selected" : ""}`}
              onClick={() => setSelectedId(inc.id)}
            >
              <div className="incident-item-top">
                <span className="mono" style={{ fontSize: 12, color: "#94a3b8" }}>
                  {inc.id}
                </span>
                <span
                  className={`badge ${
                    inc.status === "RESOLVED"
                      ? "badge-resolved"
                      : inc.severity === "Critical"
                        ? "badge-critical"
                        : "badge-high"
                  }`}
                >
                  {inc.status}
                </span>
              </div>
              <p className="incident-item-title">{inc.title}</p>
              <div className="incident-item-meta mono">
                <span>{inc.ruleId}</span>
                <span>TTD {(inc.timeToDiagnosisMs / 1000).toFixed(1)}s</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Right Timeline + Evidence Inspector */}
      <section className="incident-detail-stack" aria-label="Incident Evidence Inspector">
        {/* Header Summary */}
        <div className="panel">
          <div className="panel-header">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ color: "#94a3b8", fontSize: 12 }}>
                  {selected.id}
                </span>
                <span className={`badge ${selected.severity === "Critical" ? "badge-critical" : "badge-high"}`}>
                  <AlertTriangle size={12} />
                  {selected.ruleId}
                </span>
                <span className="badge badge-cyan">{selected.faultCategory}</span>
                <span
                  className={`badge ${
                    selected.safetyTier === "AUTO"
                      ? "badge-auto"
                      : selected.safetyTier === "ASK_FIRST"
                        ? "badge-ask"
                        : "badge-never"
                  }`}
                >
                  Tier: {selected.safetyTier}
                </span>
                {selected.diagnosisSource && (
                  <span className={`badge ${formatDiagnosisSource(selected.diagnosisSource, selected.modelUsed).badgeClass}`}>
                    <Cpu size={12} />
                    {formatDiagnosisSource(selected.diagnosisSource, selected.modelUsed).label}
                  </span>
                )}
                {selected.sietchSelfGate && (
                  <span
                    className={`badge ${selected.sietchSelfGate.blocked ? "badge-critical" : "badge-safe"} mono`}
                    title={`Sietch Self-Gate Ruleset v${selected.sietchSelfGate.rulesetVersion}`}
                  >
                    <ShieldCheck size={12} />
                    Sietch Self-Gate: {selected.sietchSelfGate.verdictKind}
                  </span>
                )}
                {selected.purgeReceipt && (
                  <span
                    className="badge badge-safe mono"
                    title={`SHA-256: ${selected.purgeReceipt.receiptHash} · ${selected.purgeReceipt.itemsPurged} items purged · ${selected.purgeReceipt.redactionsApplied} PII redactions`}
                  >
                    <Lock size={12} />
                    Zero-Retention Purged (0B retained)
                  </span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{selected.title}</h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {selected.fixPrUrl && (
                <a
                  href={selected.fixPrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  <ExternalLink size={14} />
                  <span>Fix PR #{selected.fixPrNumber}</span>
                </a>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => void handleDownloadReport(selected)}
                disabled={downloadingReport}
              >
                <Download size={14} />
                <span>{downloadingReport ? "Downloading..." : "Download Report .md"}</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onOpenPostmortem(selected.id)}
              >
                <FileText size={14} />
                <span>View Postmortem</span>
              </button>
            </div>
          </div>

          <div className="panel-body">
            <p style={{ margin: "0 0 14px", color: "#cbd5e1" }}>{selected.diagnosisSummary}</p>
            <div className="kv-grid">
              <div className="kv-item">
                <div className="kv-key">Service</div>
                <div className="kv-val mono">pulseshop-{selected.service}</div>
              </div>
              <div className="kv-item">
                <div className="kv-key">Time-to-Diagnosis</div>
                <div className="kv-val mono" style={{ color: "#22d3ee" }}>
                  {(selected.timeToDiagnosisMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="kv-item">
                <div className="kv-key">Brain Confidence</div>
                <div className="kv-val mono" style={{ color: "#6ee7b7" }}>
                  {Math.round(selected.confidence * 100)}%
                </div>
              </div>
              <div className="kv-item">
                <div className="kv-key">Culprit Commit</div>
                <div className="kv-val mono">
                  {selected.culpritCommitSha ? selected.culpritCommitSha : "None (Runtime Fault)"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline + Metric Chart */}
        <div className="evidence-two-col">
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Chronological Incident Stream</h3>
              <span className="badge badge-info mono">SSE Ordered</span>
            </div>
            <div className="panel-body">
              <div className="timeline-list">
                {selected.timeline.map((step) => (
                  <div key={step.id} className="timeline-step">
                    <div className="timeline-offset mono">[{step.offsetLabel}]</div>
                    <div className="timeline-rail" aria-hidden="true">
                      <span className={`timeline-node ${step.status}`} />
                    </div>
                    <div>
                      <div className="timeline-content-head">
                        <span className="badge badge-muted mono">{step.stage}</span>
                        <span className="timeline-title">{step.title}</span>
                      </div>
                      <p className="timeline-detail">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Watcher Metric Signal ({selected.ruleId})</h3>
              <span className="mono" style={{ fontSize: 12, color: "#94a3b8" }}>
                10s Prometheus Poll
              </span>
            </div>
            <div className="panel-body">
              <MetricSparkChart incident={selected} />

              {selected.testProof && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#94a3b8",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Sparkles size={13} color="#22d3ee" />
                    <span>Pre-Patch Failing -&gt; Post-Patch Passing Verification Gate</span>
                  </div>
                  <div className="test-proof-grid">
                    <div className="test-proof-box">
                      <span className="badge badge-critical mono" style={{ marginBottom: 6 }}>
                        BEFORE PATCH: FAIL
                      </span>
                      <div className="mono" style={{ fontSize: 12, color: "#fca5a5" }}>
                        {selected.testProof.beforeOutput}
                      </div>
                    </div>
                    <div className="test-proof-box">
                      <span className="badge badge-safe mono" style={{ marginBottom: 6 }}>
                        <CheckCircle2 size={12} />
                        AFTER PATCH: PASS
                      </span>
                      <div className="mono" style={{ fontSize: 12, color: "#6ee7b7" }}>
                        {selected.testProof.afterOutput}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selected.containerState && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#94a3b8",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ServerCrash size={14} color="#ef4444" />
                    <span>Path C Runtime Fault: docker inspect Snapshot</span>
                  </div>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <div className="kv-key">Container</div>
                      <div className="kv-val mono">{selected.containerState.container}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Status / Exit Code</div>
                      <div className="kv-val mono" style={{ color: "#fca5a5" }}>
                        {selected.containerState.status} ({selected.containerState.exitCode})
                      </div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">OOMKilled</div>
                      <div className="kv-val mono">{String(selected.containerState.oomKilled)}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">15m Commits</div>
                      <div className="kv-val mono">0 (git blame skipped)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Culprit Finder Evidence Block (topFrame + git blame diff) */}
        {(selected.topFrame || selected.gitBlameDiff) && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <GitCommit size={15} color="#22d3ee" />
                <span>Culprit Finder Evidence (topFrame Stack Frame &amp; git blame Diff)</span>
              </h3>
              {selected.culpritFile && (
                <span className="badge badge-muted mono">
                  <FileCode2 size={12} />
                  {selected.culpritFile}:{selected.culpritLine}
                </span>
              )}
            </div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selected.topFrame && (
                <div className="code-block">
                  <div style={{ color: "#fca5a5", marginBottom: 4 }}>{selected.topFrame.error}</div>
                  <div style={{ color: "#94a3b8" }}>
                    topFrame: <span style={{ color: "#67e8f9" }}>{selected.topFrame.function}()</span> at{" "}
                    <span style={{ color: "#f1f5f9" }}>
                      {selected.topFrame.file}:{selected.topFrame.line}:{selected.topFrame.column}
                    </span>
                  </div>
                </div>
              )}

              {selected.gitBlameDiff && (
                <pre className="code-block">{renderDiff(selected.gitBlameDiff)}</pre>
              )}
            </div>
          </div>
        )}

        {!selected.topFrame && !selected.gitBlameDiff && selected.containerState && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <Box size={15} color="#22d3ee" />
                <span>The Hands Execution Record (Zero Prod IAM Keys)</span>
              </h3>
              <span className="badge badge-auto">AUTO TIER WHITELISTED</span>
            </div>
            <div className="panel-body">
              <pre className="code-block">
                {`$ docker inspect ${selected.containerState.container} -> State.Status=exited ExitCode=${selected.containerState.exitCode}\n$ hands.restartWhitelisted("${selected.containerState.container}") -> 200 OK (healthy in 18s)`}
              </pre>
            </div>
          </div>
        )}

        {/* Counterfactual Strategy Comparison Panel */}
        {selected.counterfactualEvaluations && selected.counterfactualEvaluations.length > 0 && (
          <div className="panel" aria-label="Counterfactual Strategy Comparison">
            <div className="panel-header">
              <h3 className="panel-title">
                <Scale size={15} color="#22d3ee" />
                <span>Counterfactual Strategy Comparison</span>
              </h3>
              <span className="badge badge-cyan mono">
                {selected.counterfactualEvaluations.length} strategies evaluated
              </span>
            </div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selected.selectedStrategyRationale && (
                <div className="undo-plan-box" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#67e8f9", marginBottom: 4 }}>
                    Why Recommended Strategy Won
                  </div>
                  <div style={{ fontSize: 13, color: "#e2e8f0" }}>{selected.selectedStrategyRationale}</div>
                </div>
              )}

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Risk of Worsening</th>
                      <th>Reversibility</th>
                      <th>Score</th>
                      <th>Counterfactual Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.counterfactualEvaluations.map((ev, idx) => {
                      const isRecommended = idx === (selected.recommendedStrategyIndex ?? 0);
                      const riskBadgeClass =
                        ev.riskOfWorsening === "LOW"
                          ? "badge-safe"
                          : ev.riskOfWorsening === "MEDIUM"
                            ? "badge-ask"
                            : "badge-critical";
                      return (
                        <tr
                          key={`${ev.strategyName}-${idx}`}
                          style={
                            isRecommended
                              ? { background: "rgba(34, 211, 238, 0.06)" }
                              : undefined
                          }
                        >
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{ev.strategyName}</span>
                                {isRecommended && (
                                  <span className="badge badge-safe mono">RECOMMENDED</span>
                                )}
                              </div>
                              <span className="mono" style={{ fontSize: 12, color: "#94a3b8" }}>
                                {ev.actionType} · {ev.requiredAuthorization}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${riskBadgeClass} mono`}>{ev.riskOfWorsening}</span>
                          </td>
                          <td className="mono" style={{ fontSize: 12, color: "#cbd5e1" }}>
                            {ev.reversibility}
                          </td>
                          <td className="mono" style={{ fontWeight: 700, color: isRecommended ? "#22d3ee" : "#cbd5e1" }}>
                            {ev.heuristicScore}/100
                          </td>
                          <td style={{ fontSize: 13, color: "#cbd5e1", minWidth: 240 }}>
                            <div>{ev.counterfactualReasoning}</div>
                            {ev.cascadingRisk && (
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                Cascading risk: {ev.cascadingRisk}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
