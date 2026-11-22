import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ApprovalRequest,
  IncidentRecord,
  LinkedProject,
  ScorecardMetrics,
  SietchPrScanResult,
} from "../types";
import { ArchitectureScene } from "./3d/ArchitectureScene";
import { type LayerHealthState, TOWER_NODES, type TowerNodeId } from "./3d/types";
import { NumberTicker } from "./craft/CraftPrimitives";
import { ImpeccableAgentWindow } from "./ImpeccableAgentWindow";
import { NodeInspectorSheet } from "./NodeInspectorSheet";

interface StudioViewProps {
  project: LinkedProject | undefined;
  scorecard: ScorecardMetrics;
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  scans: SietchPrScanResult[];
  apiBase: string;
  operatorToken: string;
  ephemeralTotalPurged: number;
  onChangeOperatorToken: (val: string) => void;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
  onOpenImportDialog: () => void;
  onRescanSignals: (projectId: string) => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
}

export function StudioView({
  project,
  scorecard,
  incidents,
  approvals,
  scans,
  apiBase,
  operatorToken,
  ephemeralTotalPurged,
  onChangeOperatorToken,
  onDecideApproval,
  onOpenImportDialog,
  onRescanSignals,
  onOpenPostmortem,
}: StudioViewProps) {
  const [hoveredNode, setHoveredNode] = useState<TowerNodeId | null>(null);
  const [selectedNode, setSelectedNode] = useState<TowerNodeId | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedNode) {
        setSelectedNode(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNode]);

  // Derive live 3D hardware slab health states from real incidents & pre-merge scans
  const layerHealth = useMemo<Record<string, LayerHealthState>>(() => {
    const openIncidents = incidents.filter((i) => i.status !== "RESOLVED");
    const hasBackendCritical = openIncidents.some(
      (i) => i.service === "orders" || i.service === "payments",
    );
    const hasGatewayIssue = openIncidents.some((i) => i.service === "gateway");
    const hasBlockedPr = scans.some((s) => s.blocked);

    const backendState: LayerHealthState = hasBackendCritical
      ? "CRITICAL"
      : openIncidents.length > 0
        ? "RECOVERING"
        : "HEALTHY";
    const gatewayState: LayerHealthState = hasGatewayIssue ? "DEGRADED" : "HEALTHY";
    const gitState: LayerHealthState = hasBlockedPr ? "DEGRADED" : "HEALTHY";
    const aiState: LayerHealthState = openIncidents.length > 0 ? "RECOVERING" : "HEALTHY";

    return {
      "git-sep": gitState,
      "layer-git-sep": gitState,
      "frontend-service": "HEALTHY",
      "layer-frontend": "HEALTHY",
      "gateway-service": gatewayState,
      "layer-gateway": gatewayState,
      "backend-service": backendState,
      "layer-backend": backendState,
      "ai-engine": aiState,
      "layer-ai-engine": aiState,
    };
  }, [incidents, scans]);

  const openCount = incidents.filter((i) => i.status !== "RESOLVED").length;
  const overallStatus = openCount > 0 ? "Active Alert" : "Running";
  const hoveredMeta = hoveredNode ? TOWER_NODES[hoveredNode] : null;
  const hoveredHealth = hoveredNode ? layerHealth[hoveredNode] ?? "HEALTHY" : "HEALTHY";

  function scrollToAgent() {
    document.getElementById("live-agent-window")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="studio-page">
      {/* 1. FULL-VIEWPORT LUMINOUS 3D STACKED CHIP STUDIO */}
      <section className="studio-hero" aria-label="Interactive 3D Architecture">
        <div className="studio-canvas-wrap">
          <ArchitectureScene
            hoveredServiceId={hoveredNode}
            selectedServiceId={selectedNode}
            layerHealth={layerHealth}
            onHoverService={setHoveredNode}
            onSelectService={(nodeId) => {
              setSelectedNode(nodeId);
              setHoveredNode(null);
            }}
          />
        </div>

        {/* Clean Top-Left Monitored App Identity (Visible on Overview) */}
        {!selectedNode && (
          <div className="studio-target-badge">
            <div className="studio-target-row">
              <span className="studio-target-name">{project?.name || "PulseShop"}</span>
              <span className={`badge mono ${openCount > 0 ? "badge-ask" : "badge-safe"}`}>
                <span
                  className={`dot ${openCount > 0 ? "dot-warn" : "dot-healthy"}`}
                  aria-hidden="true"
                />
                {overallStatus}
              </span>
            </div>
            <span className="studio-target-sub mono">
              {project?.fullName || "Soham-1304/pulseshop"} · Click any tier to inspect
            </span>
          </div>
        )}

        {/* Minimal Hover Card on 3D Slab Hover */}
        {!selectedNode && hoveredMeta && (
          <div className="studio-hover-card" role="status">
            <div className="studio-hover-top">
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                {hoveredMeta.tierLabel}
              </span>
              <span
                className={`badge mono ${
                  hoveredHealth === "CRITICAL"
                    ? "badge-critical"
                    : hoveredHealth === "HEALTHY"
                      ? "badge-safe"
                      : "badge-ask"
                }`}
              >
                {hoveredHealth}
              </span>
            </div>
            <div className="studio-hover-title">{hoveredMeta.name}</div>
            <div className="studio-hover-role">{hoveredMeta.shortRole}</div>
            <div className="studio-hover-cta mono">Click slab to inspect →</div>
          </div>
        )}

        {/* Clean Bottom-Center Action Pill + Scroll Cue */}
        {!selectedNode && (
          <div className="studio-bottom-dock">
            <button type="button" className="studio-add-pill" onClick={onOpenImportDialog}>
              <Plus size={15} color="#FF5500" />
              <span>Import Repository</span>
            </button>
            <button type="button" className="studio-scroll-cue mono" onClick={scrollToAgent}>
              <span>Scroll to live agent</span>
              <ChevronDown size={13} color="#FF5500" />
            </button>
          </div>
        )}

        {/* Decluttered Single-Panel Pure White Node Inspector Sheet */}
        {selectedNode && (
          <NodeInspectorSheet
            nodeId={selectedNode}
            health={layerHealth[selectedNode] ?? "HEALTHY"}
            project={project}
            incidents={incidents}
            scans={scans}
            apiBase={apiBase}
            onClose={() => setSelectedNode(null)}
            onRescanSignals={onRescanSignals}
            onOpenPostmortem={onOpenPostmortem}
          />
        )}
      </section>

      {/* 2. COMPACT 4-STAT TICKER BAR (Single Calm Row — Zero 10-Card Bloat) */}
      <div className="studio-content-wrap">
        <div className="studio-kpi-strip">
          <div className="studio-kpi-cell">
            <span className="studio-kpi-label">Mean Diagnosis</span>
            <NumberTicker
              value={Number((scorecard.meanTtdMs / 1000).toFixed(1))}
              decimals={1}
              suffix="s"
              className="studio-kpi-val"
            />
          </div>
          <div className="studio-kpi-cell">
            <span className="studio-kpi-label">Incidents Tracked</span>
            <NumberTicker value={scorecard.incidentsTotal} className="studio-kpi-val" />
          </div>
          <div className="studio-kpi-cell">
            <span className="studio-kpi-label">Fix PRs Opened</span>
            <NumberTicker value={scorecard.fixPrsOpened} className="studio-kpi-val accent" />
          </div>
          <div className="studio-kpi-cell">
            <span className="studio-kpi-label">RAM Retained</span>
            <span className="studio-kpi-val mono" style={{ color: "var(--safe)" }}>
              0 B <small style={{ fontWeight: 500, color: "var(--ink-muted)" }}>({ephemeralTotalPurged} purged)</small>
            </span>
          </div>
        </div>

        {/* 3. IMPECCABLE-INSPIRED LIVE SPLIT AGENT STUDIO WINDOW */}
        <ImpeccableAgentWindow
          incidents={incidents}
          approvals={approvals}
          apiBase={apiBase}
          repoFullName={project?.fullName || "Soham-1304/pulseshop"}
          operatorToken={operatorToken}
          onChangeOperatorToken={onChangeOperatorToken}
          onDecideApproval={onDecideApproval}
          onOpenPostmortem={onOpenPostmortem}
        />
      </div>
    </div>
  );
}
