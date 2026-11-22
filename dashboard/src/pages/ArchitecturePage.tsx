import {
  Activity,
  ArrowRight,
  CreditCard,
  ExternalLink,
  GitBranch,
  Globe,
  Package,
  Radio,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArchitectureScene } from "@/components/3d/ArchitectureScene";
import type { LayerHealthState, RealTowerSlot, TowerNodeId } from "@/components/3d/types";
import { cn } from "@/lib/utils";
import type {
  IncidentRecord,
  LinkedProject,
  ProjectServiceInfo,
  SietchPrScanResult,
} from "@/types";

interface ArchitecturePageProps {
  project: LinkedProject;
  services: ProjectServiceInfo[];
  incidents: IncidentRecord[];
  scans: SietchPrScanResult[];
  apiBase: string;
  onOpenIncident: (incidentId: string) => void;
  onOpenSignals: () => void;
  onOpenSecurity: () => void;
}

type LayerInspectorTab = "logs" | "incidents" | "health";

function SlotDomainIcon({ slotId, className }: { slotId: TowerNodeId; className?: string }) {
  switch (slotId) {
    case "ai-engine":
      return <GitBranch size={15} className={className} />;
    case "backend-service":
      return <Package size={15} className={className} />;
    case "gateway-service":
      return <Globe size={15} className={className} />;
    case "frontend-service":
      return <CreditCard size={15} className={className} />;
    case "git-sep":
      return <Radio size={15} className={className} />;
  }
}

function mapServiceHealth(status?: string): LayerHealthState {
  if (status === "DOWN") return "CRITICAL";
  if (status === "DEGRADED") return "DEGRADED";
  return "HEALTHY";
}

