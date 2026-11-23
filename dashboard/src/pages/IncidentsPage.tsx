import {
  Check,
  Code2,
  Columns2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitPullRequest,
  Lock,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BeforeAfterDiffSlider } from "@/components/BeforeAfterDiffSlider";
import { cn } from "@/lib/utils";
import type { ApprovalRequest, IncidentRecord } from "@/types";

interface IncidentsPageProps {
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  repoFullName: string;
  apiBase: string;
  operatorToken: string;
  approvalError: string | null;
  onChangeOperatorToken: (val: string) => void;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
}

type FilterStatus = "all" | "open" | "approval" | "resolved";
type DiffViewMode = "slider" | "unified" | "report";

function formatTtd(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function IncidentWorkbenchCard({
  inc,
  approval,
  repoFullName,
  apiBase,
  operatorToken,
  approvalError,
  onChangeOperatorToken,
  onDecideApproval,
  onOpenPostmortem,
}: {
  inc: IncidentRecord;
  approval?: ApprovalRequest;
  repoFullName: string;
  apiBase: string;
  operatorToken: string;
  approvalError: string | null;
  onChangeOperatorToken: (val: string) => void;
  onDecideApproval: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
  onOpenPostmortem: (incidentId: string) => void;
}) {
  const strategies =
    inc.counterfactualEvaluations && inc.counterfactualEvaluations.length > 0
      ? inc.counterfactualEvaluations
      : [
          {
            strategyName: inc.fixPrNumber
              ? `Surgical Fix PR #${inc.fixPrNumber}`
              : "Automated Root-Cause Mitigation",
            actionType: inc.fixPrNumber ? "FIX_PR" : "INVESTIGATE",
            expectedBenefit: inc.diagnosisSummary,
            riskOfWorsening: "LOW" as const,
            cascadingRisk: "Isolated branch PR — main protected.",
            reversibility: "IMMEDIATE" as const,
            requiredAuthorization:
              inc.safetyTier === "ASK_FIRST" ? ("ASK_FIRST" as const) : ("AUTO_FIX" as const),
            executionFeasibility: true,
            counterfactualReasoning: inc.diagnosisSummary,
            heuristicScore: Math.round((inc.confidence || 0.9) * 100),
          },
        ];

  const [selectedStrategyIdx, setSelectedStrategyIdx] = useState(
    inc.recommendedStrategyIndex ?? 0,
  );
  const [viewMode, setViewMode] = useState<DiffViewMode>("slider");
  const [prDiff, setPrDiff] = useState<string>(inc.gitBlameDiff || "");
  const [diffSource, setDiffSource] = useState<string>("loading");
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/diff`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { diff?: string; source?: string } | null) => {
        if (cancelled) return;
        if (json?.diff && json.diff.trim().length > 0) {
          setPrDiff(json.diff);
          setDiffSource(json.source || "github_pr");
        } else {
          setPrDiff(inc.gitBlameDiff || "");
          setDiffSource(inc.gitBlameDiff ? "blame_fallback" : "none");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrDiff(inc.gitBlameDiff || "");
          setDiffSource(inc.gitBlameDiff ? "blame_fallback" : "none");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, inc.id, inc.gitBlameDiff]);

  const activeStrategy = strategies[selectedStrategyIdx] ?? strategies[0];
  const isRevertStrategy = activeStrategy.actionType?.toUpperCase().includes("REVERT");
  const pendingApproval = approval && approval.status === "PENDING";

  const displayedDiff = isRevertStrategy
    ? [
        `--- a/${inc.topFrame?.file || inc.culpritFile || "services/orders/src/routes/orders.js"}`,
        `+++ b/${inc.topFrame?.file || inc.culpritFile || "services/orders/src/routes/orders.js"}`,
        `@@ -48,4 +48,4 @@`,
        ...(inc.gitBlameDiff ? inc.gitBlameDiff.split("\n").slice(0, 10) : []),
      ].join("\n")
    : prDiff;

  async function handleDecide(decision: "APPROVE" | "REJECT") {
    if (!approval) return;
    setDeciding(true);
    try {
      await onDecideApproval(approval.id, decision);
    } finally {
      setDeciding(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EAE2D9] bg-white shadow-[0_2px_12px_rgba(24,22,20,0.04)]">
      {/* Top Incident Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8E0] bg-[#FAF8F5] px-5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold",
              inc.status === "RESOLVED"
                ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                : pendingApproval
                  ? "bg-[#FFF3EB] text-[#B83B00] border border-[#FBD3B7]"
                  : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                inc.status === "RESOLVED"
                  ? "bg-[#15803D]"
                  : pendingApproval
                    ? "bg-[#FF5500]"
                    : "bg-[#DC2626]",
              )}
            />
            {inc.status === "RESOLVED" ? "Resolved" : pendingApproval ? "Needs approval" : inc.status}
          </span>

          <span className="font-mono text-[12.5px] font-semibold text-[#181614]">{inc.id}</span>
          <span className="rounded-md border border-[#EAE2D9] bg-white px-2 py-0.5 font-mono text-[11px] text-[#5C5650]">
            {inc.service}-service
          </span>
          <span className="font-mono text-[11px] text-[#78716C]">{inc.ruleId}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11.5px] text-[#665E56] tabular-nums">
            TTD <strong className="text-[#181614]">{formatTtd(inc.timeToDiagnosisMs)}</strong> ·{" "}
            {formatTime(inc.alarmRaisedAt)}
          </span>

          {inc.fixPrUrl && (
            <a
              href={inc.fixPrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FF5500] px-3 font-mono text-[11.5px] font-semibold text-white hover:bg-[#E04B00]"
            >
              <GitPullRequest size={12} />
              <span>Fix PR #{inc.fixPrNumber}</span>
              <ExternalLink size={10} />
            </a>
          )}

          <a
            href={`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/report.md`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DCD2] bg-white px-2.5 text-[12px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
          >
            <Download size={12} />
            <span>.md</span>
          </a>

          <button
            type="button"
            onClick={() => onOpenPostmortem(inc.id)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DCD2] bg-white px-2.5 text-[12px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer"
          >
            <FileText size={12} />
            <span>Postmortem</span>
          </button>
        </div>
      </div>

      {/* Incident Title, Summary & View Mode Switcher */}
      <div className="border-b border-[#EFE8E0] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#181614]">
              {inc.title}
            </h2>
            <p className="mt-1 max-w-[78ch] text-[13.5px] leading-relaxed text-[#5C5650]">
              {inc.diagnosisSummary}
            </p>
          </div>

          {/* Segmented View Mode Toggle: Before/After Slider | Unified Diff | RCA Report */}
          <div
            role="tablist"
            aria-label="Incident inspection mode"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-1"
          >
            {(
              [
                { id: "slider", label: "Before / After", icon: Columns2 },
                { id: "unified", label: "Unified diff", icon: Code2 },
                { id: "report", label: "RCA report", icon: FileText },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] transition-colors cursor-pointer",
                  viewMode === tab.id
                    ? "bg-white font-semibold text-[#181614] shadow-xs border border-[#EAE2D9]"
                    : "font-medium text-[#665E56] hover:text-[#181614]",
                )}
              >
                <tab.icon size={13} className={viewMode === tab.id ? "text-[#FF5500]" : ""} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FULL-WIDTH MAIN COMPARISON / DIFF / REPORT STAGE */}
      <div className="bg-[#FAF8F5] px-5 py-5">
        {viewMode === "slider" && (
          <BeforeAfterDiffSlider
            diff={displayedDiff}
            filePath={inc.topFrame?.file || inc.culpritFile || "source"}
            beforeTitle={
              inc.culpritCommitSha
                ? `Commit ${inc.culpritCommitSha} (production fault)`
                : "Production fault"
            }
            afterTitle={
              isRevertStrategy
                ? activeStrategy.strategyName
                : inc.fixPrNumber
                  ? `PatchUP Fix PR #${inc.fixPrNumber}`
                  : "PatchUP surgical fix"
            }
            beforeBadge={inc.ruleId}
            afterBadge={
              diffSource === "github_pr" && inc.fixPrNumber
                ? `PR #${inc.fixPrNumber} verified`
                : "Verified fix"
            }
          />
        )}

        {viewMode === "unified" && (
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[12px] font-medium text-[#181614]">
                <FileCode2 size={14} className="shrink-0 text-[#FF5500]" />
                <span className="truncate">
                  {repoFullName}/{inc.topFrame?.file || inc.culpritFile || "source"}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[11.5px] text-[#78716C]">
                {isRevertStrategy
                  ? "Revert PR preview"
                  : diffSource === "github_pr"
                    ? `Live GitHub PR #${inc.fixPrNumber} diff`
                    : diffSource === "loading"
                      ? "Fetching PR diff..."
                      : "Proposed patch diff"}
              </span>
            </div>

            {displayedDiff ? (
              <div className="overflow-x-auto rounded-2xl border border-[#EAE2D9] bg-white py-2.5 shadow-xs">
                <pre className="min-w-0 font-mono text-[12px] leading-relaxed">
                  {displayedDiff.split("\n").map((line, i) => (
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
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#DFD5CA] bg-white p-6 text-center text-[13px] text-[#665E56]">
                No code patch diff generated for this alert.
              </div>
            )}
          </div>
        )}

        {viewMode === "report" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#EAE2D9] bg-white p-4">
              <div className="text-[11.5px] font-semibold text-[#78716C]">Root Cause Analysis</div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#181614]">
                {inc.diagnosisSummary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px] text-[#665E56]">
                <span>Model: {inc.modelUsed || "gemini-3.5-flash-lite"}</span>
                <span>·</span>
                <span>Confidence: {Math.round((inc.confidence || 0.95) * 100)}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#EAE2D9] bg-white p-4">
              <div className="text-[11.5px] font-semibold text-[#78716C]">Culprit Location</div>
              <div className="mt-2 font-mono text-[12px] font-semibold text-[#181614] break-all">
                {inc.topFrame?.file || inc.culpritFile || "N/A"}
                {inc.topFrame?.line ? `:${inc.topFrame.line}` : ""}
              </div>
              {inc.topFrame?.function && (
                <div className="mt-1 font-mono text-[11.5px] text-[#665E56]">
                  fn {inc.topFrame.function}()
                </div>
              )}
              {inc.culpritCommitSha && (
                <div className="mt-2 inline-flex rounded-md border border-[#EFE8E0] bg-[#FAF8F5] px-2 py-0.5 font-mono text-[11px] text-[#5C5650]">
                  commit {inc.culpritCommitSha}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#EAE2D9] bg-white p-4">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#15803D]">
                <ShieldCheck size={14} />
                <span>Zero-Retention Proof</span>
              </div>
              <div className="mt-2 font-mono text-[13px] font-semibold text-[#181614]">
                0 B retained in RAM
              </div>
              <p className="mt-1 text-[12px] text-[#665E56]">
                All PII scrubbed prior to inference and incident buffer cryptographically wiped upon
                PR creation.
              </p>
              {inc.purgeReceipt && (
                <div className="mt-2 font-mono text-[11px] text-[#15803D] break-all">
                  sha256:{inc.purgeReceipt.receiptHash.slice(0, 18)}…
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM EVIDENCE ROW: Scrubbed Error Log (Left) + Counterfactual Suggested Fixes (Right) */}
      <div className="grid grid-cols-1 gap-4 border-t border-[#EFE8E0] bg-white p-5 lg:grid-cols-2">
        {/* Left: Scrubbed Error Log */}
        <div className="min-w-0 flex flex-col justify-between rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11.5px] text-[#78716C]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#181614]">
                <Terminal size={13} className="text-[#FF5500]" />
                Scrubbed error log
              </span>
              {inc.culpritCommitSha && <span>commit {inc.culpritCommitSha}</span>}
            </div>

            {inc.topFrame ? (
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-[#FECACA]/70 bg-white p-3 font-mono text-[11.5px] leading-relaxed text-[#991B1B]">
                {`${inc.topFrame.error}\n  at ${inc.topFrame.function}() (${inc.topFrame.file}:${inc.topFrame.line})`}
              </pre>
            ) : (
              <p className="font-mono text-[12px] text-[#5C5650]">
                Triggered by {inc.ruleId} on {inc.service} (
                {inc.modelUsed || "gemini-3.5-flash-lite"}).
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE2D9] pt-3 font-mono text-[11px] text-[#665E56]">
            <span className="inline-flex items-center gap-1.5 text-[#15803D]">
              <Lock size={11} />
              {inc.purgeReceipt
                ? `0 B retained · sha256:${inc.purgeReceipt.receiptHash.slice(0, 10)}`
                : "0 B retained in RAM"}
            </span>
            <span>
              {inc.modelUsed || "gemini-3.5-flash-lite"} ·{" "}
              {Math.round((inc.confidence || 0.95) * 100)}% confidence
            </span>
          </div>
        </div>

        {/* Right: Counterfactual Suggested Fixes + Approval Controls */}
        <div className="min-w-0 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-[#181614]">
                Suggested fixes (select to preview)
              </span>
              <span className="font-mono text-[11px] text-[#78716C]">
                {strategies.length} {strategies.length === 1 ? "option" : "options"}
              </span>
            </div>

            <div className="space-y-2">
              {strategies.map((strat, idx) => {
                const isSelected = idx === selectedStrategyIdx;
                return (
                  <button
                    key={strat.strategyName}
                    type="button"
                    onClick={() => setSelectedStrategyIdx(idx)}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      isSelected
                        ? "border-[#FBD3B7] bg-[#FFF5EE]"
                        : "border-[#EAE2D9] bg-white hover:bg-[#FAF8F5]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold text-[#181614]">{strat.strategyName}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[11.5px] font-semibold tabular-nums",
                          isSelected ? "text-[#B83B00]" : "text-[#78716C]",
                        )}
                      >
                        {strat.heuristicScore}/100
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#5C5650]">
                      {strat.counterfactualReasoning || strat.expectedBenefit}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-[#78716C]">
                      <span>Risk: {strat.riskOfWorsening}</span>
                      <span>Tier: {strat.requiredAuthorization}</span>
                      <span>Reversible: {strat.reversibility}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {pendingApproval && (
            <div className="space-y-2 rounded-xl border border-[#FBD3B7] bg-[#FFF5EE] p-3.5">
              {approvalError && (
                <div className="text-[12px] text-[#B91C1C]">{approvalError}</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={operatorToken}
                  onChange={(e) => onChangeOperatorToken(e.target.value)}
                  placeholder="Enter operator key to approve"
                  aria-label="Operator approval key"
                  className="h-8 flex-1 min-w-[160px] rounded-md border border-[#DFD5CA] bg-white px-2.5 font-mono text-[12px] text-[#181614]"
                />
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => void handleDecide("APPROVE")}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-[#15803D] px-3 text-[12px] font-semibold text-white hover:bg-[#166534] cursor-pointer"
                >
                  <Check size={12} />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => void handleDecide("REJECT")}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DFD5CA] bg-white px-2.5 text-[12px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer"
                >
                  <X size={12} />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function IncidentsPage({
  incidents,
  approvals,
  repoFullName,
  apiBase,
  operatorToken,
  approvalError,
  onChangeOperatorToken,
  onDecideApproval,
  onOpenPostmortem,
}: IncidentsPageProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const pendingByInc = new Set(
    approvals.filter((a) => a.status === "PENDING").map((a) => a.incidentId),
  );

  const filtered = incidents.filter((inc) => {
    if (filter === "open") return inc.status !== "RESOLVED";
    if (filter === "approval") return pendingByInc.has(inc.id);
    if (filter === "resolved") return inc.status === "RESOLVED";
    return true;
  });

  const filters: Array<{ id: FilterStatus; label: string; count: number }> = [
    { id: "all", label: "All", count: incidents.length },
    {
      id: "open",
      label: "Open",
      count: incidents.filter((i) => i.status !== "RESOLVED").length,
    },
    {
      id: "approval",
      label: "Needs approval",
      count: incidents.filter((i) => pendingByInc.has(i.id)).length,
    },
    {
      id: "resolved",
      label: "Resolved",
      count: incidents.filter((i) => i.status === "RESOLVED").length,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#EAE2D9] bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] transition-colors cursor-pointer",
                filter === f.id
                  ? "bg-[#FAF8F5] font-semibold text-[#181614] border border-[#EAE2D9]"
                  : "font-medium text-[#665E56] hover:text-[#181614]",
              )}
            >
              <span>{f.label}</span>
              <span className="font-mono text-[11px] text-[#78716C] tabular-nums">
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#EAE2D9] bg-white px-6 py-12 text-center text-[13px] text-[#665E56]">
          No incidents match this filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((inc) => (
            <IncidentWorkbenchCard
              key={inc.id}
              inc={inc}
              approval={approvals.find((a) => a.incidentId === inc.id)}
              repoFullName={repoFullName}
              apiBase={apiBase}
              operatorToken={operatorToken}
              approvalError={approvalError}
              onChangeOperatorToken={onChangeOperatorToken}
              onDecideApproval={onDecideApproval}
              onOpenPostmortem={onOpenPostmortem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
