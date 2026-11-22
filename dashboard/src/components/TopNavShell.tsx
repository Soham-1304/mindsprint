import { FileText, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { ActiveTab, LinkedProject, ScorecardMetrics } from "../types";
import { PatchUpWordmark } from "./craft/CraftPrimitives";

interface TopNavShellProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  scorecard: ScorecardMetrics;
  postmortemCount: number;
  sseConnected: boolean;
  wsConnected: boolean;
  projects: LinkedProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenImportProject: () => void;
  onOpenPostmortems: () => void;
  children: ReactNode;
}

export function TopNavShell({
  activeTab,
  onSelectTab,
  scorecard,
  postmortemCount,
  sseConnected,
  wsConnected,
  projects,
  activeProjectId,
  onSelectProject,
  onOpenImportProject,
  onOpenPostmortems,
  children,
}: TopNavShellProps) {
  const isLive = wsConnected || sseConnected;

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <button
            type="button"
            className="wordmark-btn"
            onClick={() => onSelectTab("studio")}
            aria-label="PatchUP Studio Home"
          >
            <PatchUpWordmark compact />
          </button>

          <span className="breadcrumb-sep" aria-hidden="true">
            /
          </span>

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
        </div>

        <nav className="studio-nav-pills" aria-label="Primary">
          <button
            type="button"
            className="studio-nav-link"
            aria-current={activeTab === "studio" ? "page" : undefined}
            onClick={() => onSelectTab("studio")}
          >
            Studio
          </button>
          <button
            type="button"
            className="studio-nav-link"
            aria-current={activeTab === "projects" ? "page" : undefined}
            onClick={() => onSelectTab("projects")}
          >
            Projects
            <span className="studio-nav-count mono">{projects.length}</span>
          </button>
          <button
            type="button"
            className="studio-nav-link"
            aria-current={activeTab === "security" ? "page" : undefined}
            onClick={() => onSelectTab("security")}
          >
            Approvals &amp; Gate
            {scorecard.pendingApprovals > 0 && (
              <span className="studio-nav-count accent mono">{scorecard.pendingApprovals}</span>
            )}
          </button>
        </nav>

        <div className="studio-topbar-right">
          <span className="live-pill mono" title={isLive ? "Live WebSocket stream connected" : "Reconnecting"}>
            <span className={`dot ${isLive ? "dot-healthy" : "dot-warn"}`} aria-hidden="true" />
            <span>{isLive ? "Live" : "Sync"}</span>
          </span>

          <button
            type="button"
            className="btn btn-sm"
            onClick={onOpenPostmortems}
            title="Postmortems"
          >
            <FileText size={13} />
            <span className="hide-sm">Reports</span>
            <span className="mono" style={{ color: "var(--ink-muted)" }}>
              {postmortemCount}
            </span>
          </button>

          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenImportProject}>
            <Plus size={14} />
            <span>Import Repo</span>
          </button>
        </div>
      </header>

      <main className={activeTab === "studio" ? "studio-main-flush" : "main-content"}>
        {children}
      </main>
    </div>
  );
}
