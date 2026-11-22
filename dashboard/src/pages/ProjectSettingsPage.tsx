import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditLogEntry, LinkedProject } from "@/types";

interface ProjectSettingsPageProps {
  project: LinkedProject;
  auditLog: AuditLogEntry[];
  apiBase: string;
  onProjectUpdated: () => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export function ProjectSettingsPage({
  project,
  auditLog,
  apiBase,
  onProjectUpdated,
  onDeleteProject,
}: ProjectSettingsPageProps) {
  const [deployedUrl, setDeployedUrl] = useState(project.deployedUrl ?? "");
  const [defaultBranch, setDefaultBranch] = useState(project.defaultBranch);
  const [healthEndpoint, setHealthEndpoint] = useState(project.healthEndpoint ?? "/api/health");
  const [metricsEndpoint, setMetricsEndpoint] = useState(project.metricsEndpoint ?? "/metrics");
  const [telemetryEndpoint, setTelemetryEndpoint] = useState(
    project.telemetryEndpoint ?? "/api/telemetry",
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const resp = await fetch(
        `${apiBase}/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deployedUrl,
            defaultBranch,
            healthEndpoint,
            metricsEndpoint,
            telemetryEndpoint,
          }),
        },
      );
      if (!resp.ok) {
        const j = (await resp.json().catch(() => ({}))) as { error?: string };
        setError(j.error || "Failed to save settings.");
        return;
      }
      await onProjectUpdated();
      setSavedNotice("Settings saved and endpoints re-probed.");
    } catch {
      setError("Could not reach backend to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Repository & Endpoint Settings */}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)] space-y-4"
      >
        <div>
          <h3 className="text-[14.5px] font-semibold text-[#181614]">
            Repository &amp; probe endpoints
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[#665E56]">
            Connected to <span className="font-mono text-[#181614]">{project.fullName}</span>.
            Saving immediately re-probes your health, metrics, and telemetry endpoints.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
              Deployed base URL
            </label>
            <Input
              value={deployedUrl}
              onChange={(e) => setDeployedUrl(e.target.value)}
              placeholder="https://pulseshop-gateway.vercel.app"
              className="h-9 bg-white font-mono text-[12.5px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
              Default branch
            </label>
            <Input
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="h-9 bg-white font-mono text-[12.5px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
              Health path
            </label>
            <Input
              value={healthEndpoint}
              onChange={(e) => setHealthEndpoint(e.target.value)}
              className="h-9 bg-white font-mono text-[12.5px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
              Prometheus metrics path
            </label>
            <Input
              value={metricsEndpoint}
              onChange={(e) => setMetricsEndpoint(e.target.value)}
              className="h-9 bg-white font-mono text-[12.5px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#5C5650]">
              JSON telemetry path
            </label>
            <Input
              value={telemetryEndpoint}
              onChange={(e) => setTelemetryEndpoint(e.target.value)}
              className="h-9 bg-white font-mono text-[12.5px]"
            />
          </div>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-1.5 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[12.5px] text-[#15803D]">
            <Check size={14} />
            <span>{savedNotice}</span>
          </div>
        )}
        {error && (
          <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="h-9 bg-[#FF5500] text-white hover:bg-[#E04B00] cursor-pointer"
          >
            {saving ? "Saving & probing..." : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Safety Policy Matrix */}
      <section className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)] space-y-3">
        <div>
          <h3 className="text-[14.5px] font-semibold text-[#181614]">Approval policy tiers</h3>
          <p className="mt-0.5 text-[12.5px] text-[#665E56]">
            Patch-Up never pushes directly to main and never touches production databases.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-[12.5px]">
          <div className="rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-3.5">
            <div className="font-mono text-[11.5px] font-semibold text-[#15803D]">AUTO</div>
            <p className="mt-1 text-[#5C5650]">
              Open Fix PRs, run pre-merge security checks, generate RCA postmortems, purge RAM.
            </p>
          </div>
          <div className="rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-3.5">
            <div className="font-mono text-[11.5px] font-semibold text-[#B83B00]">ASK_FIRST</div>
            <p className="mt-1 text-[#5C5650]">
              Container restarts, scale-ups, traffic shifts, and cache flushes require 1-tap
              operator key approval.
            </p>
          </div>
          <div className="rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-3.5">
            <div className="font-mono text-[11.5px] font-semibold text-[#B91C1C]">NEVER</div>
            <p className="mt-1 text-[#5C5650]">
              Direct pushes to main, schema migrations, secret rotation, or deleting stateful
              volumes.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Governance Audit Log */}
      {auditLog.length > 0 && (
        <section className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)] space-y-3">
          <h3 className="text-[14.5px] font-semibold text-[#181614]">Governance audit log</h3>
          <div className="divide-y divide-[#F0E9E1] font-mono text-[11.5px]">
            {auditLog.slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-[#181614]">
                  {entry.action} · <span className="text-[#78716C]">{entry.target}</span>
                </span>
                <span className="shrink-0 text-[#665E56]">{entry.outcome}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger Zone */}
      {project.id !== "pulseshop" && (
        <section className="flex items-center justify-between gap-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2]/60 p-4">
          <div>
            <div className="text-[13.5px] font-semibold text-[#991B1B]">Remove project</div>
            <p className="text-[12px] text-[#7F1D1D]">
              Disconnects {project.fullName} from Patch-Up without modifying your GitHub repo.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDeleteProject(project.id)}
            className="h-8 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Remove</span>
          </Button>
        </section>
      )}
    </div>
  );
}
