import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import type { AppRoute, ProjectTab } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { LinkedProject } from "@/types";
import { PatchUpWordmark } from "./PatchUpWordmark";

interface AppShellProps {
  route: AppRoute;
  projects: LinkedProject[];
  activeProject: LinkedProject | undefined;
  openIncidentsCount: number;
  pendingApprovalsCount: number;
  postmortemCount: number;
  isLive: boolean;
  onNavigate: (route: AppRoute) => void;
  onOpenPostmortems: () => void;
  children: ReactNode;
}

const PROJECT_TABS: Array<{ id: ProjectTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "incidents", label: "Incidents" },
  { id: "security", label: "Security gate" },
  { id: "signals", label: "Signals & setup" },
  { id: "settings", label: "Settings" },
];

export function AppShell({
  route,
  projects,
  activeProject,
  openIncidentsCount,
  pendingApprovalsCount,
  postmortemCount,
  isLive,
  onNavigate,
  onOpenPostmortems,
  children,
}: AppShellProps) {
  const inProject = route.kind === "project" && activeProject;
  const isFlushCanvas = route.kind === "project" && route.tab === "architecture";

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAF8F5] text-[#181614]">
      <header className="sticky top-0 z-40 border-b border-[#EAE2D9] bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "projects" })}
              className="inline-flex items-center rounded-md px-1 py-0.5 transition-opacity hover:opacity-85 cursor-pointer"
              aria-label="PatchUP Projects Home"
            >
              <PatchUpWordmark compact />
            </button>

            {inProject ? (
              <>
                <span className="text-[#D4C9BC] select-none" aria-hidden="true">
                  /
                </span>
                <select
                  aria-label="Switch project"
                  value={activeProject.id}
                  onChange={(e) =>
                    onNavigate({
                      kind: "project",
                      projectId: e.target.value,
                      tab: route.tab,
                    })
                  }
                  className="h-7 rounded-md border border-[#E5DCD2] bg-white px-2.5 font-mono text-[12.5px] font-medium text-[#181614] transition-colors hover:border-[#CFC4B8] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/30 cursor-pointer max-w-[230px] truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <span className="text-[#D4C9BC] select-none" aria-hidden="true">
                  /
                </span>
                <span className="text-[13px] font-medium text-[#5C5650]">Projects</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "landing" })}
              className="hidden sm:inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-[#665E56] hover:text-[#181614] cursor-pointer"
            >
              Home
            </button>

            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#EAE2D9] bg-white px-2.5 font-mono text-[11.5px] font-medium text-[#5C5650]"
              title={isLive ? "WebSocket stream live" : "Reconnecting to control plane"}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isLive ? "bg-[#15803D]" : "bg-[#FF5500]",
                )}
                aria-hidden="true"
              />
              <span>{isLive ? "Live" : "Sync"}</span>
            </span>

            <button
              type="button"
              onClick={onOpenPostmortems}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#EAE2D9] bg-white px-2.5 text-[12.5px] font-medium text-[#181614] transition-colors hover:bg-[#F4EFE9] cursor-pointer"
            >
              <FileText size={13} className="text-[#78716C]" aria-hidden="true" />
              <span className="hidden sm:inline">Reports</span>
              <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
                {postmortemCount}
              </span>
            </button>
          </div>
        </div>

        {inProject && (
          <nav
            aria-label="Project sections"
            className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-5 border-t border-[#EFE8E0]"
          >
            {PROJECT_TABS.map((tab) => {
              const isCurrent = route.tab === tab.id;
              const badgeCount =
                tab.id === "incidents" ? openIncidentsCount + pendingApprovalsCount : 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() =>
                    onNavigate({
                      kind: "project",
                      projectId: activeProject.id,
                      tab: tab.id,
                    })
                  }
                  className={cn(
                    "relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] transition-colors cursor-pointer",
                    isCurrent
                      ? "font-semibold text-[#181614]"
                      : "font-medium text-[#665E56] hover:text-[#181614]",
                  )}
                >
                  <span>{tab.label}</span>
                  {badgeCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FFF3EB] px-1.5 font-mono text-[10.5px] font-semibold text-[#B83B00] border border-[#FBD3B7] tabular-nums">
                      {badgeCount}
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#FF5500]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main
        className={
          isFlushCanvas
            ? "flex-1 w-full"
            : "mx-auto w-full max-w-[1280px] flex-1 px-5 py-7"
        }
      >
        {children}
      </main>
    </div>
  );
}
