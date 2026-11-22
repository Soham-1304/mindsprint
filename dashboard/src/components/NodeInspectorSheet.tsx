import {
  Activity,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import type { IncidentRecord, LinkedProject, SietchPrScanResult } from "../types";
import { type LayerHealthState, TOWER_NODES, type TowerNodeId } from "./3d/types";

interface NodeInspectorSheetProps {
  nodeId: TowerNodeId;
  health: LayerHealthState;
  project: LinkedProject | undefined;
  incidents: IncidentRecord[];
  scans: SietchPrScanResult[];
  apiBase: string;
  onClose: () => void;
  onRescanSignals: (projectId: string) => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
}

type InspectorTab = "incidents" | "logs" | "telemetry";
type BackendSub = "orders" | "payments" | "gateway";

export function NodeInspectorSheet({
  nodeId,
  health,
  project,
  incidents,
  scans,
  apiBase,
  onClose,
  onRescanSignals,
  onOpenPostmortem,
}: NodeInspectorSheetProps) {
  const [tab, setTab] = useState<InspectorTab>("incidents");
  const [backendSub, setBackendSub] = useState<BackendSub>("orders");
  const [rescanning, setRescanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = TOWER_NODES[nodeId];
  const activeServiceKey = nodeId === "backend-service" ? backendSub : meta.mappedService;

  const matchingIncidents = activeServiceKey
    ? incidents.filter((i) => i.service === activeServiceKey)
    : incidents;

  const caps = project?.capabilities;
  const webhookBase = apiBase || "https://patch-up-backend.onrender.com";
  const pushSnippet = `// Set PATCHUP_WEBHOOK_URL=${webhookBase}
fetch(\`\${process.env.PATCHUP_WEBHOOK_URL}/api/webhooks/incident-bundle\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    repo: "${project?.fullName ?? "Soham-1304/pulseshop"}",
    serviceId: "${activeServiceKey || "orders"}-service",
    rule: "ERR_5XX_SPIKE",
    windowHours: 6,
    logs: recentLogs,
  }),
}).catch(() => {});`;

  async function handleRescan() {
    if (!project) return;
    setRescanning(true);
    try {
      await onRescanSignals(project.id);
    } finally {
      setRescanning(false);
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(pushSnippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const statusBadgeClass =
    health === "CRITICAL"
      ? "badge-critical"
      : health === "DEGRADED" || health === "RECOVERING"
        ? "badge-ask"
        : "badge-safe";

  return (
    <aside className="inspector-sheet" aria-label={`${meta.name} inspector`}>
      {/* Single Clean Header */}
      <div className="inspector-head">
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <ArrowLeft size={14} color="var(--accent)" />
          <span>Back</span>
          <kbd className="kbd-hint">Esc</kbd>
        </button>

        <span className={`badge mono ${statusBadgeClass}`}>
          <span
            className={`dot ${health === "CRITICAL" ? "dot-degraded" : health === "HEALTHY" ? "dot-healthy" : "dot-warn"}`}
            aria-hidden="true"
          />
          {health}
        </span>
      </div>

      {/* Node Identity */}
      <div className="inspector-identity">
        <div className="inspector-tier mono">{meta.tierLabel}</div>
        <h2 className="inspector-title">{meta.name}</h2>
        <p className="inspector-desc">{meta.description}</p>
      </div>

      {/* Slim Subservice Pill Bar (Backend Tier Only — replaces 4-box nested grid) */}
      {nodeId === "backend-service" && (
        <div className="subservice-pills" role="tablist" aria-label="Backend microservices">
          {(["orders", "payments", "gateway"] as BackendSub[]).map((svc) => (
            <button
              key={svc}
              type="button"
              role="tab"
              aria-selected={backendSub === svc}
              className={`subservice-pill mono ${backendSub === svc ? "active" : ""}`}
              onClick={() => setBackendSub(svc)}
            >
              {svc}-service
            </button>
          ))}
        </div>
      )}

      {/* Single Compact Inline Metrics Strip */}
      <div className="inspector-metrics-strip mono">
        <div>
          <span>Incidents</span>
          <strong>{matchingIncidents.length}</strong>
        </div>
        <div>
          <span>Signals</span>
          <strong>
            {caps ? `${caps.activeSignalsCount}/${caps.totalSignalsCount}` : "—"}
          </strong>
        </div>
        <div>
          <span>RAM Retained</span>
          <strong style={{ color: "var(--safe)" }}>0 B</strong>
        </div>
      </div>

      {/* Single Unified 3-Tab Control */}
      <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "incidents"}
          className={`inspector-tab ${tab === "incidents" ? "active" : ""}`}
          onClick={() => setTab("incidents")}
        >
          <ShieldCheck size={13} />
          <span>{nodeId === "git-sep" ? "Pre-Merge Gate" : "Incidents & Fixes"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "logs"}
          className={`inspector-tab ${tab === "logs" ? "active" : ""}`}
          onClick={() => setTab("logs")}
        >
          <Terminal size={13} />
          <span>Evidence</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "telemetry"}
          className={`inspector-tab ${tab === "telemetry" ? "active" : ""}`}
          onClick={() => setTab("telemetry")}
        >
          <Activity size={13} />
          <span>Telemetry</span>
        </button>
      </div>

      {/* Scrollable Tab Body */}
      <div className="inspector-body">
        {tab === "incidents" && nodeId === "git-sep" && (
          <div className="inspector-list">
            {scans.length === 0 ? (
              <div className="inspector-empty">No pre-merge security scans recorded yet.</div>
            ) : (
              scans.slice(0, 4).map((scan) => (
                <div key={scan.id} className="inspector-item">
                  <div className="inspector-item-top">
                    <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
                      {scan.branch} {scan.prNumber ? `· PR #${scan.prNumber}` : ""}
                    </span>
                    <span className={`badge mono ${scan.blocked ? "badge-critical" : "badge-safe"}`}>
                      {scan.blocked ? "BLOCKED" : "SAFE"}
                    </span>
                  </div>
                  <p className="inspector-item-text">{scan.githubCheckRun.title}</p>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                    {scan.githubCheckRun.summary}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "incidents" && nodeId !== "git-sep" && (
          <div className="inspector-list">
            {matchingIncidents.length === 0 ? (
              <div className="inspector-empty">
                No active incidents on this tier. Push-on-break hooks are listening.
              </div>
            ) : (
              matchingIncidents.slice(0, 4).map((inc) => (
                <div key={inc.id} className="inspector-item">
                  <div className="inspector-item-top">
                    <span className="mono" style={{ fontWeight: 600, fontSize: 12 }}>
                      {inc.id} · {inc.ruleId}
                    </span>
                    <span
                      className={`badge mono ${inc.status === "RESOLVED" ? "badge-safe" : "badge-ask"}`}
                    >
                      {inc.status === "RESOLVED" ? "Fixed" : inc.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{inc.title}</div>
                  <p className="inspector-item-text">{inc.diagnosisSummary}</p>
                  <div className="inspector-item-actions">
                    {inc.fixPrUrl && (
                      <a
                        href={inc.fixPrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        <ExternalLink size={12} />
                        <span>Fix PR #{inc.fixPrNumber}</span>
                      </a>
                    )}
                    <a
                      href={`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/report.md`}
                      className="btn btn-sm"
                    >
                      <Download size={12} />
                      <span>Report .md</span>
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onOpenPostmortem(inc.id)}
                    >
                      Postmortem
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "logs" && (
          <div className="inspector-list">
            {matchingIncidents.length > 0 && matchingIncidents[0].topFrame ? (
              <div className="inspector-item">
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                  Latest Scrubbed Stack Frame
                </div>
                <pre className="code-block" style={{ marginTop: 8, fontSize: 11.5 }}>
                  {`${matchingIncidents[0].topFrame.error}\n  at ${matchingIncidents[0].topFrame.function} (${matchingIncidents[0].topFrame.file}:${matchingIncidents[0].topFrame.line})`}
                </pre>
                {matchingIncidents[0].purgeReceipt && (
                  <div className="mono" style={{ fontSize: 11, color: "var(--safe)", marginTop: 8 }}>
                    Purged from RAM · 0 B retained · sha256:
                    {matchingIncidents[0].purgeReceipt.receiptHash.slice(0, 14)}
                  </div>
                )}
              </div>
            ) : (
              <div className="inspector-empty">
                Zero raw logs stored at rest. Scrubbed 6h bundles appear transiently in RAM only
                when a failure triggers.
              </div>
            )}
          </div>
        )}

        {tab === "telemetry" && (
          <div className="inspector-list">
            {caps && (
              <div className="signal-grid">
                {[
                  { label: "GitHub App", ok: caps.githubApp },
                  { label: "/health", ok: caps.healthEndpoint },
                  { label: "/metrics", ok: caps.prometheusMetrics },
                  { label: "/telemetry", ok: caps.jsonTelemetry },
                  { label: "Push Logs (6h)", ok: caps.pushLogsActive },
                  { label: "Pre-Merge Gate", ok: caps.sietchGate },
                ].map((s) => (
                  <div key={s.label} className={`signal-item mono ${s.ok ? "ok" : ""}`}>
                    <span className={`dot ${s.ok ? "dot-healthy" : "dot-degraded"}`} aria-hidden="true" />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <details className="inspector-details">
              <summary>
                <span>Push-on-break hook snippet</span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div style={{ paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                  <button type="button" className="btn btn-sm" onClick={handleCopy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="code-block" style={{ fontSize: 11 }}>
                  {pushSnippet}
                </pre>
              </div>
            </details>

            {project && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void handleRescan()}
                disabled={rescanning}
              >
                <RefreshCw size={12} className={rescanning ? "spin-icon" : ""} />
                <span>{rescanning ? "Scanning..." : "Re-Scan Signals"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
