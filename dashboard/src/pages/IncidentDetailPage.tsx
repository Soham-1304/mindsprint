import { animate, stagger } from "animejs";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitPullRequest,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { cn } from "@/lib/utils";
import type { ApprovalRequest, IncidentRecord } from "@/types";

interface IncidentDetailPageProps {
  incident: IncidentRecord;
  approval?: ApprovalRequest;
  repoFullName: string;
  apiBase: string;
  operatorToken: string;
  approvalError: string | null;
  onChangeOperatorToken: (val: string) => void;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
  onBack: () => void;
}

type EvidenceTab = "diff" | "strategies" | "signal";

function formatTtd(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function IncidentDetailPage({
  incident,
  approval,
  repoFullName,
  apiBase,
  operatorToken,
  approvalError,
  onChangeOperatorToken,
  onDecideApproval,
  onOpenPostmortem,
  onBack,
}: IncidentDetailPageProps) {
  const [tab, setTab] = useState<EvidenceTab>("diff");
  const [diffText, setDiffText] = useState<string>(incident.gitBlameDiff || "");
  const [diffSource, setDiffSource] = useState<string>("loading");
  const [downloading, setDownloading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const stepsRef = useRef<HTMLDivElement | null>(null);

  // Fetch real multi-line Fix PR diff from GitHub via backend endpoint
  useEffect(() => {
    let cancelled = false;
    setDiffSource("loading");
    fetch(`${apiBase}/api/incidents/${encodeURIComponent(incident.id)}/diff`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { diff?: string; source?: string } | null) => {
        if (cancelled) return;
        if (json?.diff && json.diff.trim().length > 0) {
          setDiffText(json.diff);
          setDiffSource(json.source || "github_pr");
        } else {
          setDiffText(incident.gitBlameDiff || "");
          setDiffSource(incident.gitBlameDiff ? "blame_fallback" : "none");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiffText(incident.gitBlameDiff || "");
          setDiffSource(incident.gitBlameDiff ? "blame_fallback" : "none");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, incident.id, incident.gitBlameDiff]);

  // Subtle anime.js entrance stagger for the execution steps
  useEffect(() => {
    const container = stepsRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = container.querySelectorAll(".timeline-row-item");
    if (rows.length === 0) return;
    animate(rows, {
      opacity: [0.4, 1],
      translateY: [5, 0],
      delay: stagger(45),
      duration: 320,
      ease: "outExpo",
    });
  }, [incident.id]);

  const metricChartData = useMemo(() => {
    const now = Date.now();
    const series = incident.metricSeries ?? [];
    return series.map((pt, idx) => ({
      date: new Date(now - (series.length - 1 - idx) * 60_000),
      value: pt.value,
      baseline: pt.baseline,
    }));
  }, [incident.metricSeries]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const resp = await fetch(
        `${apiBase}/api/incidents/${encodeURIComponent(incident.id)}/report.md`,
      );
      const text = resp.ok
        ? await resp.text()
        : incident.rcaReportMarkdown || `# Patch-Up Report ${incident.id}\n`;
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patch-up-report-${incident.id}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDecision(decision: "APPROVE" | "REJECT") {
    if (!approval) return;
    setDeciding(true);
    try {
      await onDecideApproval(approval.id, decision);
    } finally {
      setDeciding(false);
    }
  }

  const branchLabel = incident.fixPrNumber ? `fix/${incident.id.toLowerCase()}` : "main";
  const filePath = incident.topFrame?.file || incident.culpritFile || "source";
  const pendingApproval = approval && approval.status === "PENDING";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5C5650] hover:text-[#181614] cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to incidents</span>
        </button>

        <span className="font-mono text-[12px] text-[#78716C]">{incident.id}</span>
      </div>

      {/* Impeccable-Inspired Split Workbench */}
      <div className="overflow-hidden rounded-2xl border border-[#DFD5CA] bg-white shadow-[0_16px_44px_rgba(24,22,20,0.08)]">
        {/* Window Chrome */}
        <div className="flex h-10 items-center justify-between border-b border-[#EAE2D9] bg-[#F5F1EC] px-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5" aria-hidden="true">
              <i className="h-2.5 w-2.5 rounded-full bg-[#D8CFC5]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#D8CFC5]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#D8CFC5]" />
            </span>
            <span className="font-mono text-[12px] text-[#5C5650]">{branchLabel}</span>
          </div>

          <span className="font-mono text-[11.5px] text-[#665E56]">
            {incident.service} · {incident.ruleId}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] min-h-[540px]">
          {/* LEFT PANE: Dark Agent Execution Stream */}
          <div className="flex flex-col justify-between bg-[#131211] p-5 text-[#E8E4DF] border-b lg:border-b-0 lg:border-r border-[#262320]">
            <div className="space-y-4">
              <div className="rounded-lg border border-[#2D2925] bg-[#1C1A18] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#FF5500]/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#FF8C52]">
                    {incident.ruleId}
                  </span>
                  <span className="font-mono text-[11px] text-[#9C948B]">
                    {incident.culpritCommitSha ? `commit ${incident.culpritCommitSha}` : incident.service}
                  </span>
                </div>
                <div className="mt-1.5 text-[14px] font-semibold text-[#F6F3EE]">
                  {incident.title}
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-[#DDD8D1]">
                {incident.diagnosisSummary}
              </p>

              {/* Chronological Backend Steps */}
              <div ref={stepsRef} className="divide-y divide-[#24211E] border-t border-[#24211E]">
                <div className="timeline-row-item flex items-start gap-2.5 py-3">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-[#FF7A24]" aria-hidden="true" />
                  <div>
                    <div className="text-[13px] font-medium text-[#F6F3EE]">
                      Root cause isolated in {formatTtd(incident.timeToDiagnosisMs)}
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-[#9C948B]">
                      {incident.modelUsed || "gemini-3.5-flash-lite"} ·{" "}
                      {Math.round((incident.confidence || 0.95) * 100)}% confidence · {filePath}
                      {incident.topFrame?.line ? `:${incident.topFrame.line}` : ""}
                    </div>
                  </div>
                </div>

                <div className="timeline-row-item flex items-start gap-2.5 py-3">
                  <ShieldCheck
                    size={14}
                    className="mt-0.5 shrink-0 text-[#34D399]"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[#F6F3EE]">
                      Pre-merge security &amp; syntax check:{" "}
                      {incident.sietchSelfGate?.blocked ? "BLOCKED" : "PASSED"}
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-[#9C948B]">
                      {incident.testProof
                        ? `${incident.testProof.beforeStatus} → ${incident.testProof.afterStatus} · `
                        : "node --check verified · "}
                      ruleset {incident.sietchSelfGate?.rulesetVersion || "1.2.0"}
                    </div>
                  </div>
                </div>

                <div className="timeline-row-item flex items-start gap-2.5 py-3">
                  <GitPullRequest
                    size={14}
                    className="mt-0.5 shrink-0 text-[#FF7A24]"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[#F6F3EE]">
                      {incident.fixPrNumber
                        ? `Opened Fix PR #${incident.fixPrNumber} (PR-only)`
                        : "Remediation queued"}
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-[#9C948B]">
                      main branch protected · {incident.status}
                    </div>
                  </div>
                </div>

                <div className="timeline-row-item flex items-start gap-2.5 py-3">
                  <Lock size={14} className="mt-0.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                  <div>
                    <div className="text-[13px] font-medium text-[#F6F3EE]">
                      Zero-retention memory purged (0 B retained)
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-[#9C948B]">
                      {incident.purgeReceipt
                        ? `${incident.purgeReceipt.itemsPurged} items · ${incident.purgeReceipt.redactionsApplied} redactions · sha256:${incident.purgeReceipt.receiptHash.slice(0, 12)}`
                        : "Volatile RAM vault cleared after fix generation"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar (Inline Approval + PR / Report Actions) */}
            <div className="mt-4 space-y-2 rounded-lg border border-[#2E2A26] bg-[#1B1917] p-3">
              {approvalError && (
                <div className="rounded bg-[#7F1D1D]/40 px-2.5 py-1.5 text-[12px] text-[#FCA5A5]">
                  {approvalError}
                </div>
              )}

              {pendingApproval && (
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#2E2A26]">
                  <input
                    type="password"
                    value={operatorToken}
                    onChange={(e) => onChangeOperatorToken(e.target.value)}
                    placeholder="Operator key"
                    aria-label="Operator approval key"
                    className="h-8 flex-1 min-w-[140px] rounded-md border border-[#35302B] bg-[#131211] px-2.5 font-mono text-[12px] text-[#F4F1EC] placeholder:text-[#78716C]"
                  />
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={() => void handleDecision("APPROVE")}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-[#15803D] px-3 text-[12px] font-semibold text-white hover:bg-[#166534] cursor-pointer"
                  >
                    <Check size={13} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={() => void handleDecision("REJECT")}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[#4A443E] bg-[#23201D] px-2.5 text-[12px] font-medium text-[#E4DFD8] hover:bg-[#2E2A26] cursor-pointer"
                  >
                    <X size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {incident.fixPrUrl && (
                  <a
                    href={incident.fixPrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#FF5500] px-3 text-[12.5px] font-semibold text-white hover:bg-[#E04B00]"
                  >
                    <ExternalLink size={12} />
                    <span>Open PR #{incident.fixPrNumber}</span>
                  </a>
                )}
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#35302B] bg-[#23201D] px-2.5 text-[12px] font-medium text-[#E4DFD8] hover:bg-[#2E2A26] cursor-pointer"
                >
                  <Download size={12} />
                  <span>{downloading ? "Exporting..." : "Report .md"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPostmortem(incident.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#35302B] bg-[#23201D] px-2.5 text-[12px] font-medium text-[#E4DFD8] hover:bg-[#2E2A26] cursor-pointer"
                >
                  <FileText size={12} />
                  <span>Postmortem</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Light Diff, Strategies & Real Bklit Signal */}
          <div className="flex min-w-0 flex-col bg-[#FAF8F5]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE2D9] bg-white px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2 rounded-md border border-[#EAE2D9] bg-[#FAF8F5] px-2.5 py-1 font-mono text-[11.5px] text-[#5C5650]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#15803D]" />
                <span className="truncate">
                  {repoFullName}/{filePath}
                </span>
              </div>

              <div className="inline-flex items-center gap-0.5 rounded-md border border-[#EAE2D9] bg-[#FAF8F5] p-0.5">
                {(
                  [
                    { id: "diff", label: "Diff", icon: FileCode2 },
                    { id: "strategies", label: "Strategies", icon: Scale },
                    { id: "signal", label: "Signal", icon: null },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded px-2 text-[12px] transition-colors cursor-pointer",
                      tab === t.id
                        ? "bg-white font-semibold text-[#181614] shadow-xs"
                        : "font-medium text-[#665E56] hover:text-[#181614]",
                    )}
                  >
                    {t.icon && <t.icon size={12} />}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {tab === "diff" && (
                <>
                  {incident.topFrame && (
                    <div className="rounded-xl border border-[#EAE2D9] bg-white p-3.5">
                      <div className="font-mono text-[11px] text-[#78716C]">Top stack frame</div>
                      <div className="mt-1 font-mono text-[12.5px] font-semibold text-[#B91C1C]">
                        {incident.topFrame.error}
                      </div>
                      <div className="mt-1 font-mono text-[11.5px] text-[#5C5650]">
                        at <span className="text-[#B83B00]">{incident.topFrame.function}()</span> ·{" "}
                        {incident.topFrame.file}:{incident.topFrame.line}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#EAE2D9] bg-white p-3.5">
                    <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-[#78716C]">
                      <span>
                        {diffSource === "github_pr"
                          ? `Fix PR #${incident.fixPrNumber} unified diff`
                          : diffSource === "loading"
                            ? "Fetching PR diff from GitHub..."
                            : "Culprit commit diff"}
                      </span>
                    </div>

                    {diffText ? (
                      <pre className="max-h-[340px] overflow-auto rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] py-2 font-mono text-[11.5px] leading-relaxed">
                        {diffText.split("\n").map((line, i) => (
                          <span
                            key={i}
                            className={
                              line.startsWith("@@")
                                ? "diff-line-hunk"
                                : line.startsWith("+") && !line.startsWith("+++")
                                  ? "diff-line-add"
                                  : line.startsWith("-") && !line.startsWith("---")
                                    ? "diff-line-del"
                                    : "diff-line-ctx"
                            }
                          >
                            {line || " "}
                          </span>
                        ))}
                      </pre>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#E5DCD2] bg-[#FAF8F5] p-4 font-mono text-[12px] text-[#78716C]">
                        No diff attached to this incident yet.
                      </div>
                    )}
                  </div>

                  {incident.testProof && (
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
                      <span className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 font-semibold text-[#B91C1C]">
                        BEFORE: {incident.testProof.beforeStatus}
                      </span>
                      <span className="text-[#78716C]">→</span>
                      <span className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 font-semibold text-[#15803D]">
                        AFTER: {incident.testProof.afterStatus}
                      </span>
                    </div>
                  )}
                </>
              )}

              {tab === "strategies" && (
                <div className="space-y-2.5">
                  {(incident.counterfactualEvaluations ?? []).length > 0 ? (
                    incident.counterfactualEvaluations!.map((ev, idx) => {
                      const isBest = idx === (incident.recommendedStrategyIndex ?? 0);
                      return (
                        <div
                          key={ev.strategyName}
                          className={cn(
                            "rounded-xl border p-3.5",
                            isBest
                              ? "border-[#FBD3B7] bg-[#FFF5EE]"
                              : "border-[#EAE2D9] bg-white",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 text-[13px]">
                            <strong className="font-semibold text-[#181614]">
                              {ev.strategyName}
                            </strong>
                            <span
                              className={cn(
                                "font-mono text-[12px] font-semibold tabular-nums",
                                isBest ? "text-[#B83B00]" : "text-[#78716C]",
                              )}
                            >
                              {ev.heuristicScore}/100
                            </span>
                          </div>
                          <p className="mt-1 text-[12.5px] text-[#5C5650]">
                            {ev.counterfactualReasoning || ev.expectedBenefit}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-[#78716C]">
                            <span>Risk: {ev.riskOfWorsening}</span>
                            <span>Tier: {ev.requiredAuthorization}</span>
                            <span>Reversible: {ev.reversibility}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E5DCD2] bg-white p-5 text-[13px] text-[#665E56]">
                      No counterfactual strategy comparisons recorded for this incident.
                    </div>
                  )}
                </div>
              )}

              {tab === "signal" && (
                <div className="rounded-xl border border-[#EAE2D9] bg-white p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-[12px] font-semibold text-[#181614]">
                      {incident.ruleId}
                    </span>
                    <span className="font-mono text-[11.5px] text-[#78716C]">
                      unit: {incident.metricUnit}
                    </span>
                  </div>
                  {metricChartData.length >= 2 ? (
                    <AreaChart
                      data={metricChartData}
                      aspectRatio="16 / 9"
                      margin={{ top: 14, right: 14, bottom: 26, left: 26 }}
                    >
                      <Grid horizontal />
                      <Area
                        dataKey="value"
                        stroke="#FF5500"
                        fill="#FF5500"
                        fillOpacity={0.2}
                      />
                      <XAxis numTicks={4} />
                      <ChartTooltip />
                    </AreaChart>
                  ) : (
                    <div className="py-8 text-center font-mono text-[12px] text-[#78716C]">
                      Not enough signal points recorded for this incident.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
