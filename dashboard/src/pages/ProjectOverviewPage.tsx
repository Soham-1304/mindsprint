import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArchitectureScene } from "@/components/3d/ArchitectureScene";
import type { LayerHealthState, RealTowerSlot, TowerNodeId } from "@/components/3d/types";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { Line, LineChart } from "@/components/charts/line-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import type {
  IncidentRecord,
  LinkedProject,
  ProjectProbePoint,
  ProjectServiceInfo,
  SietchPrScanResult,
} from "@/types";

interface ProjectOverviewPageProps {
  project: LinkedProject;
  services: ProjectServiceInfo[];
  incidents: IncidentRecord[];
  scans: SietchPrScanResult[];
  probeHistory: ProjectProbePoint[];
  ephemeralTotalPurged: number;
  onOpenIncident: (incidentId: string) => void;
  onOpenSignals: () => void;
  onOpenSecurity: () => void;
}

function mapServiceHealth(status?: string): LayerHealthState {
  if (status === "DOWN") return "CRITICAL";
  if (status === "DEGRADED") return "DEGRADED";
  return "HEALTHY";
}

function formatRelative(iso?: string): string {
  if (!iso) return "just now";
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function ProjectOverviewPage({
  project,
  services,
  incidents,
  scans,
  probeHistory,
  ephemeralTotalPurged,
  onOpenIncident,
  onOpenSignals,
  onOpenSecurity,
}: ProjectOverviewPageProps) {
  const [hoveredSlot, setHoveredSlot] = useState<TowerNodeId | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TowerNodeId | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedSlot) setSelectedSlot(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSlot]);

  // Build real 3D tower slots exclusively from backend project + service data
  const slots = useMemo<Record<TowerNodeId, RealTowerSlot>>(() => {
    const findSvc = (key: string) =>
      services.find((s) => s.name === key || s.id === `${key}-service`);

    const gateway = findSvc("gateway");
    const orders = findSvc("orders");
    const payments = findSvc("payments");

    const openInc = incidents.filter((i) => i.status !== "RESOLVED");
    const hasOrdersInc = openInc.some((i) => i.service === "orders");
    const hasGatewayInc = openInc.some((i) => i.service === "gateway");
    const hasPaymentsInc = openInc.some((i) => i.service === "payments");
    const latestScan = scans[0];
    const signalsActive = project.capabilities.activeSignalsCount;

    return {
      "ai-engine": {
        slotId: "ai-engine",
        serviceKey: "repo",
        label: project.fullName,
        role: latestScan
          ? `Security gate: ${latestScan.verdictKind} on ${latestScan.branch}`
          : "GitHub repo & pre-merge security gate",
        health: latestScan?.blocked ? "DEGRADED" : "HEALTHY",
        version: project.defaultBranch,
        lastCheckedAt: latestScan?.createdAt,
      },
      "backend-service": {
        slotId: "backend-service",
        serviceKey: "orders",
        label: orders ? `${orders.name}-service` : "orders-service",
        role: orders?.url || "Backend orders service",
        url: orders?.url,
        health: hasOrdersInc ? "CRITICAL" : mapServiceHealth(orders?.status),
        errorRate5xx: orders?.errorRate5xx,
        p95LatencyMs: orders?.p95LatencyMs,
        version: orders?.version,
        lastCheckedAt: orders?.lastCheckedAt,
      },
      "gateway-service": {
        slotId: "gateway-service",
        serviceKey: "gateway",
        label: gateway ? `${gateway.name}-service` : "gateway-service",
        role: gateway?.url || project.deployedUrl || "Edge API gateway",
        url: gateway?.url || project.deployedUrl,
        health: hasGatewayInc
          ? "CRITICAL"
          : !project.capabilities.healthEndpoint
            ? "DEGRADED"
            : mapServiceHealth(gateway?.status),
        errorRate5xx: gateway?.errorRate5xx,
        p95LatencyMs: gateway?.p95LatencyMs,
        version: gateway?.version,
        lastCheckedAt: gateway?.lastCheckedAt,
      },
      "frontend-service": {
        slotId: "frontend-service",
        serviceKey: "payments",
        label: payments ? `${payments.name}-service` : "payments-service",
        role: payments?.url || "Payments service",
        url: payments?.url,
        health: hasPaymentsInc ? "CRITICAL" : mapServiceHealth(payments?.status),
        errorRate5xx: payments?.errorRate5xx,
        p95LatencyMs: payments?.p95LatencyMs,
        version: payments?.version,
        lastCheckedAt: payments?.lastCheckedAt,
      },
      "git-sep": {
        slotId: "git-sep",
        serviceKey: "signals",
        label: "Telemetry & push hooks",
        role: `${signalsActive} of ${project.capabilities.totalSignalsCount} signals connected`,
        health: signalsActive >= 4 ? "HEALTHY" : "DEGRADED",
        lastCheckedAt: project.capabilities.checkedAt,
      },
    };
  }, [project, services, incidents, scans]);

  const layerHealth = useMemo<Record<string, LayerHealthState>>(() => {
    return {
      "ai-engine": slots["ai-engine"].health,
      "layer-ai-engine": slots["ai-engine"].health,
      "backend-service": slots["backend-service"].health,
      "layer-backend": slots["backend-service"].health,
      "gateway-service": slots["gateway-service"].health,
      "layer-gateway": slots["gateway-service"].health,
      "frontend-service": slots["frontend-service"].health,
      "layer-frontend": slots["frontend-service"].health,
      "git-sep": slots["git-sep"].health,
      "layer-git-sep": slots["git-sep"].health,
    };
  }, [slots]);

  const openIncident = incidents.find((i) => i.status !== "RESOLVED");
  const latestIncident = incidents[0];
  const hovered = hoveredSlot ? slots[hoveredSlot] : null;
  const selected = selectedSlot ? slots[selectedSlot] : null;
  const selectedIncidents = selected
    ? incidents.filter((i) => i.service === selected.serviceKey)
    : [];

  // Bklit chart datasets (strictly from real backend data)
  const timeSeriesData = useMemo(
    () =>
      probeHistory.map((pt) => ({
        date: new Date(pt.timestamp),
        errorRate: pt.errorRatePct,
        latencyMs: pt.latencyP95Ms,
      })),
    [probeHistory],
  );

  const diagnosisBarData = useMemo(
    () =>
      incidents.slice(0, 8).map((inc) => ({
        name: inc.id.replace(/^INC-\d+-/, "#"),
        ttdSec: Number((inc.timeToDiagnosisMs / 1000).toFixed(1)),
      })),
    [incidents],
  );

  // Recent activity feed from real incidents & scans
  const activity = useMemo(() => {
    const items: Array<{
      id: string;
      kind: "incident" | "scan" | "purge";
      title: string;
      meta: string;
      at: string;
      onClick?: () => void;
    }> = [];

    for (const inc of incidents.slice(0, 4)) {
      items.push({
        id: `inc-${inc.id}`,
        kind: "incident",
        title: `${inc.service}: ${inc.title}`,
        meta: inc.fixPrNumber ? `Fix PR #${inc.fixPrNumber} · ${inc.status}` : inc.status,
        at: inc.alarmRaisedAt,
        onClick: () => onOpenIncident(inc.id),
      });
      if (inc.purgeReceipt) {
        items.push({
          id: `purge-${inc.id}`,
          kind: "purge",
          title: `RAM purged for ${inc.id} (0 B retained)`,
          meta: `${inc.purgeReceipt.itemsPurged} items · sha256:${inc.purgeReceipt.receiptHash.slice(0, 10)}`,
          at: inc.purgeReceipt.purgedAt,
          onClick: () => onOpenIncident(inc.id),
        });
      }
    }

    for (const scan of scans.slice(0, 3)) {
      items.push({
        id: `scan-${scan.id}`,
        kind: "scan",
        title: `Security gate ${scan.verdictKind.toLowerCase()} on ${scan.branch}`,
        meta: scan.prNumber ? `PR #${scan.prNumber} · ${scan.durationMs}ms` : `${scan.durationMs}ms`,
        at: scan.createdAt,
        onClick: onOpenSecurity,
      });
    }

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
  }, [incidents, scans, onOpenIncident, onOpenSecurity]);

  return (
    <div className="space-y-6">
      {/* TOP HALF: Real-Services 3D Stack + Active Incident / Health Summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_0.85fr]">
        {/* Left: 3D Service Stack Card */}
        <div className="relative h-[430px] overflow-hidden rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <ArchitectureScene
            hoveredServiceId={hoveredSlot}
            selectedServiceId={selectedSlot}
            layerHealth={layerHealth}
            onHoverService={setHoveredSlot}
            onSelectService={(id) => {
              setSelectedSlot(id);
              setHoveredSlot(null);
            }}
          />

          {/* Compact Hover Tooltip (Real Data Only) */}
          {!selected && hovered && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 w-60 rounded-lg border border-[#EAE2D9] bg-white/95 p-3 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12.5px] font-semibold text-[#181614]">
                  {hovered.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium",
                    hovered.health === "CRITICAL"
                      ? "bg-[#FEF2F2] text-[#B91C1C]"
                      : hovered.health === "DEGRADED"
                        ? "bg-[#FFFBEB] text-[#B45309]"
                        : "bg-[#F0FDF4] text-[#15803D]",
                  )}
                >
                  {hovered.health}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] text-[#665E56]">{hovered.role}</p>
              {typeof hovered.p95LatencyMs === "number" && hovered.p95LatencyMs > 0 && (
                <p className="mt-1 font-mono text-[11px] text-[#78716C] tabular-nums">
                  p95 {hovered.p95LatencyMs}ms · 5xx {(hovered.errorRate5xx ?? 0) * 100}%
                </p>
              )}
            </div>
          )}

          {/* Subtle bottom-left legend hint */}
          {!selected && (
            <div className="pointer-events-none absolute bottom-3 left-4 z-10 font-mono text-[11px] text-[#78716C]">
              Click any service slab to inspect live health
            </div>
          )}

          {/* Slide-in Real Data Service Sheet */}
          {selected && (
            <aside
              aria-label={`${selected.label} details`}
              className="absolute inset-y-3 right-3 z-20 flex w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-[#EAE2D9] bg-white shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-[#EFE8E0] px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-mono text-[13.5px] font-semibold text-[#181614]">
                    {selected.label}
                  </h2>
                  <p className="truncate text-[12px] text-[#665E56]">{selected.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78716C] hover:bg-[#F4EFE9] hover:text-[#181614] cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-[12.5px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <div className="text-[11px] text-[#78716C]">Status</div>
                    <div className="mt-0.5 font-mono font-semibold text-[#181614]">
                      {selected.health}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <div className="text-[11px] text-[#78716C]">
                      {selected.version ? "Branch / Version" : "Last check"}
                    </div>
                    <div className="mt-0.5 truncate font-mono font-semibold text-[#181614]">
                      {selected.version || formatRelative(selected.lastCheckedAt)}
                    </div>
                  </div>
                </div>

                {selected.url && (
                  <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <div className="text-[11px] text-[#78716C]">Health endpoint</div>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 break-all font-mono text-[11.5px] text-[#B83B00] hover:underline"
                    >
                      <span>{selected.url}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  </div>
                )}

                {selected.serviceKey === "signals" ? (
                  <div className="space-y-2">
                    <p className="text-[#5C5650]">
                      {project.capabilities.activeSignalsCount} of{" "}
                      {project.capabilities.totalSignalsCount} signals are reporting live.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenSignals}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#FF5500] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#E04B00] cursor-pointer"
                    >
                      <span>Configure missing signals</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ) : selected.serviceKey === "repo" ? (
                  <div className="space-y-2">
                    {scans[0] ? (
                      <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] p-3">
                        <div className="flex items-center justify-between font-mono text-[11.5px]">
                          <span>{scans[0].branch}</span>
                          <span className="font-semibold text-[#181614]">
                            {scans[0].verdictKind}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#5C5650]">
                          {scans[0].githubCheckRun.title}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[#665E56]">No security scans recorded yet.</p>
                    )}
                    <button
                      type="button"
                      onClick={onOpenSecurity}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#B83B00] hover:underline cursor-pointer"
                    >
                      <span>View security gate</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ) : selectedIncidents.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11.5px] font-medium text-[#78716C]">
                      Incidents on this service
                    </div>
                    {selectedIncidents.slice(0, 3).map((inc) => (
                      <button
                        key={inc.id}
                        type="button"
                        onClick={() => onOpenIncident(inc.id)}
                        className="w-full rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-2.5 text-left transition-colors hover:border-[#FF5500]/50 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#78716C]">
                          <span>{inc.id}</span>
                          <span>{inc.status}</span>
                        </div>
                        <div className="mt-0.5 font-medium text-[#181614]">{inc.title}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#665E56]">No open incidents on this service.</p>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Right: Single Compact Active Incident / Health Card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          {openIncident && (
            <BorderBeam size={110} duration={8} colorFrom="#FF5500" colorTo="#FDBA74" />
          )}

          {openIncident ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3EB] px-2.5 py-0.5 font-mono text-[11.5px] font-semibold text-[#B83B00] border border-[#FBD3B7]">
                    <AlertTriangle size={12} aria-hidden="true" />
                    Active incident
                  </span>
                  <span className="font-mono text-[12px] text-[#78716C]">
                    {formatRelative(openIncident.alarmRaisedAt)}
                  </span>
                </div>

                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#181614]">
                    {openIncident.title}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#5C5650]">
                    {openIncident.diagnosisSummary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <div className="text-[11px] text-[#78716C]">Service</div>
                    <div className="mt-0.5 font-mono text-[13px] font-semibold text-[#181614]">
                      {openIncident.service}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <div className="text-[11px] text-[#78716C]">Diagnosed in</div>
                    <div className="mt-0.5 font-mono text-[13px] font-semibold text-[#181614]">
                      <NumberTicker
                        value={Number((openIncident.timeToDiagnosisMs / 1000).toFixed(1))}
                        decimalPlaces={1}
                        className="text-[#181614]"
                      />
                      s
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#F0E9E1] pt-4">
                <button
                  type="button"
                  onClick={() => onOpenIncident(openIncident.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#FF5500] px-3.5 text-[13px] font-medium text-white hover:bg-[#E04B00] cursor-pointer"
                >
                  <span>Review fix</span>
                  <ArrowRight size={14} />
                </button>
                {openIncident.fixPrUrl && (
                  <a
                    href={openIncident.fixPrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E5DCD2] bg-white px-3 text-[13px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
                  >
                    <GitPullRequest size={13} />
                    <span>PR #{openIncident.fixPrNumber}</span>
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#15803D]">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span className="text-[15px] font-semibold text-[#181614]">
                    All services healthy
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[#5C5650]">
                  {latestIncident
                    ? `Last incident (${latestIncident.id}) was diagnosed in ${(latestIncident.timeToDiagnosisMs / 1000).toFixed(1)}s and resolved ${formatRelative(latestIncident.alarmRaisedAt)}.`
                    : "Patch-Up is listening in push-on-break mode. When a service throws a 5xx spike or unhandled exception, it pushes its recent logs for instant diagnosis."}
                </p>

                <div className="space-y-2 pt-1 text-[12.5px]">
                  <div className="flex items-center justify-between rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[#5C5650]">
                      <Lock size={13} className="text-[#15803D]" aria-hidden="true" />
                      RAM retained
                    </span>
                    <span className="font-mono font-semibold text-[#15803D] tabular-nums">
                      0 B ({ephemeralTotalPurged} purged)
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#F0E9E1] bg-[#FAF8F5] px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[#5C5650]">
                      <ShieldCheck size={13} className="text-[#78716C]" aria-hidden="true" />
                      Signals active
                    </span>
                    <button
                      type="button"
                      onClick={onOpenSignals}
                      className="font-mono font-semibold text-[#181614] hover:text-[#FF5500] cursor-pointer tabular-nums"
                    >
                      {project.capabilities.activeSignalsCount} /{" "}
                      {project.capabilities.totalSignalsCount} →
                    </button>
                  </div>
                </div>
              </div>

              {latestIncident && (
                <div className="mt-5 border-t border-[#F0E9E1] pt-4">
                  <button
                    type="button"
                    onClick={() => onOpenIncident(latestIncident.id)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B83B00] hover:underline cursor-pointer"
                  >
                    <span>Inspect latest fix ({latestIncident.id})</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MIDDLE ROW: 3 Real Bklit Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Error Rate AreaChart */}
        <div className="rounded-xl border border-[#EAE2D9] bg-white p-4 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold text-[#181614]">Error rate (5xx %)</h3>
            <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
              {timeSeriesData.length > 0
                ? `${timeSeriesData[timeSeriesData.length - 1].errorRate}%`
                : "5m probe"}
            </span>
          </div>
          {timeSeriesData.length >= 2 ? (
            <AreaChart
              data={timeSeriesData}
              aspectRatio="16 / 9"
              margin={{ top: 12, right: 12, bottom: 26, left: 24 }}
            >
              <Grid horizontal />
              <Area dataKey="errorRate" stroke="#FF5500" fill="#FF5500" fillOpacity={0.18} />
              <XAxis numTicks={4} />
              <ChartTooltip />
            </AreaChart>
          ) : (
            <div className="flex h-[165px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
              <span className="font-mono text-[12px] font-medium text-[#5C5650]">
                Collecting probe history
              </span>
              <span className="mt-1 text-[11.5px] text-[#78716C]">
                First 2 points appear after two 5-minute probes (or click Re-check in Signals).
              </span>
            </div>
          )}
        </div>

        {/* 2. p95 Latency LineChart */}
        <div className="rounded-xl border border-[#EAE2D9] bg-white p-4 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold text-[#181614]">p95 latency (ms)</h3>
            <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
              {timeSeriesData.length > 0
                ? `${timeSeriesData[timeSeriesData.length - 1].latencyMs}ms`
                : "5m probe"}
            </span>
          </div>
          {timeSeriesData.length >= 2 ? (
            <LineChart
              data={timeSeriesData}
              aspectRatio="16 / 9"
              margin={{ top: 12, right: 12, bottom: 26, left: 28 }}
            >
              <Grid horizontal />
              <Line dataKey="latencyMs" stroke="#181614" strokeWidth={2} />
              <XAxis numTicks={4} />
              <ChartTooltip />
            </LineChart>
          ) : (
            <div className="flex h-[165px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
              <span className="font-mono text-[12px] font-medium text-[#5C5650]">
                Collecting latency baseline
              </span>
              <span className="mt-1 text-[11.5px] text-[#78716C]">
                Recorded from live /health and /api/telemetry probes.
              </span>
            </div>
          )}
        </div>

        {/* 3. Diagnosis Time per Incident BarChart */}
        <div className="rounded-xl border border-[#EAE2D9] bg-white p-4 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold text-[#181614]">Diagnosis time (s)</h3>
            <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
              {incidents.length} {incidents.length === 1 ? "incident" : "incidents"}
            </span>
          </div>
          {diagnosisBarData.length > 0 ? (
            <BarChart
              data={diagnosisBarData}
              xDataKey="name"
              barWidth={36}
              aspectRatio="16 / 9"
              margin={{ top: 12, right: 12, bottom: 26, left: 24 }}
            >
              <Grid horizontal />
              <Bar dataKey="ttdSec" fill="#FF5500" lineCap="round" />
              <BarXAxis />
              <ChartTooltip />
            </BarChart>
          ) : (
            <div className="flex h-[165px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
              <span className="font-mono text-[12px] font-medium text-[#5C5650]">
                No incidents recorded
              </span>
              <span className="mt-1 text-[11.5px] text-[#78716C]">
                Time-to-diagnosis bars populate automatically when an alert fires.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM: Recent Activity List */}
      <section className="rounded-xl border border-[#EAE2D9] bg-white shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        <div className="border-b border-[#EFE8E0] px-5 py-3">
          <h3 className="text-[13.5px] font-semibold text-[#181614]">Recent activity</h3>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#78716C]">
            No activity recorded for this project yet.
          </div>
        ) : (
          <div className="divide-y divide-[#F0E9E1]">
            {activity.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-[#FAF8F5] cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[#181614]">
                    {item.title}
                  </div>
                  <div className="truncate font-mono text-[11.5px] text-[#78716C]">
                    {item.meta}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[11.5px] text-[#78716C] tabular-nums">
                  {formatRelative(item.at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
