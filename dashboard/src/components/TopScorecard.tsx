import {
  Activity,
  FileText,
  FolderGit2,
  Globe,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { ActiveTab, LinkedProject, MonitoringMode, ScorecardMetrics, TargetOverview } from "../types";

interface TopScorecardProps {
  target: TargetOverview;
  scorecard: ScorecardMetrics;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenPostmortems: () => void;
  postmortemCount: number;
  connectedAppsCount: number;
  sseConnected: boolean;
  wsConnected: boolean;
  projects: LinkedProject[];
  activeProjectId: string;
  monitoringMode: MonitoringMode;
  onSelectProject: (projectId: string) => void;
  onOpenImportProject: () => void;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${mins}m ${String(rem).padStart(2, "0")}s`;
}

export function TopScorecard({
  target,
  scorecard,
  activeTab,
  onSelectTab,
  onOpenPostmortems,
  postmortemCount,
  connectedAppsCount,
  sseConnected,
  wsConnected,
  projects,
  activeProjectId,
  monitoringMode,
  onSelectProject,
  onOpenImportProject,
}: TopScorecardProps) {
  const speedup = Math.max(1, Math.round(scorecard.manualBaselineMs / Math.max(1, scorecard.meanTtdMs)));
  const isLive = sseConnected || wsConnected;
  const transportLabel =
    sseConnected && wsConnected
      ? "SSE + WS LIVE"
      : sseConnected
        ? "SSE LIVE :5050"
        : wsConnected
          ? "WS LIVE :5050"
          : "SNAPSHOT MODE";

  return (
    <header className="top-strip">
      <div className="top-row">
        <div className="brand-group">
          <div className="brand-mark">
            <div className="brand-icon" aria-hidden="true">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h1 className="brand-title">AEGIS // SRE AGENT + SIETCH</h1>
              <div className="brand-sub">Deterministic Detection · On-Demand Diagnosis · Pre-Merge Supply-Chain Gate</div>
            </div>
          </div>

          <div className="project-switcher" aria-label="Active Linked Project">
            <FolderGit2 size={14} color="#22d3ee" />
            <select
              className="project-select mono"
              aria-label="Select Linked Project"
              value={activeProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
            >
              {projects.length > 0 ? (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))
              ) : (
                <option value="pulseshop">Soham-1304/pulseshop</option>
              )}
            </select>
            <button
              type="button"
              className="btn-import-repo"
              onClick={onOpenImportProject}
            >
              <Plus size={13} />
              <span>Import Repo</span>
            </button>
            <span className="badge badge-cyan mono" title="Zero-Retention Push-Based Mode">
              {monitoringMode.toUpperCase()}
            </span>
          </div>

          <div className="target-strip" aria-label="Protected Target Status">
            <span className="target-label">Target: {target.name}</span>
            <div className="service-dot-list">
              {target.services.map((svc) => (
                <span key={svc.name} className="service-pill mono">
                  <span
                    className={`dot ${svc.status === "healthy" ? "dot-healthy" : "dot-degraded"}`}
                    aria-hidden="true"
                  />
                  {svc.name}:{svc.port}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="release-meta">
          <div className="canary-widget mono" title="Nginx Canary Split">
            <span>{target.activeRelease}</span>
            <span>|</span>
            <span>
              {target.canarySplit.stable}/{target.canarySplit.canary} Canary
            </span>
            <div className="canary-bar" aria-hidden="true">
              <div className="canary-stable" style={{ width: `${target.canarySplit.stable}%` }} />
              <div className="canary-new" style={{ width: `${target.canarySplit.canary}%` }} />
            </div>
          </div>

          <div className="sse-pill mono" title="Dual Live Transport (SSE + WebSocket)">
            <span className={`dot ${isLive ? "dot-live" : "dot-degraded"}`} aria-hidden="true" />
            {transportLabel}
          </div>

          <button type="button" className="btn-drawer" onClick={onOpenPostmortems}>
            <FileText size={15} />
            <span>Postmortems</span>
            <span className="tab-count mono">{postmortemCount}</span>
          </button>
        </div>
      </div>

      {/* Live Scorecard Strip */}
      <div className="scorecard-row">
        <div className="kpi-cell">
          <span className="kpi-label">
            <span>Mean Time-to-Diagnosis (TTD) vs. 18m Manual Baseline</span>
            <Activity size={14} color="#22d3ee" />
          </span>
          <div className="kpi-value-row">
            <span className="kpi-value accent-cyan mono">{formatDurationMs(scorecard.meanTtdMs)}</span>
            <span className="kpi-sub mono">vs {formatDurationMs(scorecard.manualBaselineMs)}</span>
            <span className="speedup-tag mono">{speedup}x faster</span>
          </div>
        </div>

        <button type="button" className="kpi-cell" onClick={() => onSelectTab("incidents")}>
          <span className="kpi-label">Incidents Handled</span>
          <div className="kpi-value-row">
            <span className="kpi-value mono">{scorecard.incidentsTotal}</span>
            <span className="kpi-sub">Deterministic Watcher</span>
          </div>
        </button>

        <button type="button" className="kpi-cell" onClick={() => onSelectTab("incidents")}>
          <span className="kpi-label">Fix PRs Opened</span>
          <div className="kpi-value-row">
            <span className="kpi-value accent-emerald mono">{scorecard.fixPrsOpened}</span>
            <span className="kpi-sub">Test-Verified Patches</span>
          </div>
        </button>

        <button type="button" className="kpi-cell" onClick={() => onSelectTab("sietch")}>
          <span className="kpi-label">Sietch PRs Blocked</span>
          <div className="kpi-value-row">
            <span className="kpi-value accent-red mono">{scorecard.sietchPackagesBlocked}</span>
            <span className="kpi-sub">3-Layer Shield</span>
          </div>
        </button>

        <button type="button" className="kpi-cell" onClick={() => onSelectTab("approvals")}>
          <span className="kpi-label">Pending Approvals</span>
          <div className="kpi-value-row">
            <span className="kpi-value accent-amber mono">{scorecard.pendingApprovals}</span>
            <span className="kpi-sub">ASK_FIRST Queue</span>
          </div>
        </button>
      </div>

      {/* Core View Tabs */}
      <nav className="view-tabs" aria-label="Command Views">
        <button
          type="button"
          className={`tab-btn ${activeTab === "incidents" ? "active" : ""}`}
          onClick={() => onSelectTab("incidents")}
        >
          <Terminal size={15} />
          <span>1. Live Incident Timeline &amp; Evidence</span>
          <span className="tab-count mono">{scorecard.incidentsTotal}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => onSelectTab("approvals")}
        >
          <Wrench size={15} />
          <span>2. Tiered Permissions &amp; 1-Tap Approvals</span>
          <span className={`tab-count mono ${scorecard.pendingApprovals > 0 ? "warn" : ""}`}>
            {scorecard.pendingApprovals}
          </span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "sietch" ? "active" : ""}`}
          onClick={() => onSelectTab("sietch")}
        >
          <ShieldAlert size={15} />
          <span>3. Sietch Preventive Suite &amp; Detonation Chamber</span>
          <span className={`tab-count mono ${scorecard.sietchPackagesBlocked > 0 ? "alert" : ""}`}>
            {scorecard.sietchPackagesBlocked} BLOCKED
          </span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "applications" ? "active" : ""}`}
          onClick={() => onSelectTab("applications")}
        >
          <Globe size={15} />
          <span>4. Connect App &amp; Fault Simulator</span>
          <span className="tab-count mono">{connectedAppsCount}</span>
        </button>
      </nav>
    </header>
  );
}
