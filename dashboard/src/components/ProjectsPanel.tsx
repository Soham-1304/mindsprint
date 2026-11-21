import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  githubApp,
  onProjectImported,
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
      // Fallback
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <Search size={14} className="search-icon" aria-hidden="true" />
          <input
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GitHub repositories..."
          />
        </div>
        <button type="button" className="btn" onClick={() => void loadRepos()} disabled={loadingRepos}>
          <RefreshCw size={13} className={loadingRepos ? "spin-icon" : ""} />
          <span>Refresh</span>
        </button>
        <button type="button" className="btn btn-soft-orange" onClick={handleInstallGitHubApp}>
          <ExternalLink size={13} />
          <span>Configure App</span>
        </button>
      </div>

      {feedback && (
        <div className={feedback.ok ? "feedback-ok" : "feedback-err"}>{feedback.message}</div>
      )}

      {selectedRepo && (
        <div className="import-config-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderGit2 size={15} color="var(--accent)" />
              <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                {selectedRepo.fullName}
              </span>
              <span className="badge badge-muted mono">
                <GitBranch size={11} />
                {selectedRepo.defaultBranch}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Cancel selection"
              onClick={() => setSelectedRepo(null)}
            >
              <X size={14} />
            </button>
          </div>

          <div className="form-grid" style={{ marginTop: 12 }}>
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button type="button" className="btn btn-sm" onClick={() => setSelectedRepo(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={importing}
              onClick={() => void handleImportSubmit(selectedRepo)}
            >
              <Plus size={14} />
              <span>{importing ? "Importing..." : "Import Project"}</span>
            </button>
          </div>
        </div>
      )}

      <div className="repo-picker-list">
        {filteredRepos.map((repo) => {
          const alreadyLinked = projects.some((p) => p.fullName === repo.fullName);
          return (
            <div key={repo.id} className="repo-picker-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <FolderGit2 size={16} color="var(--ink-muted)" aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                      {repo.fullName}
                    </span>
                    {repo.private && (
                      <span className="badge badge-muted mono">
                        <Lock size={10} />
                        Private
                      </span>
                    )}
                    <span className="badge badge-muted mono">{repo.defaultBranch}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={alreadyLinked ? "btn btn-sm" : "btn btn-primary btn-sm"}
                onClick={() => setSelectedRepo(repo)}
              >
                {alreadyLinked ? (
                  <>
                    <CheckCircle2 size={13} color="var(--safe)" />
                    <span>Configure</span>
                  </>
                ) : (
                  <span>Import</span>
                )}
              </button>
            </div>
          );
        })}

        {filteredRepos.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-muted)", fontSize: 13 }}>
            No matching repositories found. Click <strong>Configure App</strong> to grant repository access.
          </div>
        )}
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
  const headingId = useId();

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
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        const rect = dialogRef.current?.getBoundingClientRect();
        if (
          rect &&
          (e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom)
        ) {
          onClose();
        }
      }}
    >
      <div className="import-dialog-head">
        <div>
          <h2 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Import Git Repository
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--ink-secondary)" }}>
            Select a repository to enable Sietch pre-merge checks and zero-retention fix PRs.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          aria-label="Close import dialog"
          autoFocus
        >
          <X size={16} />
        </button>
      </div>
      <div className="import-dialog-body">
        <ProjectsPanel {...panelProps} onCloseModal={onClose} />
      </div>
    </dialog>
  );
}
