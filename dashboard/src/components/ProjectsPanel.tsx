import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GitHubAppStatus, GitHubRepoOption, LinkedProject } from "@/types";

interface ImportProjectDialogProps {
  open: boolean;
  onClose: () => void;
  apiBase: string;
  projects: LinkedProject[];
  githubApp?: GitHubAppStatus;
  onProjectImported: (project: LinkedProject) => void;
}

export function ImportProjectDialog({
  open,
  onClose,
  apiBase,
  projects,
  githubApp,
  onProjectImported,
}: ImportProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [repos, setRepos] = useState<GitHubRepoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GitHubRepoOption | null>(null);
  const [deployedUrl, setDeployedUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/github/repos`);
      if (!resp.ok) throw new Error();
      const json = (await resp.json()) as { repos?: GitHubRepoOption[] };
      if (Array.isArray(json.repos)) setRepos(json.repos);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      void loadRepos();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, loadRepos]);

  const filtered = repos.filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || r.fullName.toLowerCase().includes(q);
  });

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setImporting(true);
    setFeedback(null);
    try {
      const resp = await fetch(`${apiBase}/api/projects/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: selected.owner,
          repoName: selected.name,
          defaultBranch: selected.defaultBranch,
          installationId: selected.installationId,
          deployedUrl: deployedUrl.trim() || undefined,
        }),
      });
      const json = (await resp.json()) as { project?: LinkedProject; error?: string };
      if (!resp.ok || !json.project) {
        setFeedback({ ok: false, msg: json.error || "Import failed." });
        return;
      }
      onProjectImported(json.project);
      setSelected(null);
      setDeployedUrl("");
      onClose();
    } catch {
      setFeedback({ ok: false, msg: "Could not reach backend." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(640px,calc(100dvw-2rem))] max-h-[85dvh] overflow-hidden rounded-2xl border border-[#EAE2D9] bg-white p-0 text-[#181614] shadow-2xl open:flex open:flex-col"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#EFE8E0] px-5 py-4">
        <div>
          <h2 id={titleId} className="text-[16px] font-semibold text-[#181614]">
            Import GitHub repository
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#665E56]">
            Select a repository accessible to the Patch-Up SRE GitHub App.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78716C] hover:bg-[#F4EFE9] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter repositories..."
              className="h-9 bg-white pl-8 text-[13px]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadRepos()}
            disabled={loading}
            className="h-9 border-[#E5DCD2] cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
          {githubApp?.installUrl && (
            <a
              href={githubApp.installUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E5DCD2] bg-white px-3 text-[12.5px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
            >
              <ExternalLink size={12} />
              <span>Configure App</span>
            </a>
          )}
        </div>

        <div className="divide-y divide-[#F0E9E1] overflow-hidden rounded-xl border border-[#EAE2D9]">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#78716C]">
              {loading
                ? "Loading repositories from GitHub..."
                : "No repositories found. Install or grant repository access in the Patch-Up GitHub App."}
            </div>
          ) : (
            filtered.map((repo) => {
              const linked = projects.some((p) => p.fullName === repo.fullName);
              return (
                <div
                  key={repo.fullName}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAF8F5]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-[#181614]">
                      <GitBranch size={13} className="text-[#78716C]" />
                      <span className="truncate">{repo.fullName}</span>
                      {repo.private && <Lock size={11} className="text-[#78716C]" />}
                    </div>
                    <div className="font-mono text-[11px] text-[#78716C]">
                      default: {repo.defaultBranch}
                    </div>
                  </div>

                  {linked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#15803D]">
                      <CheckCircle2 size={11} />
                      Connected
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelected(repo);
                        setFeedback(null);
                      }}
                      className="h-7 bg-[#FF5500] text-white hover:bg-[#E04B00] cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Import</span>
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {selected && (
          <form
            onSubmit={(e) => void handleImport(e)}
            className="space-y-3 rounded-xl border border-[#FBD3B7] bg-[#FFF5EE] p-4"
          >
            <div className="text-[13px] font-semibold text-[#181614]">
              Configure {selected.fullName}
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
                Deployed base URL (optional)
              </label>
              <Input
                value={deployedUrl}
                onChange={(e) => setDeployedUrl(e.target.value)}
                placeholder="https://my-app.vercel.app"
                className="h-9 bg-white font-mono text-[12.5px]"
              />
            </div>
            {feedback && (
              <div className="text-[12px] text-[#B91C1C]">{feedback.msg}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelected(null)}
                className="h-8 bg-white cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={importing}
                className="h-8 bg-[#FF5500] text-white hover:bg-[#E04B00] cursor-pointer"
              >
                {importing ? "Connecting & probing..." : "Connect repository"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