export function ArchitecturePage({
  project,
  services,
  incidents,
  scans,
  apiBase,
  onOpenIncident,
  onOpenSignals,
  onOpenSecurity,
}: ArchitecturePageProps) {
  const [hoveredSlot, setHoveredSlot] = useState<TowerNodeId | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TowerNodeId | null>(null);
  const [inspectorTab, setInspectorTab] = useState<LayerInspectorTab>("logs");
  const [layerLogs, setLayerLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedSlot) setSelectedSlot(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSlot]);

  const slots = useMemo<Record<TowerNodeId, RealTowerSlot>>(() => {
    const findSvc = (key: string) =>
      services.find((s) => s.name === key || s.id === `${key}-service`);

    const gateway = findSvc("gateway");
    const orders = findSvc("orders");
    const payments = findSvc("payments");

    const openInc = incidents.filter((i) => i.status !== "RESOLVED");
    const latestScan = scans[0];
    const activeSignals = project.capabilities.activeSignalsCount;

    return {
      "ai-engine": {
        slotId: "ai-engine",
        serviceKey: "repo",
        label: project.fullName,
        role: latestScan
          ? `Security gate: ${latestScan.verdictKind} (${latestScan.branch})`
          : "GitHub repository & pre-merge gate",
        health: latestScan?.blocked ? "DEGRADED" : "HEALTHY",
        version: project.defaultBranch,
        lastCheckedAt: latestScan?.createdAt,
      },
      "backend-service": {
        slotId: "backend-service",
        serviceKey: "orders",
        label: orders ? `${orders.name}-service` : "orders-service",
        role: orders?.url || "Orders microservice",
        url: orders?.url,
        health: openInc.some((i) => i.service === "orders")
          ? "CRITICAL"
          : mapServiceHealth(orders?.status),
        errorRate5xx: orders?.errorRate5xx,
        p95LatencyMs: orders?.p95LatencyMs,
        version: orders?.version,
        lastCheckedAt: orders?.lastCheckedAt,
      },
      "gateway-service": {
        slotId: "gateway-service",
        serviceKey: "gateway",
        label: gateway ? `${gateway.name}-service` : "gateway-service",
        role: gateway?.url || project.deployedUrl || "API Gateway",
        url: gateway?.url || project.deployedUrl,
        health: openInc.some((i) => i.service === "gateway")
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
        role: payments?.url || "Payments microservice",
        url: payments?.url,
        health: openInc.some((i) => i.service === "payments")
          ? "CRITICAL"
          : mapServiceHealth(payments?.status),
        errorRate5xx: payments?.errorRate5xx,
        p95LatencyMs: payments?.p95LatencyMs,
        version: payments?.version,
        lastCheckedAt: payments?.lastCheckedAt,
      },
      "git-sep": {
        slotId: "git-sep",
        serviceKey: "signals",
        label: "Telemetry & push hooks",
        role: `${activeSignals}/${project.capabilities.totalSignalsCount} signals active`,
        health: activeSignals >= 4 ? "HEALTHY" : "DEGRADED",
        lastCheckedAt: project.capabilities.checkedAt,
      },
    };
  }, [project, services, incidents, scans]);

  const layerHealth = useMemo<Record<string, LayerHealthState>>(
    () => ({
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
    }),
    [slots],
  );

  const selected = selectedSlot ? slots[selectedSlot] : null;
  const hovered = hoveredSlot ? slots[hoveredSlot] : null;

  useEffect(() => {
    if (!selected) {
      setLayerLogs([]);
      return;
    }
    const serviceIdMap: Record<string, string> = {
      orders: "orders-service",
      gateway: "gateway-service",
      payments: "payments-service",
    };
    const backendSvcId = serviceIdMap[selected.serviceKey];
    if (!backendSvcId) {
      setLayerLogs([]);
      return;
    }
    let cancelled = false;
    setLoadingLogs(true);
    fetch(`${apiBase}/api/logs/${encodeURIComponent(backendSvcId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { logs?: string[] } | null) => {
        if (!cancelled) {
          setLayerLogs(Array.isArray(json?.logs) ? json.logs.slice(-40).reverse() : []);
        }
      })
      .catch(() => {
        if (!cancelled) setLayerLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLogs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, selected]);

  const selectedIncidents = selected
    ? incidents.filter((i) => i.service === selected.serviceKey)
    : [];

  return (
    <div className="relative h-[calc(100dvh-89px)] min-h-[600px] w-full overflow-hidden bg-[#FAF8F5]">
      {/* Full, Open 3D Chip Tower Stage (zero side rails) */}
      <div className="absolute inset-0">
        <ArchitectureScene
          hoveredServiceId={hoveredSlot}
          selectedServiceId={selectedSlot}
          layerHealth={layerHealth}
          onHoverService={setHoveredSlot}
          onSelectService={(id) => {
            setSelectedSlot(id);
            setHoveredSlot(null);
            setInspectorTab("logs");
          }}
        />
      </div>

      {/* Subtle Bottom Hint when idle */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-10 rounded-full border border-[#EAE2D9] bg-white/90 px-3.5 py-1.5 font-mono text-[11.5px] text-[#665E56] shadow-xs">
          Click any chip in the stack to inspect live logs &amp; health
        </div>
      )}

      {/* Compact Hover Tooltip */}
      {!selected && hovered && (
        <div className="pointer-events-none absolute right-7 top-6 z-10 w-64 rounded-xl border border-[#EAE2D9] bg-white/95 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <SlotDomainIcon slotId={hovered.slotId} className="shrink-0 text-[#FF5500]" />
              <span className="truncate font-mono text-[12.5px] font-semibold text-[#181614]">
                {hovered.label}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
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
        </div>
      )}

      {/* Floating Compact Popup Card on the Right (chip extracts cleanly to the Left!) */}
      {selected && (
        <aside
          aria-label={`${selected.label} details`}
          className="absolute right-8 top-1/2 z-20 flex w-[min(430px,calc(100%-32px))] max-h-[76%] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#E5DCD2] bg-white shadow-[0_24px_56px_rgba(24,22,20,0.12)]"
        >
          {/* Popup Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#EFE8E0] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FBD3B7] bg-[#FFF5EE] text-[#FF5500]">
                <SlotDomainIcon slotId={selected.slotId} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-mono text-[14px] font-semibold text-[#181614]">
                    {selected.label}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold",
                      selected.health === "CRITICAL"
                        ? "bg-[#FEF2F2] text-[#B91C1C]"
                        : selected.health === "DEGRADED"
                          ? "bg-[#FFFBEB] text-[#B45309]"
                          : "bg-[#F0FDF4] text-[#15803D]",
                    )}
                  >
                    {selected.health}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[#665E56]">{selected.role}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSlot(null)}
              aria-label="Close layer popup"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78716C] hover:bg-[#F4EFE9] cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* 3 Compact Tabs */}
          <div className="grid grid-cols-3 gap-1 border-b border-[#EFE8E0] bg-[#FAF8F5] px-4 py-2">
            {(
              [
                { id: "logs", label: "Live logs", icon: Terminal },
                { id: "incidents", label: "Incidents", icon: ShieldCheck },
                { id: "health", label: "Health", icon: Activity },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setInspectorTab(t.id)}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] transition-colors cursor-pointer",
                  inspectorTab === t.id
                    ? "bg-white font-semibold text-[#181614] shadow-xs border border-[#EAE2D9]"
                    : "font-medium text-[#665E56] hover:text-[#181614]",
                )}
              >
                <t.icon size={12} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Auto-sized Scrollable Body */}
          <div className="overflow-y-auto p-4 text-[12.5px]">
            {inspectorTab === "logs" && (
              <div className="space-y-3">
                {selected.serviceKey === "repo" ? (
                  scans.length > 0 ? (
                    scans.slice(0, 4).map((scan) => (
                      <div
                        key={scan.id}
                        className="rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-3"
                      >
                        <div className="flex items-center justify-between font-mono text-[11.5px]">
                          <span className="font-semibold text-[#181614]">
                            {scan.branch} {scan.prNumber ? `· #${scan.prNumber}` : ""}
                          </span>
                          <span className={scan.blocked ? "text-[#B91C1C]" : "text-[#15803D]"}>
                            {scan.verdictKind}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#5C5650]">
                          {scan.githubCheckRun.title}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] p-4 text-[#665E56]">
                      No pre-merge security scans logged yet.
                    </div>
                  )
                ) : selected.serviceKey === "signals" ? (
                  <div className="space-y-2.5">
                    <p className="text-[#5C5650]">
                      Zero raw logs stored at rest. Scrubbed error bundles arrive only on break and
                      purge from RAM after PR creation.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenSignals}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#FF5500] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#E04B00] cursor-pointer"
                    >
                      <span>Open Signals &amp; setup</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ) : loadingLogs ? (
                  <div className="py-5 text-center font-mono text-[12px] text-[#78716C]">
                    Loading live logs for {selected.label}...
                  </div>
                ) : layerLogs.length > 0 ? (
                  <div className="divide-y divide-[#F0E9E1] overflow-hidden rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] font-mono text-[11.5px]">
                    {layerLogs.slice(0, 12).map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-3 py-2 break-all leading-relaxed",
                          /error|5xx|malicious|fail|exception/i.test(line)
                            ? "bg-[#FEF2F2]/70 text-[#991B1B]"
                            : "text-[#3F3A35]",
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : selectedIncidents[0]?.topFrame ? (
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] text-[#78716C]">
                      Latest scrubbed stack trace
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-[#EAE2D9] bg-[#FAF8F5] p-3 font-mono text-[11.5px] text-[#991B1B]">
                      {`${selectedIncidents[0].topFrame.error}\n  at ${selectedIncidents[0].topFrame.function} (${selectedIncidents[0].topFrame.file}:${selectedIncidents[0].topFrame.line})`}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] p-4 text-[#665E56]">
                    No recent error logs in volatile memory for {selected.label}.
                  </div>
                )}
              </div>
            )}

            {inspectorTab === "incidents" && (
              <div className="space-y-2.5">
                {selected.serviceKey === "repo" ? (
                  <button
                    type="button"
                    onClick={onOpenSecurity}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#B83B00] hover:underline cursor-pointer"
                  >
                    <span>Open full Security gate table</span>
                    <ArrowRight size={13} />
                  </button>
                ) : selectedIncidents.length > 0 ? (
                  selectedIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => onOpenIncident(inc.id)}
                      className="w-full rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-3.5 text-left transition-colors hover:border-[#FF5500]/50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] text-[#78716C]">
                        <span>
                          {inc.id} · {inc.ruleId}
                        </span>
                        <span className="font-semibold text-[#181614]">{inc.status}</span>
                      </div>
                      <div className="mt-1 font-semibold text-[#181614]">{inc.title}</div>
                      <p className="mt-1 line-clamp-2 text-[12px] text-[#5C5650]">
                        {inc.diagnosisSummary}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] p-4 text-[#665E56]">
                    No incidents recorded on {selected.label}.
                  </div>
                )}
              </div>
            )}

            {inspectorTab === "health" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3">
                    <div className="text-[11px] text-[#78716C]">p95 latency</div>
                    <div className="mt-0.5 font-mono text-[14px] font-semibold text-[#181614]">
                      {typeof selected.p95LatencyMs === "number"
                        ? `${selected.p95LatencyMs}ms`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3">
                    <div className="text-[11px] text-[#78716C]">5xx rate</div>
                    <div className="mt-0.5 font-mono text-[14px] font-semibold text-[#181614]">
                      {typeof selected.errorRate5xx === "number"
                        ? `${(selected.errorRate5xx * 100).toFixed(1)}%`
                        : "0.0%"}
                    </div>
                  </div>
                </div>

                {selected.version && (
                  <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3">
                    <div className="text-[11px] text-[#78716C]">Deployed version / branch</div>
                    <div className="mt-0.5 break-all font-mono text-[12px] font-medium text-[#181614]">
                      {selected.version}
                    </div>
                  </div>
                )}

                {selected.url && (
                  <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3">
                    <div className="text-[11px] text-[#78716C]">Endpoint</div>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 break-all font-mono text-[12px] text-[#B83B00] hover:underline"
                    >
                      <span>{selected.url}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
