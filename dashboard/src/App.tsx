import { CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApplicationsView } from "./components/ApplicationsView";
import { ApprovalsMatrixView } from "./components/ApprovalsMatrixView";
import { IncidentTimelineView } from "./components/IncidentTimelineView";
import { PostmortemDrawer } from "./components/PostmortemDrawer";
import { ProjectsOverviewView } from "./components/ProjectsOverviewView";
import { ImportProjectDialog } from "./components/ProjectsPanel";
import { SidebarShell } from "./components/SidebarShell";
import { SietchChamberView } from "./components/SietchChamberView";
import { FALLBACK_OVERVIEW } from "./data/fallbackData";
import type { ActiveTab, ConnectedApplication, DashboardOverview, LinkedProject } from "./types";

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
  const [applications, setApplications] = useState<ConnectedApplication[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("projects");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [operatorToken, setOperatorToken] = useState("patchup-operator-2026");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    FALLBACK_OVERVIEW.activeProjectId ?? "pulseshop",
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_installed") === "1") {
      const id = params.get("installation_id");
      return id
        ? `Patch-Up SRE GitHub App connected (Installation #${id}). Select a repository to import.`
        : "Patch-Up SRE GitHub App connected. Select a repository to import.";
    }
    return null;
  });

  const projects = data.projects ?? FALLBACK_OVERVIEW.projects ?? [];
  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const monitoringMode = data.monitoringMode ?? "push-ephemeral";

  const fetchApplications = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/applications`);
      if (!resp.ok) return;
      const json = (await resp.json()) as { applications?: ConnectedApplication[] };
      if (Array.isArray(json.applications)) {
        setApplications(json.applications);
      }
    } catch {
      // Backend offline
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/dashboard/overview`);
      if (!resp.ok) return;
      const json = (await resp.json()) as DashboardOverview;
      setData(json);
      if (Array.isArray(json.applications)) {
        setApplications(json.applications);
      }
    } catch {
      // Backend offline — keep latest snapshot gracefully
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
    void fetchApplications();

    const es = new EventSource(`${API_BASE}/api/events/stream`);
    const refreshFromEvent = () => {
      void fetchOverview();
      void fetchApplications();
    };
    es.addEventListener("connected", () => setSseConnected(true));
    es.addEventListener("sietch_scan", refreshFromEvent);
    es.addEventListener("SIETCH_SCAN_COMPLETE", refreshFromEvent);
    es.addEventListener("approval_updated", refreshFromEvent);
    es.addEventListener("postmortem_created", refreshFromEvent);
    es.addEventListener("incident_detected", refreshFromEvent);
    es.addEventListener("incident_diagnosed", refreshFromEvent);
    es.addEventListener("incident_updated", refreshFromEvent);
    es.addEventListener("INCIDENT_DETECTED", refreshFromEvent);
    es.addEventListener("INCIDENT_DIAGNOSED", refreshFromEvent);
    es.addEventListener("INCIDENT_UPDATED", refreshFromEvent);
    es.addEventListener("SERVICE_UPDATED", refreshFromEvent);
    es.addEventListener("APPLICATION_CONNECTED", refreshFromEvent);
    es.addEventListener("SYSTEM_RESET", refreshFromEvent);
    es.onmessage = refreshFromEvent;
    es.onerror = () => {
      setSseConnected(false);
    };

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(resolveWsUrl());
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = () => {
        refreshFromEvent();
      };
    } catch {
      setWsConnected(false);
    }

    const poll = setInterval(() => {
      void fetchOverview();
      void fetchApplications();
    }, 10000);

    return () => {
      es.close();
      ws?.close();
      clearInterval(poll);
    };
  }, [fetchOverview, fetchApplications]);

  const handleDecideApproval = useCallback(
    async (id: string, decision: "APPROVE" | "REJECT") => {
      setApprovalError(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Operator-Token": operatorToken,
        };
        let resp = await fetch(`${API_BASE}/api/approvals/${id}/decide`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision }),
        });

        if (resp.status === 404) {
          resp = await fetch(`${API_BASE}/api/incidents/${id}/approve`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              decision: decision === "APPROVE" ? "approve" : "reject",
              operator: "oncall-sre@pulseshop.io",
            }),
          });
        }

        if (resp.ok) {
          await fetchOverview();
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          const err = (await resp.json().catch(() => ({}))) as { error?: string };
          setApprovalError(err.error ?? "Invalid X-Operator-Token. Check Operator Key.");
          return;
        }
      } catch {
        // Offline fallback
      }
      setData((prev) => {
        const nowIso = new Date().toISOString();
        const nextApprovals = prev.approvals.map((a) =>
          a.id === id
            ? {
                ...a,
                status: (decision === "APPROVE" ? "EXECUTED" : "REJECTED") as "EXECUTED" | "REJECTED",
                decidedBy: "oncall-sre@pulseshop.io",
                decidedAt: nowIso,
              }
            : a,
        );
        return {
          ...prev,
          approvals: nextApprovals,
          scorecard: {
            ...prev.scorecard,
            pendingApprovals: nextApprovals.filter((a) => a.status === "PENDING").length,
          },
        };
      });
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
        if (resp.ok) {
          await fetchOverview();
        }
      } catch {
        // Offline
      }
    },
    [fetchOverview],
  );

  const handleConnectApplication = useCallback(
    async (payload: {
      name: string;
      type: "frontend" | "backend" | "fullstack" | "microservice";
      deployedUrl: string;
      healthEndpoint: string;
      repoUrl?: string;
    }) => {
      try {
        const resp = await fetch(`${API_BASE}/api/applications/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await resp.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          setupGuide?: { dedicatedWebhookUrl?: string; token?: string };
        };
        if (!resp.ok) {
          return { ok: false, message: json.error ?? `Failed with HTTP ${resp.status}` };
        }
        await fetchApplications();
        return {
          ok: true,
          message: json.message ?? `Connected ${payload.name}`,
          webhookUrl: json.setupGuide?.dedicatedWebhookUrl,
          token: json.setupGuide?.token,
        };
      } catch {
        return { ok: false, message: "Backend offline — could not connect application." };
      }
    },
    [fetchApplications],
  );

  const handleProbeApplication = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API_BASE}/api/applications/${id}/probe`, { method: "POST" });
        await fetchApplications();
      } catch {
        // Offline
      }
    },
    [fetchApplications],
  );

  const handleSimulateFault = useCallback(
    async (
      scenario: "bug_checkout" | "slow_query" | "killed_service" | "memory_leak",
      serviceId: string,
    ) => {
      try {
        const resp = await fetch(`${API_BASE}/api/incidents/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, serviceId }),
        });
        const json = (await resp.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (!resp.ok) {
          return { ok: false, message: json.error ?? `Simulation failed (HTTP ${resp.status})` };
        }
        await fetchOverview();
        return { ok: true, message: json.message ?? `Simulated ${scenario}` };
      } catch {
        return { ok: false, message: "Backend offline — could not simulate fault." };
      }
    },
    [fetchOverview],
  );

  const handleResetIncidents = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/incidents/reset`, { method: "POST" });
      if (!resp.ok) {
        return { ok: false, message: `Reset failed (HTTP ${resp.status})` };
      }
      await fetchOverview();
      return { ok: true, message: "All services restored to healthy baseline." };
    } catch {
      return { ok: false, message: "Backend offline — could not reset." };
    }
  }, [fetchOverview]);

  const handleOpenPostmortemForIncident = useCallback((incidentId: string) => {
    setDrawerIncidentId(incidentId);
    setDrawerOpen(true);
  }, []);

  const handleRescanSignals = useCallback(
    async (projectId: string) => {
      try {
        const resp = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/discover`, {
          method: "POST",
        });
        if (resp.ok) {
          await fetchOverview();
        }
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
          if (selectedProjectId === projectId) {
            setSelectedProjectId("pulseshop");
          }
          await fetchOverview();
        }
      } catch {
        // Offline
      }
    },
    [fetchOverview, selectedProjectId],
  );

  const handleProjectImported = useCallback(
    (project: LinkedProject) => {
      setSelectedProjectId(project.id);
      setData((prev) => {
        const existing = prev.projects ?? [];
        const filtered = existing.filter((p) => p.id !== project.id);
        return {
          ...prev,
          projects: [project, ...filtered],
          activeProjectId: project.id,
        };
      });
      void fetchOverview();
    },
    [fetchOverview],
  );

  return (
    <SidebarShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      scorecard={data.scorecard}
      postmortemCount={data.postmortems.length}
      connectedAppsCount={applications.length}
      sseConnected={sseConnected}
      wsConnected={wsConnected}
      projects={projects}
      activeProjectId={activeProject?.id ?? selectedProjectId}
      monitoringMode={monitoringMode}
      onSelectProject={setSelectedProjectId}
      onOpenImportProject={() => setImportDialogOpen(true)}
      onOpenPostmortems={() => {
        setDrawerIncidentId(null);
        setDrawerOpen(true);
      }}
    >
      {installNotice && (
        <div className="install-banner" role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color="var(--accent)" aria-hidden="true" />
            <span>{installNotice}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setInstallNotice(null);
                setImportDialogOpen(true);
              }}
            >
              Import Repo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Dismiss notice"
              onClick={() => setInstallNotice(null)}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {activeTab === "projects" && (
        <ProjectsOverviewView
          apiBase={API_BASE}
          projects={projects}
          activeProject={activeProject}
          scorecard={data.scorecard}
          incidents={data.incidents}
          approvals={data.approvals}
          githubApp={data.githubApp}
          ephemeralTotalPurged={data.ephemeralStats?.totalPurged ?? 0}
          onSelectProject={setSelectedProjectId}
          onOpenImportDialog={() => setImportDialogOpen(true)}
          onRescanSignals={handleRescanSignals}
          onDeleteProject={handleDeleteProject}
          onNavigateIncidents={() => setActiveTab("incidents")}
          onNavigateApprovals={() => setActiveTab("approvals")}
        />
      )}

      {activeTab === "incidents" && (
        <IncidentTimelineView
          incidents={data.incidents}
          apiBase={API_BASE}
          onOpenPostmortem={handleOpenPostmortemForIncident}
        />
      )}

      {activeTab === "approvals" && (
        <ApprovalsMatrixView
          approvals={data.approvals}
          auditLog={data.auditLog}
          operatorToken={operatorToken}
          onChangeOperatorToken={setOperatorToken}
          approvalError={approvalError}
          onDecideApproval={handleDecideApproval}
        />
      )}

      {activeTab === "sietch" && (
        <SietchChamberView
          scans={data.sietchScans}
          onTriggerBranchScan={handleTriggerBranchScan}
        />
      )}

      {activeTab === "applications" && (
        <ApplicationsView
          applications={applications}
          onConnectApplication={handleConnectApplication}
          onProbeApplication={handleProbeApplication}
          onSimulateFault={handleSimulateFault}
          onResetIncidents={handleResetIncidents}
          onJumpToIncidents={() => setActiveTab("incidents")}
        />
      )}

      <ImportProjectDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        apiBase={API_BASE}
        projects={projects}
        activeProjectId={activeProject?.id ?? selectedProjectId}
        githubApp={data.githubApp}
        onSelectProject={setSelectedProjectId}
        onProjectImported={handleProjectImported}
        onRescanSignals={handleRescanSignals}
        onDeleteProject={handleDeleteProject}
      />

      <PostmortemDrawer
        open={drawerOpen}
        postmortems={data.postmortems}
        selectedIncidentId={drawerIncidentId}
        onClose={() => setDrawerOpen(false)}
      />
    </SidebarShell>
  );
}

export default App;
