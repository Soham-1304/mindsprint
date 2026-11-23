import { CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostmortemDrawer } from "@/components/PostmortemDrawer";
import { ImportProjectDialog } from "@/components/ProjectsPanel";
import { FALLBACK_OVERVIEW } from "@/data/fallbackData";
import LandingPage from "@/landing/LandingPage";
import { type AppRoute, buildPath, parseRoute } from "@/lib/router";
import { ArchitecturePage } from "@/pages/ArchitecturePage";
import { IncidentsPage } from "@/pages/IncidentsPage";
import { ProjectOverviewPage } from "@/pages/ProjectOverviewPage";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { SecurityGatePage } from "@/pages/SecurityGatePage";
import { SignalsSetupPage } from "@/pages/SignalsSetupPage";
import type { DashboardOverview, LinkedProject } from "@/types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

function resolveWsUrl(): string {
  if (API_BASE) {
    return `${API_BASE.replace(/^http/, "ws").replace(/\/+$/, "")}/ws`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function App() {
  const [data, setData] = useState<DashboardOverview>(FALLBACK_OVERVIEW);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [operatorToken, setOperatorToken] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_installed") === "1") {
      const id = params.get("installation_id");
      return id
        ? `GitHub App connected (Installation #${id}). Import a repository below.`
        : "GitHub App connected. Import a repository below.";
    }
    return null;
  });

  const navigate = useCallback((next: AppRoute) => {
    const path = buildPath(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/dashboard/overview`);
      if (!resp.ok) return;
      const json = (await resp.json()) as DashboardOverview;
      setData(json);
    } catch {
      // Offline — preserve last snapshot
    }
  }, []);

  useEffect(() => {
    if (route.kind === "landing") return;
    void fetchOverview();

    const es = new EventSource(`${API_BASE}/api/events/stream`);
    const refresh = () => void fetchOverview();
    es.addEventListener("connected", () => setSseConnected(true));
    es.addEventListener("sietch_scan", refresh);
    es.addEventListener("SIETCH_SCAN_COMPLETE", refresh);
    es.addEventListener("approval_updated", refresh);
    es.addEventListener("postmortem_created", refresh);
    es.addEventListener("incident_detected", refresh);
    es.addEventListener("incident_diagnosed", refresh);
    es.addEventListener("incident_updated", refresh);
    es.addEventListener("INCIDENT_DETECTED", refresh);
    es.addEventListener("INCIDENT_DIAGNOSED", refresh);
    es.addEventListener("INCIDENT_UPDATED", refresh);
    es.addEventListener("SERVICE_UPDATED", refresh);
    es.onmessage = refresh;
    es.onerror = () => setSseConnected(false);

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(resolveWsUrl());
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = () => refresh();
    } catch {
      setWsConnected(false);
    }

    const poll = setInterval(() => void fetchOverview(), 10000);
    return () => {
      es.close();
      ws?.close();
      clearInterval(poll);
    };
  }, [fetchOverview, route.kind]);

  const projects = data.projects ?? FALLBACK_OVERVIEW.projects ?? [];
  const activeProject =
    route.kind === "project"
      ? projects.find((p) => p.id === route.projectId) ?? projects[0]
      : undefined;

  const projectIncidents = activeProject
    ? data.incidents.filter((i) => !i.projectId || i.projectId === activeProject.id)
    : data.incidents;
  const openIncidentsCount = projectIncidents.filter((i) => i.status !== "RESOLVED").length;
  const pendingApprovalsCount = data.approvals.filter((a) => a.status === "PENDING").length;

  const handleDecideApproval = useCallback(
    async (id: string, decision: "APPROVE" | "REJECT") => {
      setApprovalError(null);
      try {
        const resp = await fetch(`${API_BASE}/api/approvals/${id}/decide`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Operator-Token": operatorToken,
          },
          body: JSON.stringify({ decision }),
        });
        if (resp.ok) {
          await fetchOverview();
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          const err = (await resp.json().catch(() => ({}))) as { error?: string };
          setApprovalError(err.error ?? "Invalid operator key.");
        }
      } catch {
        setApprovalError("Could not reach backend.");
      }
    },
    [fetchOverview, operatorToken],
  );

  const handleTriggerBranchScan = useCallback(
    async (branch: "bad-package" | "low-memory") => {
      try {
        const resp = await fetch(`${API_BASE}/api/sietch/scan-branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch, bypassCache: true }),
        });
        if (resp.ok) await fetchOverview();
      } catch {
        // Offline
      }
    },
    [fetchOverview],
  );

  const handleRescanSignals = useCallback(
    async (projectId: string) => {
      try {
        const resp = await fetch(
          `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/discover`,
          { method: "POST" },
        );
        if (resp.ok) await fetchOverview();
      } catch {
        // Offline
      }
    },
    [fetchOverview],
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      try {
        const resp = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}`, {
          method: "DELETE",
        });
        if (resp.ok) {
          await fetchOverview();
          navigate({ kind: "projects" });
        }
      } catch {
        // Offline
      }
    },
    [fetchOverview, navigate],
  );

  const handleProjectImported = useCallback(
    (project: LinkedProject) => {
      setData((prev) => ({
        ...prev,
        projects: [project, ...(prev.projects ?? []).filter((p) => p.id !== project.id)],
      }));
      void fetchOverview();
      navigate({ kind: "project", projectId: project.id, tab: "overview" });
    },
    [fetchOverview, navigate],
  );

  // Full Landing Page at `/`
  if (route.kind === "landing") {
    return <LandingPage onEnterDashboard={() => navigate({ kind: "projects" })} />;
  }

  return (
    <AppShell
      route={route}
      projects={projects}
      activeProject={activeProject}
      openIncidentsCount={openIncidentsCount}
      pendingApprovalsCount={pendingApprovalsCount}
      postmortemCount={data.postmortems.length}
      isLive={wsConnected || sseConnected}
      onNavigate={navigate}
      onOpenPostmortems={() => {
        setDrawerIncidentId(null);
        setDrawerOpen(true);
      }}
    >
      {installNotice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#FBD3B7] bg-[#FFF5EE] px-4 py-2.5 text-[13px] text-[#B83B00]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-[#FF5500]" />
            <span>{installNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstallNotice(null)}
            aria-label="Dismiss notice"
            className="rounded p-1 hover:bg-[#FFE6D5] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {route.kind === "projects" && (
        <ProjectsPage
          projects={projects}
          incidents={data.incidents}
          probeHistoryByProject={data.probeHistoryByProject ?? {}}
          githubApp={data.githubApp}
          onOpenProject={(projectId) =>
            navigate({ kind: "project", projectId, tab: "overview" })
          }
          onOpenImportDialog={() => setImportOpen(true)}
        />
      )}

      {route.kind === "project" && activeProject && route.tab === "overview" && (
        <ProjectOverviewPage
          project={activeProject}
          services={data.projectServices ?? []}
          incidents={projectIncidents}
          scans={data.sietchScans}
          probeHistory={(data.probeHistoryByProject ?? {})[activeProject.id] ?? []}
          ephemeralTotalPurged={data.ephemeralStats?.totalPurged ?? 0}
          onOpenArchitecture={() =>
            navigate({ kind: "project", projectId: activeProject.id, tab: "architecture" })
          }
          onOpenIncident={(incidentId) =>
            navigate({
              kind: "project",
              projectId: activeProject.id,
              tab: "incidents",
              incidentId,
            })
          }
          onOpenSignals={() =>
            navigate({ kind: "project", projectId: activeProject.id, tab: "signals" })
          }
          onOpenSecurity={() =>
            navigate({ kind: "project", projectId: activeProject.id, tab: "security" })
          }
        />
      )}

      {route.kind === "project" && activeProject && route.tab === "architecture" && (
        <ArchitecturePage
          project={activeProject}
          services={data.projectServices ?? []}
          incidents={projectIncidents}
          scans={data.sietchScans}
          apiBase={API_BASE}
          onOpenIncident={(incidentId) =>
            navigate({
              kind: "project",
              projectId: activeProject.id,
              tab: "incidents",
              incidentId,
            })
          }
          onOpenSignals={() =>
            navigate({ kind: "project", projectId: activeProject.id, tab: "signals" })
          }
          onOpenSecurity={() =>
            navigate({ kind: "project", projectId: activeProject.id, tab: "security" })
          }
        />
      )}

      {route.kind === "project" &&
        activeProject &&
        route.tab === "incidents" && (
          <IncidentsPage
            incidents={projectIncidents}
            approvals={data.approvals}
            repoFullName={activeProject.fullName}
            apiBase={API_BASE}
            operatorToken={operatorToken}
            approvalError={approvalError}
            onChangeOperatorToken={setOperatorToken}
            onDecideApproval={handleDecideApproval}
            onOpenPostmortem={(incId) => {
              setDrawerIncidentId(incId);
              setDrawerOpen(true);
            }}
          />
        )}

      {route.kind === "project" && activeProject && route.tab === "security" && (
        <SecurityGatePage
          repoFullName={activeProject.fullName}
          scans={data.sietchScans}
          onTriggerBranchScan={handleTriggerBranchScan}
        />
      )}

      {route.kind === "project" && activeProject && route.tab === "signals" && (
        <SignalsSetupPage
          project={activeProject}
          apiBase={API_BASE}
          onRescanSignals={handleRescanSignals}
        />
      )}

      {route.kind === "project" && activeProject && route.tab === "settings" && (
        <ProjectSettingsPage
          project={activeProject}
          auditLog={data.auditLog}
          apiBase={API_BASE}
          onProjectUpdated={fetchOverview}
          onDeleteProject={handleDeleteProject}
        />
      )}

      <ImportProjectDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        apiBase={API_BASE}
        projects={projects}
        githubApp={data.githubApp}
        onProjectImported={handleProjectImported}
      />

      <PostmortemDrawer
        open={drawerOpen}
        postmortems={data.postmortems}
        selectedIncidentId={drawerIncidentId}
        onClose={() => setDrawerOpen(false)}
      />
    </AppShell>
  );
}

export default App;
