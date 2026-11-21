import { Activity, Flame, Globe, Link2, Play, RotateCcw, ServerCrash } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ConnectedApplication, GitHubAppStatus, LinkedProject } from "../types";
import { ProjectsPanel } from "./ProjectsPanel";

interface ApplicationsViewProps {
  apiBase: string;
  projects: LinkedProject[];
  activeProjectId: string;
  githubApp?: GitHubAppStatus;
  onSelectProject: (projectId: string) => void;
  onProjectImported: (project: LinkedProject) => void;
  onRescanSignals: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  applications: ConnectedApplication[];
  onConnectApplication: (payload: {
    name: string;
    type: "frontend" | "backend" | "fullstack" | "microservice";
    deployedUrl: string;
    healthEndpoint: string;
    repoUrl?: string;
  }) => Promise<{ ok: boolean; message: string; webhookUrl?: string; token?: string }>;
  onProbeApplication: (id: string) => Promise<void>;
  onSimulateFault: (
    scenario: "bug_checkout" | "slow_query" | "killed_service" | "memory_leak",
    serviceId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onResetIncidents: () => Promise<{ ok: boolean; message: string }>;
  onJumpToIncidents: () => void;
}

const FAULT_SCENARIOS: Array<{
  id: "bug_checkout" | "slow_query" | "killed_service" | "memory_leak";
  label: string;
  rule: string;
  detail: string;
}> = [
  {
    id: "bug_checkout",
    label: "Bug Checkout (5xx)",
    rule: "ERR_5XX_SPIKE",
    detail: "Injects TypeError in calculatePromoDiscount() -> Path A git blame + Fix PR",
  },
  {
    id: "slow_query",
    label: "Slow Query (p95 Spike)",
    rule: "LATENCY_P95_DOUBLE",
    detail: "Spikes p95 latency to 2,400ms -> Path B deploy diff + Counterfactual Planner",
  },
  {
    id: "killed_service",
    label: "Killed Service (Outage)",
    rule: "SERVICE_DOWN",
    detail: "Simulates container exit (0 commits) -> Path C Runtime Fault + Auto Restart",
  },
  {
    id: "memory_leak",
    label: "Memory Leak (OOM)",
    rule: "MEMORY_LEAK",
    detail: "Pushes heap to 96.8% -> Pre-crash warning + Counterfactual mitigation",
  },
];

export function ApplicationsView({
  apiBase,
  projects,
  activeProjectId,
  githubApp,
  onSelectProject,
  onProjectImported,
  onRescanSignals,
  onDeleteProject,
  applications,
  onConnectApplication,
  onProbeApplication,
  onSimulateFault,
  onResetIncidents,
  onJumpToIncidents,
}: ApplicationsViewProps) {
  const [name, setName] = useState("");
  const [appType, setAppType] = useState<"frontend" | "backend" | "fullstack" | "microservice">("backend");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [healthEndpoint, setHealthEndpoint] = useState("/health");
  const [repoUrl, setRepoUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectFeedback, setConnectFeedback] = useState<{
    ok: boolean;
    message: string;
    webhookUrl?: string;
    token?: string;
  } | null>(null);

  const [targetService, setTargetService] = useState("orders-service");
  const [simBusy, setSimBusy] = useState<string | null>(null);
  const [simFeedback, setSimFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);

  async function handleConnectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !deployedUrl.trim()) return;
    setConnecting(true);
    setConnectFeedback(null);
    try {
      const res = await onConnectApplication({
        name: name.trim(),
        type: appType,
        deployedUrl: deployedUrl.trim(),
        healthEndpoint: healthEndpoint.trim() || "/health",
        repoUrl: repoUrl.trim() || undefined,
      });
      setConnectFeedback(res);
      if (res.ok) {
        setName("");
        setDeployedUrl("");
        setRepoUrl("");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleSimulate(scenario: "bug_checkout" | "slow_query" | "killed_service" | "memory_leak") {
    setSimBusy(scenario);
    setSimFeedback(null);
    try {
      const res = await onSimulateFault(scenario, targetService);
      setSimFeedback(res);
    } finally {
      setSimBusy(null);
    }
  }

  async function handleReset() {
    setSimBusy("reset");
    setSimFeedback(null);
    try {
      const res = await onResetIncidents();
      setSimFeedback(res);
    } finally {
      setSimBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ProjectsPanel
        apiBase={apiBase}
        projects={projects}
        activeProjectId={activeProjectId}
        githubApp={githubApp}
        onSelectProject={onSelectProject}
        onProjectImported={onProjectImported}
        onRescanSignals={onRescanSignals}
        onDeleteProject={onDeleteProject}
      />

      <div className="evidence-two-col">
        {/* Left: Connect Any Deployed URL */}
        <section className="panel" aria-label="Connect Any Deployed Application">
          <div className="panel-header">
            <h2 className="panel-title">
              <Link2 size={15} color="#22d3ee" />
              <span>Hook In Any Deployed URL</span>
            </h2>
            <span className="badge badge-cyan mono">POST /api/applications/connect</span>
          </div>
          <div className="panel-body">
            <form onSubmit={handleConnectSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="app-name-input" style={{ fontSize: 12, color: "#94a3b8" }}>
                    Application Name
                  </label>
                  <input
                    id="app-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. checkout-edge-api"
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="app-type-select" style={{ fontSize: 12, color: "#94a3b8" }}>
                    Service Type
                  </label>
                  <select
                    id="app-type-select"
                    value={appType}
                    onChange={(e) =>
                      setAppType(e.target.value as "frontend" | "backend" | "fullstack" | "microservice")
                    }
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  >
                    <option value="backend">backend</option>
                    <option value="microservice">microservice</option>
                    <option value="fullstack">fullstack</option>
                    <option value="frontend">frontend</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="app-url-input" style={{ fontSize: 12, color: "#94a3b8" }}>
                    Deployed URL
                  </label>
                  <input
                    id="app-url-input"
                    type="url"
                    required
                    value={deployedUrl}
                    onChange={(e) => setDeployedUrl(e.target.value)}
                    placeholder="https://my-app.vercel.app"
                    className="mono"
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="app-health-input" style={{ fontSize: 12, color: "#94a3b8" }}>
                    Health Path
                  </label>
                  <input
                    id="app-health-input"
                    type="text"
                    value={healthEndpoint}
                    onChange={(e) => setHealthEndpoint(e.target.value)}
                    placeholder="/health"
                    className="mono"
                    style={{
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label htmlFor="app-repo-input" style={{ fontSize: 12, color: "#94a3b8" }}>
                  GitHub Repo URL (optional, enables Fix PRs)
                </label>
                <input
                  id="app-repo-input"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/Soham-1304/pulseshop"
                  className="mono"
                  style={{
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 10px",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Starts synthetic probing immediately and generates a dedicated webhook endpoint.
                </span>
                <button type="submit" className="btn btn-primary" disabled={connecting}>
                  <Globe size={14} />
                  <span>{connecting ? "Connecting..." : "Connect & Probe"}</span>
                </button>
              </div>
            </form>

            {connectFeedback && (
              <div
                className="undo-plan-box"
                style={{
                  marginTop: 14,
                  borderColor: connectFeedback.ok ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: connectFeedback.ok ? "#6ee7b7" : "#fca5a5" }}>
                  {connectFeedback.message}
                </div>
                {connectFeedback.webhookUrl && (
                  <div className="mono" style={{ fontSize: 12, color: "#cbd5e1", marginTop: 6 }}>
                    Webhook: {connectFeedback.webhookUrl}
                    {connectFeedback.token ? ` · Token: ${connectFeedback.token}` : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right: Live Fault Simulator Controls */}
        <section className="panel" aria-label="Live Fault Simulator Controls">
          <div className="panel-header">
            <h2 className="panel-title">
              <Flame size={15} color="#f59e0b" />
              <span>Live Fault Simulator</span>
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="sim-target-select" style={{ fontSize: 12, color: "#94a3b8" }}>
                Target:
              </label>
              <select
                id="sim-target-select"
                value={targetService}
                onChange={(e) => setTargetService(e.target.value)}
                className="mono"
                style={{
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  padding: "5px 10px",
                  fontSize: 12,
                }}
              >
                <option value="orders-service">orders-service</option>
                <option value="gateway-service">gateway-service</option>
                <option value="payments-service">payments-service</option>
              </select>
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAULT_SCENARIOS.map((sc) => (
              <div
                key={sc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{sc.label}</span>
                    <span className="badge badge-muted mono">{sc.rule}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{sc.detail}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={simBusy !== null}
                  onClick={() => handleSimulate(sc.id)}
                >
                  <Play size={13} />
                  <span>{simBusy === sc.id ? "Injecting..." : "Inject"}</span>
                </button>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingTop: 6,
                borderTop: "1px solid var(--border-hairline)",
              }}
            >
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Restore all microservices to baseline healthy telemetry.
              </span>
              <button
                type="button"
                className="btn btn-approve"
                disabled={simBusy !== null}
                onClick={handleReset}
              >
                <RotateCcw size={13} />
                <span>{simBusy === "reset" ? "Resetting..." : "Reset All Healthy"}</span>
              </button>
            </div>

            {simFeedback && (
              <div
                className="undo-plan-box"
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  borderColor: simFeedback.ok ? "rgba(34, 211, 238, 0.4)" : "rgba(239, 68, 68, 0.4)",
                }}
              >
                <span style={{ fontSize: 13, color: simFeedback.ok ? "#67e8f9" : "#fca5a5" }}>
                  {simFeedback.message}
                </span>
                {simFeedback.ok && (
                  <button type="button" className="btn btn-primary" onClick={onJumpToIncidents}>
                    <ServerCrash size={13} />
                    <span>View Timeline</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Monitored Connected Applications Table */}
      <section className="panel" aria-label="Monitored Connected Applications">
        <div className="panel-header">
          <h2 className="panel-title">
            <Activity size={15} color="#10b981" />
            <span>Monitored Connected Applications</span>
          </h2>
          <span className="badge badge-muted mono">{applications.length} connected</span>
        </div>
        <div className="data-table-wrap">
          {applications.length === 0 ? (
            <div className="panel-body" style={{ color: "#94a3b8", fontSize: 13 }}>
              No external applications connected yet. Use the form above to hook in any deployed URL.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Type</th>
                  <th>Deployed URL</th>
                  <th>Status</th>
                  <th>Last Probe</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{app.name}</div>
                      <div className="mono" style={{ fontSize: 12, color: "#64748b" }}>
                        {app.id}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-muted mono">{app.type}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      <a href={app.deployedUrl} target="_blank" rel="noreferrer">
                        {app.deployedUrl}
                        {app.healthEndpoint}
                      </a>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          app.status === "HEALTHY"
                            ? "badge-safe"
                            : app.status === "WARNING"
                              ? "badge-ask"
                              : "badge-critical"
                        } mono`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: "#cbd5e1" }}>
                      HTTP {app.lastProbe?.statusCode ?? 0} · {app.lastProbe?.latencyMs ?? 0}ms
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={probingId === app.id}
                        onClick={async () => {
                          setProbingId(app.id);
                          try {
                            await onProbeApplication(app.id);
                          } finally {
                            setProbingId(null);
                          }
                        }}
                      >
                        <Activity size={13} />
                        <span>{probingId === app.id ? "Probing..." : "Probe Now"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
