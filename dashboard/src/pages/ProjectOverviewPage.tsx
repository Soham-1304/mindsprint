import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CreditCard,
  GitPullRequest,
  Globe,
  Lock,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";
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
  onOpenArchitecture: () => void;
  onOpenIncident: (incidentId: string) => void;
  onOpenSignals: () => void;
  onOpenSecurity: () => void;
}

function formatRelative(iso?: string): string {
  if (!iso) return "just now";
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function ServiceIcon({ name }: { name: string }) {
  if (name.includes("gateway")) return <Globe size={15} />;
  if (name.includes("payment")) return <CreditCard size={15} />;
  return <Package size={15} />;
}

export function ProjectOverviewPage({
  project,
  services,
  incidents,
  scans,
  probeHistory,
  ephemeralTotalPurged,
  onOpenArchitecture,
  onOpenIncident,
  onOpenSignals,
  onOpenSecurity,
}: ProjectOverviewPageProps) {
  const openIncident = incidents.find((i) => i.status !== "RESOLVED");
  const latestIncident = incidents[0];

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

  const activity = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      meta: string;
      at: string;
      onClick?: () => void;
    }> = [];

    for (const inc of incidents.slice(0, 4)) {
      items.push({
        id: `inc-${inc.id}`,
        title: `${inc.service}: ${inc.title}`,
        meta: inc.fixPrNumber ? `Fix PR #${inc.fixPrNumber} · ${inc.status}` : inc.status,
        at: inc.alarmRaisedAt,
        onClick: () => onOpenIncident(inc.id),
      });
      if (inc.purgeReceipt) {
        items.push({
          id: `purge-${inc.id}`,
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

  const latestTtdSec = latestIncident
    ? Number((latestIncident.timeToDiagnosisMs / 1000).toFixed(1))
    : 0;
  const blockedScansCount = scans.filter((s) => s.blocked).length;

  return (
    <div className="space-y-6">
      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className="rounded-xl border border-[#EAE2D9] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="text-[11.5px] font-medium text-[#78716C]">System health</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                openIncident ? "bg-[#FF5500]" : "bg-[#15803D]",
              )}
            />
            <span className="font-mono text-[16px] font-semibold text-[#181614]">
              {openIncident ? "1 Open Alert" : "All Healthy"}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#78716C]">
            {services.length || 3} live microservices
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSignals}
          className="rounded-xl border border-[#EAE2D9] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(24,22,20,0.04)] transition-colors hover:border-[#FBD3B7] cursor-pointer"
        >
          <div className="text-[11.5px] font-medium text-[#78716C]">Live signals</div>
          <div className="mt-1 font-mono text-[16px] font-semibold text-[#181614] tabular-nums">
            {project.capabilities.activeSignalsCount} / {project.capabilities.totalSignalsCount}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#15803D]">
            {project.capabilities.accuracyLevel} coverage →
          </div>
        </button>

        <div className="rounded-xl border border-[#EAE2D9] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="text-[11.5px] font-medium text-[#78716C]">RAM retained</div>
          <div className="mt-1 font-mono text-[16px] font-semibold text-[#15803D] tabular-nums">
            0 B
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#78716C] tabular-nums">
            {ephemeralTotalPurged} buffers cryptographically purged
          </div>
        </div>

        <button
          type="button"
          onClick={latestIncident ? () => onOpenIncident(latestIncident.id) : onOpenSecurity}
          className="rounded-xl border border-[#EAE2D9] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(24,22,20,0.04)] transition-colors hover:border-[#FBD3B7] cursor-pointer"
        >
          <div className="text-[11.5px] font-medium text-[#78716C]">Latest diagnosis</div>
          <div className="mt-1 font-mono text-[16px] font-semibold text-[#181614] tabular-nums">
            {latestIncident ? (
              <>
                <NumberTicker value={latestTtdSec} decimalPlaces={1} />s
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#B83B00]">
            {blockedScansCount} PR threats blocked →
          </div>
        </button>
      </div>

      {/* TOP ROW: Live Status / Active Incident + Monitored Services Summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Active Incident / Health Card */}
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
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5C5650]">
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
                    : "Patch-Up is listening in push-on-break mode. When a service faults, it pushes its recent logs for instant diagnosis."}
                </p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 text-[12.5px]">
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
                      Signals
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

        {/* Monitored Services + Jump to 3D Architecture */}
        <div className="flex flex-col justify-between rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0E9E1]">
              <h3 className="text-[13.5px] font-semibold text-[#181614]">Monitored services</h3>
              <button
                type="button"
                onClick={onOpenArchitecture}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#B83B00] hover:underline cursor-pointer"
              >
                <Boxes size={13} />
                <span>Open 3D Architecture →</span>
              </button>
            </div>

            <div className="mt-3 divide-y divide-[#F0E9E1]">
              {(services.length > 0
                ? services
                : [
                    {
                      id: "gateway-service",
                      name: "gateway",
                      url: project.deployedUrl || "",
                      status: project.capabilities.healthEndpoint ? "HEALTHY" : "DEGRADED",
                      errorRate5xx: 0,
                      p95LatencyMs: 0,
                      throughputRpm: 0,
                      version: project.defaultBranch,
                      lastCheckedAt: project.capabilities.checkedAt,
                    },
                  ]
              ).map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={onOpenArchitecture}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-[#FAF8F5] rounded-md px-1.5 transition-colors cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#EFE8E0] bg-[#FAF8F5] text-[#5C5650]">
                      <ServiceIcon name={svc.name} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12.5px] font-semibold text-[#181614]">
                        {svc.name}-service
                      </div>
                      <div className="truncate font-mono text-[11px] text-[#78716C]">
                        {svc.p95LatencyMs > 0 ? `p95 ${svc.p95LatencyMs}ms` : svc.version}
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                      svc.status === "DOWN"
                        ? "bg-[#FEF2F2] text-[#B91C1C]"
                        : svc.status === "DEGRADED"
                          ? "bg-[#FFFBEB] text-[#B45309]"
                          : "bg-[#F0FDF4] text-[#15803D]",
                    )}
                  >
                    {svc.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE ROW: 3 Full-Space Real Bklit Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            <div className="flex h-[175px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
              <span className="font-mono text-[12px] font-medium text-[#5C5650]">
                Collecting probe history
              </span>
              <span className="mt-1 text-[11.5px] text-[#78716C]">
                First 2 points appear after two 5-minute probes.
              </span>
            </div>
          )}
        </div>

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
            <div className="flex h-[175px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
              <span className="font-mono text-[12px] font-medium text-[#5C5650]">
                Collecting latency baseline
              </span>
              <span className="mt-1 text-[11.5px] text-[#78716C]">
                Recorded from live /health and /api/telemetry probes.
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#EAE2D9] bg-white p-4 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold text-[#181614]">Diagnosis time (s)</h3>
            <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
              {incidents.length} {incidents.length === 1 ? "incident" : "incidents"}
            </span>
          </div>
          {diagnosisBarData.length > 0 ? (
            <div className="mx-auto max-w-[260px]">
              <BarChart
                data={diagnosisBarData}
                xDataKey="name"
                barWidth={32}
                aspectRatio="16 / 10"
                margin={{ top: 14, right: 16, bottom: 26, left: 24 }}
              >
                <Grid horizontal />
                <Bar dataKey="ttdSec" fill="#FF5500" lineCap="round" />
                <BarXAxis />
                <ChartTooltip />
              </BarChart>
            </div>
          ) : (
            <div className="flex h-[175px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] px-4 text-center">
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

      {/* BOTTOM: Recent Activity */}
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
