import {
  Activity,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ApprovalRequest,
  GitHubAppStatus,
  GitHubRepoOption,
  IncidentRecord,
  LinkedProject,
  ScorecardMetrics,
} from "../types";
import { NumberTicker, SpotlightCard } from "./craft/CraftPrimitives";

interface ProjectsOverviewViewProps {
  apiBase: string;
  projects: LinkedProject[];
  activeProject: LinkedProject | undefined;
  scorecard: ScorecardMetrics;
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  githubApp?: GitHubAppStatus;
  ephemeralTotalPurged: number;
  onSelectProject: (projectId: string) => void;
  onOpenImportDialog: () => void;
  onRescanSignals: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onNavigateIncidents: () => void;
  onNavigateApprovals: () => void;
}

type SnippetTab = "app" | "logstash" | "cloudwatch";

function formatTtd(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ProjectsOverviewView({
  apiBase,
  projects,
  activeProject,
  scorecard,
  incidents,
  approvals,
  githubApp,
  ephemeralTotalPurged,
  onSelectProject,
  onOpenImportDialog,
  onRescanSignals,
  onDeleteProject,
  onNavigateIncidents,
  onNavigateApprovals,
}: ProjectsOverviewViewProps) {
  const [search, setSearch] = useState("");
  const [detectedRepos, setDetectedRepos] = useState<GitHubRepoOption[]>([]);
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("app");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/github/repos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { repos?: GitHubRepoOption[] } | null) => {
        if (!cancelled && json && Array.isArray(json.repos)) {
          setDetectedRepos(json.repos);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiBase, githubApp?.installations.length]);

  const filteredProjects = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      (p.deployedUrl ?? "").toLowerCase().includes(q)
    );
  });

  const caps = activeProject?.capabilities;
  const pendingApprovals = approvals.filter((a) => a.status === "PENDING");
  const speedup = Math.max(1, Math.round(scorecard.manualBaselineMs / Math.max(scorecard.meanTtdMs, 1000)));
  const unlinkedRepoCount = detectedRepos.filter(
    (r) => !projects.some((p) => p.fullName === r.fullName),
  ).length;

  const webhookBase = apiBase || "https://patch-up-backend.onrender.com";
  const snippets: Record<SnippetTab, { label: string; code: string }> = {
    app: {
      label: "Node / Express",
      code: `// Set PATCHUP_WEBHOOK_URL=${webhookBase}
if (process.env.PATCHUP_WEBHOOK_URL) {
  fetch(\`\${process.env.PATCHUP_WEBHOOK_URL}/api/webhooks/incident-bundle\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: "${activeProject?.fullName ?? "Soham-1304/pulseshop"}",
      serviceId: "${activeProject?.repoName ?? "pulseshop"}-service",
      rule: "ERR_5XX_SPIKE",
      windowHours: 6,
      logs: recentLogs,
    }),
  }).catch(() => {});
}`,
    },
    logstash: {
      label: "Logstash",
      code: `output {
  if [level] == "error" {
    http {
      url => "${webhookBase}/api/webhooks/incident-bundle"
      http_method => "post"
      format => "json"
      content_type => "application/json"
    }
  }
}`,
    },
    cloudwatch: {
      label: "CloudWatch SNS",
      code: `aws sns subscribe \\
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:prod-alarms \\
  --protocol https \\
  --notification-endpoint ${webhookBase}/api/webhooks/cloudwatch`,
    },
  };

  async function handleRescan(id: string) {
    setRescanningId(id);
    try {
      await onRescanSignals(id);
    } finally {
      setRescanningId(null);
    }
  }

  function handleCopySnippet() {
    navigator.clipboard?.writeText(snippets[snippetTab].code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div>
      {/* Clean Vercel-Style Search + Action Row */}
      <div className="search-toolbar">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Projects..."
            aria-label="Search Projects"
          />
        </div>
        {githubApp?.installUrl && (
          <a
            href={githubApp.installUrl}
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            <ExternalLink size={14} />
            <span>GitHub App</span>
          </a>
        )}
        <button type="button" className="btn btn-primary" onClick={onOpenImportDialog}>
          <Plus size={15} />
          <span>Import Repository</span>
        </button>
      </div>

      {/* Two-Column Calm Overview Layout (Left Rail + Projects Grid) */}
      <div className="vercel-overview-grid">
        {/* Left Column: Telemetry Summary + Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <section aria-label="Telemetry and Privacy Summary">
            <h2 className="section-heading">Telemetry &amp; Privacy</h2>
            <div className="surface-card">
              <div className="usage-list">
                <div className="usage-row">
                  <span className="usage-row-label">
                    <Clock size={14} color="var(--accent)" aria-hidden="true" />
                    <span>Mean Diagnosis</span>
                  </span>
                  <span className="usage-row-value">
                    <NumberTicker
                      value={Number((scorecard.meanTtdMs / 1000).toFixed(1))}
                      decimals={1}
                      suffix="s"
                    />{" "}
                    <span style={{ color: "var(--safe)", fontWeight: 500 }}>({speedup}x)</span>
                  </span>
                </div>
                <div className="usage-row">
                  <span className="usage-row-label">
                    <Activity size={14} color="var(--ink-muted)" aria-hidden="true" />
                    <span>Active Signals</span>
                  </span>
                  <span className="usage-row-value">
                    {caps ? `${caps.activeSignalsCount} / ${caps.totalSignalsCount}` : "—"}
                  </span>
                </div>
                <div className="usage-row">
                  <span className="usage-row-label">
                    <GitBranch size={14} color="var(--ink-muted)" aria-hidden="true" />
                    <span>Fix PRs Opened</span>
                  </span>
                  <span className="usage-row-value">
                    <NumberTicker value={scorecard.fixPrsOpened} />
                  </span>
                </div>
                <div className="usage-row">
                  <span className="usage-row-label">
                    <ShieldCheck size={14} color="var(--ink-muted)" aria-hidden="true" />
                    <span>Pre-Merge PRs Blocked</span>
                  </span>
                  <span className="usage-row-value">
                    <NumberTicker value={scorecard.sietchPackagesBlocked} />
                  </span>
                </div>
                <div className="usage-row">
                  <span className="usage-row-label">
                    <span>RAM Retained</span>
                  </span>
                  <span className="usage-row-value" style={{ color: "var(--safe)" }}>
                    0 B ({ephemeralTotalPurged} purged)
                  </span>
                </div>
              </div>

              {activeProject && caps && (
                <details className="telemetry-details">
                  <summary>
                    <span>
                      Signals &amp; push setup ({caps.activeSignalsCount}/{caps.totalSignalsCount})
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <div className="telemetry-details-body">
                    <div className="signal-grid">
                      {[
                        { label: "GitHub App", ok: caps.githubApp },
                        { label: "/health", ok: caps.healthEndpoint },
                        { label: "/metrics", ok: caps.prometheusMetrics },
                        { label: "/api/telemetry", ok: caps.jsonTelemetry },
                        { label: "Push Logs (6h)", ok: caps.pushLogsActive },
                        { label: "Pre-Merge Gate", ok: caps.sietchGate },
                      ].map((s) => (
                        <div key={s.label} className={`signal-item mono ${s.ok ? "ok" : ""}`}>
                          <span className={`dot ${s.ok ? "dot-healthy" : "dot-degraded"}`} aria-hidden="true" />
                          <span>{s.label}</span>
                        </div>
                      ))}
                    </div>

                    {caps.warnings.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {caps.warnings.map((w, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: "var(--ink-secondary)", lineHeight: 1.45 }}>
                            • {w}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="snippet-tabs">
                        {(["app", "logstash", "cloudwatch"] as SnippetTab[]).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            className={`snippet-tab ${snippetTab === tab ? "active" : ""}`}
                            onClick={() => setSnippetTab(tab)}
                          >
                            {snippets[tab].label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginLeft: "auto" }}
                          onClick={handleCopySnippet}
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <pre className="code-block" style={{ fontSize: 11.5 }}>
                        {snippets[snippetTab].code}
                      </pre>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handleRescan(activeProject.id)}
                      disabled={rescanningId === activeProject.id}
                    >
                      <RefreshCw size={12} className={rescanningId === activeProject.id ? "spin-icon" : ""} />
                      <span>{rescanningId === activeProject.id ? "Scanning..." : "Re-Scan Signals"}</span>
                    </button>
                  </div>
                </details>
              )}
            </div>
          </section>

          <section aria-label="Recent Alerts and Approvals">
            <h2 className="section-heading">Alerts &amp; Approvals</h2>
            <div className="surface-card">
              {pendingApprovals.length > 0 || incidents.length > 0 ? (
                <div className="alerts-list">
                  {pendingApprovals.slice(0, 2).map((appr) => (
                    <button
                      key={appr.id}
                      type="button"
                      className="alert-row-btn"
                      onClick={onNavigateApprovals}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>
                          {appr.actionTitle}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                          Awaiting 1-tap approval · {appr.target}
                        </div>
                      </div>
                      <span className="badge badge-accent">Review</span>
                    </button>
                  ))}

                  {incidents.slice(0, 3).map((inc) => (
                    <button
                      key={inc.id}
                      type="button"
                      className="alert-row-btn"
                      onClick={onNavigateIncidents}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-primary)" }}>
                          {inc.title}
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>
                          {inc.service} · {inc.ruleId} · TTD {formatTtd(inc.timeToDiagnosisMs)}
                        </div>
                      </div>
                      <span
                        className={`badge ${inc.status === "RESOLVED" ? "badge-safe" : "badge-critical"}`}
                      >
                        {inc.status === "RESOLVED" ? "Fixed" : inc.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="alert-empty">
                  <Bell size={18} color="var(--ink-muted)" aria-hidden="true" />
                  <span>No active incidents. Push telemetry triggers instant diagnosis.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Clean 2-Col Projects Grid */}
        <section aria-label="Connected Projects">
          <h2 className="section-heading">Projects</h2>
          <div className="project-cards-grid">
            {/* Inline Import Prompt Card (Vercel Style) */}
            <div className="project-card project-card-import">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="project-avatar">
                  <FolderGit2 size={17} />
                </div>
                <div>
                  <h3 className="project-name">
                    {detectedRepos.length > 0
                      ? `${unlinkedRepoCount > 0 ? unlinkedRepoCount : detectedRepos.length} ${
                          (unlinkedRepoCount || detectedRepos.length) === 1 ? "repository" : "repositories"
                        } available`
                      : "Import from GitHub"}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--ink-secondary)" }}>
                    {githubApp?.installations && githubApp.installations.length > 0
                      ? `Connected via Patch-Up SRE (${githubApp.installations[0].accountLogin})`
                      : "Select a GitHub repository to enable PR-only fixes & pre-merge security checks."}
                  </p>
                </div>
              </div>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={onOpenImportDialog}>
                <Plus size={15} />
                <span>Import Repository</span>
              </button>
            </div>

            {/* Linked Project Cards */}
            {filteredProjects.map((proj) => {
              const isSelected = activeProject?.id === proj.id;
              const sigRatio = `${proj.capabilities.activeSignalsCount}/${proj.capabilities.totalSignalsCount}`;
              const cleanHost = proj.deployedUrl
                ? proj.deployedUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")
                : "Push-only telemetry";

              return (
                <SpotlightCard
                  key={proj.id}
                  className={`project-card ${isSelected ? "active" : ""}`}
                >
                  <div className="project-card-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                      <div className="project-avatar">
                        {proj.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="project-name">{proj.name}</h3>
                        {proj.deployedUrl ? (
                          <a
                            href={proj.deployedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="project-domain"
                          >
                            {cleanHost}
                          </a>
                        ) : (
                          <span className="project-domain">{cleanHost}</span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`badge mono ${
                        proj.capabilities.accuracyLevel === "HIGH"
                          ? "badge-safe"
                          : proj.capabilities.accuracyLevel === "MEDIUM"
                            ? "badge-ask"
                            : "badge-muted"
                      }`}
                    >
                      <span
                        className={`dot ${
                          proj.capabilities.accuracyLevel === "HIGH"
                            ? "dot-healthy"
                            : proj.capabilities.accuracyLevel === "MEDIUM"
                              ? "dot-warn"
                              : "dot-degraded"
                        }`}
                        aria-hidden="true"
                      />
                      {sigRatio}
                    </span>
                  </div>

                  <div className="project-repo-pill mono">
                    <GitBranch size={12} color="var(--ink-muted)" aria-hidden="true" />
                    <span>{proj.fullName}</span>
                    <span style={{ color: "var(--ink-muted)" }}>· {proj.defaultBranch}</span>
                  </div>

                  <div className="project-card-foot">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          onSelectProject(proj.id);
                          onNavigateIncidents();
                        }}
                      >
                        <span>Incidents</span>
                        <ArrowUpRight size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Re-Scan Telemetry Signals"
                        disabled={rescanningId === proj.id}
                        onClick={() => void handleRescan(proj.id)}
                      >
                        <RefreshCw size={13} className={rescanningId === proj.id ? "spin-icon" : ""} />
                      </button>
                    </div>

                    {proj.id !== "pulseshop" ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Remove Project"
                        onClick={() => void onDeleteProject(proj.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <span className="mono" style={{ fontSize: 11.5 }}>
                        {isSelected ? "Active" : "Default"}
                      </span>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
