import { ArrowUpRight, ExternalLink, FolderGit2, GitBranch, Plus, Search } from "lucide-react";
import { useState } from "react";
import { AreaSparkline } from "@/components/charts/sparkline";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  GitHubAppStatus,
  IncidentRecord,
  LinkedProject,
  ProjectProbePoint,
} from "@/types";

interface ProjectsPageProps {
  projects: LinkedProject[];
  incidents: IncidentRecord[];
  probeHistoryByProject: Record<string, ProjectProbePoint[]>;
  githubApp?: GitHubAppStatus;
  onOpenProject: (projectId: string) => void;
  onOpenImportDialog: () => void;
}

const SIGNAL_KEYS: Array<{
  key: keyof Pick<
    LinkedProject["capabilities"],
    "githubApp" | "healthEndpoint" | "prometheusMetrics" | "jsonTelemetry" | "pushLogsActive" | "sietchGate"
  >;
  label: string;
}> = [
  { key: "githubApp", label: "GitHub App" },
  { key: "healthEndpoint", label: "/health" },
  { key: "prometheusMetrics", label: "/metrics" },
  { key: "jsonTelemetry", label: "/api/telemetry" },
  { key: "pushLogsActive", label: "Push logs (6h)" },
  { key: "sietchGate", label: "Security gate" },
];

export function ProjectsPage({
  projects,
  incidents,
  probeHistoryByProject,
  githubApp,
  onOpenProject,
  onOpenImportDialog,
}: ProjectsPageProps) {
  const [search, setSearch] = useState("");

  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      (p.deployedUrl ?? "").toLowerCase().includes(q)
    );
  });

  const hasInstallations = (githubApp?.installations?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Search + Single Import Entry Point */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            aria-label="Search repositories"
            className="h-9 bg-white pl-9 border-[#E5DCD2] text-[13.5px]"
          />
        </div>

        <div className="flex items-center gap-2">
          {githubApp?.installUrl && !hasInstallations && (
            <a
              href={githubApp.installUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E5DCD2] bg-white px-3 text-[13px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
            >
              <ExternalLink size={13} />
              <span>Install GitHub App</span>
            </a>
          )}
          <Button
            type="button"
            onClick={onOpenImportDialog}
            className="h-9 bg-[#FF5500] text-white hover:bg-[#E04B00] cursor-pointer"
          >
            <Plus size={15} />
            <span>Import repository</span>
          </Button>
        </div>
      </div>

      {/* Empty State when no projects connected */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#EAE2D9] bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFF3EB] text-[#FF5500]">
            <FolderGit2 size={18} />
          </div>
          <p className="text-[15px] font-semibold text-[#181614]">
            {search.trim() ? "No matching projects" : "No repositories connected yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#665E56]">
            {search.trim()
              ? "Try a different repository name or clear your search filter."
              : "Import a GitHub repository to enable push-on-break diagnosis, PR-only fixes, and pre-merge security checks."}
          </p>
          {!search.trim() && (
            <Button
              type="button"
              onClick={onOpenImportDialog}
              className="mt-4 h-9 bg-[#FF5500] text-white hover:bg-[#E04B00] cursor-pointer"
            >
              <Plus size={15} />
              <span>Import repository</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((proj) => {
            const projIncidents = incidents.filter(
              (i) => !i.projectId || i.projectId === proj.id,
            );
            const openCount = projIncidents.filter((i) => i.status !== "RESOLVED").length;
            const latestPr = projIncidents.find((i) => i.fixPrUrl);
            const history = probeHistoryByProject[proj.id] ?? [];
            const cleanHost = proj.deployedUrl
              ? proj.deployedUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")
              : "Push-only telemetry";

            const activeSignals = SIGNAL_KEYS.filter((s) => proj.capabilities[s.key]).length;
            const tooltipText = SIGNAL_KEYS.map(
              (s) => `${s.label}: ${proj.capabilities[s.key] ? "connected" : "missing"}`,
            ).join(" · ");

            return (
              <SpotlightCard
                key={proj.id}
                onClick={() => onOpenProject(proj.id)}
                className="group flex flex-col justify-between p-5 cursor-pointer"
              >
                <div>
                  {/* Header: Repo Name + Open Arrow */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            openCount > 0
                              ? "bg-[#FF5500]"
                              : proj.capabilities.healthEndpoint
                                ? "bg-[#15803D]"
                                : "bg-[#D97706]",
                          )}
                          aria-hidden="true"
                        />
                        <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-[#181614]">
                          {proj.name}
                        </h2>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[12px] text-[#78716C]">
                        {cleanHost}
                      </p>
                    </div>

                    <ArrowUpRight
                      size={16}
                      className="shrink-0 text-[#A89F96] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#FF5500]"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Real Bklit Sparkline (24h Error Rate) */}
                  <div className="mt-4 rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#78716C]">
                      <span>24h error rate</span>
                      <span className="font-mono tabular-nums text-[#181614]">
                        {history.length > 0
                          ? `${history[history.length - 1].errorRatePct.toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                    {history.length >= 2 ? (
                      <AreaSparkline
                        data={history}
                        dataKey="errorRatePct"
                        height={30}
                        color={openCount > 0 ? "#FF5500" : "#15803D"}
                      />
                    ) : (
                      <div className="flex h-[30px] items-center font-mono text-[11px] text-[#8C837A]">
                        Collecting first 5m probe samples
                      </div>
                    )}
                  </div>

                  {/* Repo Branch & Latest Fix PR */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#F4EFE9] px-2 py-0.5 font-mono text-[11.5px] text-[#5C5650]">
                      <GitBranch size={11} aria-hidden="true" />
                      {proj.fullName}
                    </span>
                    {latestPr?.fixPrUrl && (
                      <a
                        href={latestPr.fixPrUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md bg-[#FFF3EB] px-2 py-0.5 font-mono text-[11.5px] font-medium text-[#B83B00] hover:underline"
                      >
                        Fix PR #{latestPr.fixPrNumber}
                      </a>
                    )}
                  </div>
                </div>

                {/* Footer: Incident Count + 6 Signal Coverage Dots */}
                <div className="mt-4 flex items-center justify-between border-t border-[#F0E9E1] pt-3 text-[12px]">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      openCount > 0 ? "text-[#B83B00]" : "text-[#665E56]",
                    )}
                  >
                    {openCount > 0
                      ? `${openCount} open ${openCount === 1 ? "incident" : "incidents"}`
                      : `${projIncidents.length} tracked`}
                  </span>

                  <div
                    className="flex items-center gap-1.5"
                    title={tooltipText}
                    aria-label={`${activeSignals} of 6 signals connected`}
                  >
                    {SIGNAL_KEYS.map((s) => (
                      <span
                        key={s.key}
                        className={cn(
                          "h-2 w-2 rounded-full",
                          proj.capabilities[s.key] ? "bg-[#15803D]" : "bg-[#DDD4CA]",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
