import {
  Activity,
  CheckSquare,
  FileText,
  FolderKanban,
  Menu,
  Plug,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ActiveTab, LinkedProject, MonitoringMode, ScorecardMetrics } from "../types";

interface SidebarShellProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  scorecard: ScorecardMetrics;
  postmortemCount: number;
  connectedAppsCount: number;
  sseConnected: boolean;
  wsConnected: boolean;
  projects: LinkedProject[];
  activeProjectId: string;
  monitoringMode: MonitoringMode;
  onSelectProject: (projectId: string) => void;
  onOpenImportProject: () => void;
  onOpenPostmortems: () => void;
  children: ReactNode;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  projects: "Overview",
  incidents: "Incidents",
  sietch: "Sietch Shield",
  approvals: "Approvals",
  applications: "Connect & Simulate",
};

export function SidebarShell({
  activeTab,
  onSelectTab,
  scorecard,
  postmortemCount,
  connectedAppsCount,
  sseConnected,
  wsConnected,
  projects,
  activeProjectId,
  monitoringMode,
  onSelectProject,
  onOpenImportProject,
  onOpenPostmortems,
  children,
}: SidebarShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLive = wsConnected || sseConnected;

  function handleNav(tab: ActiveTab) {
    onSelectTab(tab);
    setMobileOpen(false);
  }

  return (
    <div className="workspace-frame">
      {mobileOpen && (
        <div
          className="sidebar-scrim"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <div className="brand-lockup">
            <span className="brand-logo-mark" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12.5L9.5 7L14.5 12L20 6.5M4 18L9.5 12.5L14.5 17.5L20 12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="brand-wordmark">Patch-Up</span>
          </div>
          <span className="brand-plan-tag">
            {monitoringMode === "push-ephemeral" ? "Zero-Retention" : monitoringMode}
          </span>
          {mobileOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <button
            type="button"
            className="nav-item"
            aria-current={activeTab === "projects" ? "page" : undefined}
            onClick={() => handleNav("projects")}
          >
            <span className="nav-item-left">
              <FolderKanban size={16} className="nav-icon" aria-hidden="true" />
              <span>Projects</span>
            </span>
            {activeTab === "projects" ? (
              <span className="nav-active-dot" aria-hidden="true" />
            ) : (
              <span className="nav-count">{projects.length}</span>
            )}
          </button>

          <button
            type="button"
            className="nav-item"
            aria-current={activeTab === "incidents" ? "page" : undefined}
            onClick={() => handleNav("incidents")}
          >
            <span className="nav-item-left">
              <Activity size={16} className="nav-icon" aria-hidden="true" />
              <span>Incidents</span>
            </span>
            <span className={`nav-count ${scorecard.incidentsTotal > 0 ? "nav-count-accent" : ""}`}>
              {scorecard.incidentsTotal}
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            aria-current={activeTab === "sietch" ? "page" : undefined}
            onClick={() => handleNav("sietch")}
          >
            <span className="nav-item-left">
              <ShieldCheck size={16} className="nav-icon" aria-hidden="true" />
              <span>Sietch Shield</span>
            </span>
            <span className={`nav-count ${scorecard.sietchPackagesBlocked > 0 ? "nav-count-danger" : ""}`}>
              {scorecard.sietchPackagesBlocked}
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            aria-current={activeTab === "approvals" ? "page" : undefined}
            onClick={() => handleNav("approvals")}
          >
            <span className="nav-item-left">
              <CheckSquare size={16} className="nav-icon" aria-hidden="true" />
              <span>Approvals</span>
            </span>
            <span className={`nav-count ${scorecard.pendingApprovals > 0 ? "nav-count-accent" : ""}`}>
              {scorecard.pendingApprovals}
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            aria-current={activeTab === "applications" ? "page" : undefined}
            onClick={() => handleNav("applications")}
          >
            <span className="nav-item-left">
              <Plug size={16} className="nav-icon" aria-hidden="true" />
              <span>Connect App</span>
            </span>
            <span className="nav-count">{connectedAppsCount}</span>
          </button>

          <div className="sidebar-divider" />

          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setMobileOpen(false);
              onOpenPostmortems();
            }}
          >
            <span className="nav-item-left">
              <FileText size={16} className="nav-icon" aria-hidden="true" />
              <span>Postmortems</span>
            </span>
            <span className="nav-count">{postmortemCount}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="live-status-row">
            <span className="status-dot-wrap">
              <span className={`dot ${isLive ? "dot-healthy" : "dot-warn"}`} aria-hidden="true" />
              <span>{isLive ? "Stream Live" : "Reconnecting"}</span>
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
              {wsConnected ? "WS" : sseConnected ? "SSE" : "HTTP"}
            </span>
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-muted)", padding: "0 4px", display: "flex", justifyContent: "space-between" }}
          >
            <span>PR-Only Guardrail</span>
            <span>0 B RAM</span>
          </div>
        </div>
      </aside>

      <div className="workspace-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={16} />
            </button>

            <select
              aria-label="Active Project"
              className="project-select mono"
              value={activeProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.fullName}
                </option>
              ))}
            </select>

            <span className="breadcrumb-sep" aria-hidden="true">
              /
            </span>
            <h1 className="topbar-title">{TAB_TITLES[activeTab]}</h1>
          </div>

          <div className="topbar-right">
            <button type="button" className="btn btn-primary" onClick={onOpenImportProject}>
              <Plus size={15} />
              <span>Add Project</span>
            </button>
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
