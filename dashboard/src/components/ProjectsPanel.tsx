import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitHubAppStatus, GitHubRepoOption, LinkedProject } from "../types";

interface ProjectsPanelProps {
  apiBase: string;
  projects: LinkedProject[];
  activeProjectId: string;
  githubApp?: GitHubAppStatus;
  onSelectProject: (projectId: string) => void;
  onProjectImported: (project: LinkedProject) => void;
  onRescanSignals: (projectId: string) => Promise<void>;
  onDeleteProject?: (projectId: string) => Promise<void>;
  onCloseModal?: () => void;
}

export function ProjectsPanel({
  apiBase,
  projects,
  activeProjectId,
  githubApp,
  onSelectProject,
  onProjectImported,
  onRescanSignals,
  onDeleteProject,
  onCloseModal,
}: ProjectsPanelProps) {
  const [repos, setRepos] = useState<GitHubRepoOption[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoOption | null>(null);
  const [deployedUrl, setDeployedUrl] = useState("");
  const [prometheusUrl, setPrometheusUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const resp = await fetch(`${apiBase}/api/github/repos`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { repos?: GitHubRepoOption[] };
      if (Array.isArray(json.repos)) {
        setRepos(json.repos);
      }
    } catch {
      setRepos([
        {
          id: 1,
          owner: "Soham-1304",
          name: "pulseshop",
          fullName: "Soham-1304/pulseshop",
          defaultBranch: "main",
          private: false,
          htmlUrl: "https://github.com/Soham-1304/pulseshop",
        },
      ]);
    } finally {
      setLoadingRepos(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  async function handleInstallGitHubApp() {
    try {
      const resp = await fetch(`${apiBase}/api/github/install`, {
        headers: { Accept: "application/json" },
      });
      if (resp.ok) {
        const json = (await resp.json()) as { installUrl?: string };
        if (json.installUrl) {
          window.open(json.installUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
    } catch {
      // Fallback to status installUrl
    }
    if (githubApp?.installUrl) {
      window.open(githubApp.installUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open(`${apiBase}/api/github/install`, "_blank", "noopener,noreferrer");
    }
  }

  async function handleImportSubmit(repo: GitHubRepoOption) {
    setImporting(true);
    setFeedback(null);
    try {
      const resp = await fetch(`${apiBase}/api/projects/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: repo.owner,
          repoName: repo.name,
          defaultBranch: repo.defaultBranch || "main",
          installationId: repo.installationId,
          deployedUrl: deployedUrl.trim() || undefined,
          prometheusUrl: prometheusUrl.trim() || undefined,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        project?: LinkedProject;
        error?: string;
        message?: string;
      };
      if (!resp.ok || !json.project) {
        setFeedback({ ok: false, message: json.error ?? `Import failed (HTTP ${resp.status})` });
        return;
      }
      setFeedback({
        ok: true,
        message: `Imported ${json.project.fullName} (${json.project.capabilities.activeSignalsCount}/${json.project.capabilities.totalSignalsCount} signals active).`,
      });
      setSelectedRepo(null);
      setDeployedUrl("");
      setPrometheusUrl("");
      onProjectImported(json.project);
      onCloseModal?.();
    } catch {
      setFeedback({ ok: false, message: "Backend offline — could not import repository." });
    } finally {
      setImporting(false);
    }
  }

  const filteredRepos = repos.filter((r) =>
    r.fullName.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="projects-panel-grid">
      {/* Left: Import GitHub Repository (Vercel-Style) */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <FolderGit2 size={15} color="#22d3ee" />
            <span>Import GitHub Repository</span>
          </h3>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={handleInstallGitHubApp}
          >
            <ExternalLink size={13} />
            <span>Install Patch-Up GitHub App</span>
          </button>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="repo-search-row">
            <div className="repo-search-input-wrap">
              <Search size={14} color="#64748b" />
              <input
                className="form-input"
                style={{ paddingLeft: 32 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accessible GitHub repositories..."
              />
            </div>
            <button type="button" className="btn" onClick={() => void loadRepos()} disabled={loadingRepos}>
              <RefreshCw size={13} className={loadingRepos ? "spin-icon" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {feedback && (
            <div className={feedback.ok ? "feedback-ok" : "feedback-err"} style={{ fontSize: 12 }}>
              {feedback.message}
            </div>
          )}

          {selectedRepo && (
            <div className="import-config-card">
              <div className="import-config-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderGit2 size={14} color="#22d3ee" />
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {selectedRepo.fullName}
                  </span>
                  <span className="badge badge-muted mono">
                    <GitBranch size={11} />
                    {selectedRepo.defaultBranch}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => setSelectedRepo(null)}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="form-field">
                  <span className="form-label">Deployed URL (optional)</span>
                  <input
                    className="form-input mono"
                    value={deployedUrl}
                    onChange={(e) => setDeployedUrl(e.target.value)}
                    placeholder="https://my-app.vercel.app"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Prometheus / Metrics URL (optional)</span>
                  <input
                    className="form-input mono"
                    value={prometheusUrl}
                    onChange={(e) => setPrometheusUrl(e.target.value)}
                    placeholder="https://my-app.vercel.app/metrics"
                  />
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={importing}
                  onClick={() => void handleImportSubmit(selectedRepo)}
                >
                  <Plus size={14} />
                  <span>{importing ? "Probing & Importing..." : "Import & Probe Signals"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="repo-picker-list">
            {filteredRepos.map((repo) => {
              const alreadyLinked = projects.some((p) => p.fullName === repo.fullName);
              return (
                <div key={repo.id} className="repo-picker-card">
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                        {repo.fullName}
                      </span>
                      {repo.private && (
                        <span className="badge badge-muted mono">
                          <Lock size={11} />
                          Private
                        </span>
                      )}
                      <span className="badge badge-muted mono">{repo.defaultBranch}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 12, color: "#64748b" }}>
                      {repo.htmlUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={alreadyLinked ? "btn" : "btn btn-primary"}
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    onClick={() => setSelectedRepo(repo)}
                  >
                    {alreadyLinked ? (
                      <>
                        <CheckCircle2 size={13} color="#10b981" />
                        <span>Linked (Configure)</span>
                      </>
                    ) : (
                      <span>Import</span>
                    )}
                  </button>
                </div>
              );
            })}
            {filteredRepos.length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>
                No matching repositories found. Click "Install Patch-Up GitHub App" to grant access.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Linked Projects */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Linked Projects ({projects.length})</h3>
          <span className="badge badge-cyan mono">SQLite + Push</span>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <div
                key={proj.id}
                className={`linked-project-card ${isActive ? "active" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                        {proj.fullName}
                      </span>
                      {isActive && <span className="badge badge-safe mono">ACTIVE</span>}
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {proj.capabilities.activeSignalsCount}/{proj.capabilities.totalSignalsCount} signals ·{" "}
                      {proj.capabilities.accuracyLevel} accuracy
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!isActive && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => {
                          onSelectProject(proj.id);
                          onCloseModal?.();
                        }}
                      >
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "5px 9px", fontSize: 12 }}
                      onClick={() => void onRescanSignals(proj.id)}
                      title="Re-Scan Signals"
                    >
                      <RefreshCw size={12} />
                    </button>
                    {onDeleteProject && proj.id !== "pulseshop" && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: "5px 9px", fontSize: 12 }}
                        onClick={() => void onDeleteProject(proj.id)}
                        title="Remove Project"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ImportProjectDialogProps extends ProjectsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ImportProjectDialog({ open, onClose, ...panelProps }: ImportProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="import-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="import-dialog-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Patch-Up Project Onboarding (GitHub App + Push Telemetry)
          </h2>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Connect a GitHub repository, probe live endpoints, and configure zero-retention push hooks.
          </div>
        </div>
        <button type="button" className="btn" onClick={onClose} aria-label="Close modal">
          <X size={15} />
          <span>Close</span>
        </button>
      </div>
      <div className="import-dialog-body">
        <ProjectsPanel {...panelProps} onCloseModal={onClose} />
      </div>
    </dialog>
  );
}
