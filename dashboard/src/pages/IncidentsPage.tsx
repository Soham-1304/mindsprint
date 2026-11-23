import {
  Check,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitPullRequest,
  Lock,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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

function IncidentCard({
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
            requiredAuthorization: inc.safetyTier === "ASK_FIRST" ? ("ASK_FIRST" as const) : ("AUTO_FIX" as const),
            executionFeasibility: true,
            counterfactualReasoning: inc.diagnosisSummary,
            heuristicScore: Math.round((inc.confidence || 0.9) * 100),
          },
        ];

  const [selectedStrategyIdx, setSelectedStrategyIdx] = useState(
    inc.recommendedStrategyIndex ?? 0,
  );
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
        `# Strategy: ${activeStrategy.strategyName}`,
        `# Command: git revert --no-edit ${inc.culpritCommitSha || "HEAD"}`,
        `--- a/${inc.topFrame?.file || inc.culpritFile || "services/orders/src/routes/orders.js"}`,
        `+++ b/${inc.topFrame?.file || inc.culpritFile || "services/orders/src/routes/orders.js"}`,
        `@@ Reverts suspect commit ${inc.culpritCommitSha || "HEAD"} via isolated PR @@`,
        ...(inc.gitBlameDiff ? inc.gitBlameDiff.split("\n").slice(0, 8) : []),
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
    <article className="overflow-hidden rounded-2xl border border-[#EAE2D9] bg-white shadow-[0_2px_10px_rgba(24,22,20,0.04)]">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8E0] bg-[#FAF8F5] px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold",
              inc.status === "RESOLVED"
                ? "bg-[#F0FDF4] text-[#15803D]"
                : pendingApproval
                  ? "bg-[#FFF3EB] text-[#B83B00]"
                  : "bg-[#FEF2F2] text-[#B91C1C]",
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

          <span className="font-mono text-[12px] font-semibold text-[#181614]">{inc.id}</span>
          <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-[#5C5650] border border-[#EAE2D9]">
            {inc.service}
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
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#FF5500] px-2.5 font-mono text-[11.5px] font-semibold text-white hover:bg-[#E04B00]"
            >
              <GitPullRequest size={12} />
              <span>Fix PR #{inc.fixPrNumber}</span>
              <ExternalLink size={10} />
            </a>
          )}

          <a
            href={`${apiBase}/api/incidents/${encodeURIComponent(inc.id)}/report.md`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DCD2] bg-white px-2.5 text-[11.5px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
          >
            <Download size={11} />
            <span>.md</span>
          </a>

          <button
            type="button"
            onClick={() => onOpenPostmortem(inc.id)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DCD2] bg-white px-2.5 text-[11.5px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer"
          >
            <FileText size={11} />
            <span>Postmortem</span>
          </button>
        </div>
      </div>

      {/* Card Body: Left = Logs + Suggested Fixes | Right = Live Code Diff for Selected Fix */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left Column: Summary, Error Log, Clickable Suggested Fixes */}
        <div className="flex flex-col justify-between gap-4 border-b lg:border-b-0 lg:border-r border-[#EFE8E0] p-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-[-0.015em] text-[#181614]">
                {inc.title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5C5650]">
                {inc.diagnosisSummary}
              </p>
            </div>

            {/* Inline Scrubbed Error Log / Top Stack Frame */}
            <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#78716C]">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal size={11} className="text-[#FF5500]" />
                  Scrubbed error log
                </span>
                {inc.culpritCommitSha && <span>commit {inc.culpritCommitSha}</span>}
              </div>
              {inc.topFrame ? (
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-[#991B1B]">
                  {`${inc.topFrame.error}\n  at ${inc.topFrame.function}() (${inc.topFrame.file}:${inc.topFrame.line})`}
                </pre>
              ) : (
                <p className="mt-1.5 font-mono text-[11.5px] text-[#5C5650]">
                  Triggered by {inc.ruleId} on {inc.service} ({inc.modelUsed || "gemini-3.5-flash-lite"}).
                </p>
              )}
            </div>

            {/* Clickable Suggested Fixes (Strategies) */}
            <div className="space-y-2">
              <div className="text-[11.5px] font-semibold text-[#5C5650]">
                Suggested fixes (select to inspect diff)
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
                        "w-full rounded-xl border p-3 text-left transition-colors cursor-pointer",
                        isSelected
                          ? "border-[#FBD3B7] bg-[#FFF5EE]"
                          : "border-[#EAE2D9] bg-white hover:bg-[#FAF8F5]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-semibold text-[#181614]">{strat.strategyName}</span>
                        <span
                          className={cn(
                            "font-mono text-[11.5px] font-semibold tabular-nums",
                            isSelected ? "text-[#B83B00]" : "text-[#78716C]",
                          )}
                        >
                          {strat.heuristicScore}/100
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#5C5650]">
                        {strat.counterfactualReasoning || strat.expectedBenefit}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-[10.5px] text-[#78716C]">
                        <span>Risk: {strat.riskOfWorsening}</span>
                        <span>Tier: {strat.requiredAuthorization}</span>
                        <span>Reversible: {strat.reversibility}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inline Approval Controls when ASK_FIRST is Pending */}
          {pendingApproval && (
            <div className="space-y-2 rounded-xl border border-[#FBD3B7] bg-[#FFF5EE] p-3">
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

        {/* Right Column: Live Unified Code Diff for Selected Suggested Fix */}
        <div className="flex flex-col justify-between bg-[#FAF8F5] p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-medium text-[#181614]">
                <FileCode2 size={13} className="text-[#FF5500]" />
                <span>
                  {repoFullName}/{inc.topFrame?.file || inc.culpritFile || "source"}
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#78716C]">
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
              <pre className="max-h-[340px] overflow-auto rounded-xl border border-[#EAE2D9] bg-white py-2.5 font-mono text-[11.5px] leading-relaxed shadow-xs">
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
            ) : (
              <div className="rounded-xl border border-dashed border-[#DFD5CA] bg-white p-6 text-center text-[12.5px] text-[#665E56]">
                No code patch diff generated for this runtime/latency alert. Recommended action:{" "}
                <strong className="text-[#181614]">{activeStrategy.strategyName}</strong>.
              </div>
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
              {inc.modelUsed || "gemini-3.5-flash-lite"} · {Math.round((inc.confidence || 0.95) * 100)}%
              confidence
            </span>
          </div>
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
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#EAE2D9] bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors cursor-pointer",
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
        <div className="space-y-5">
          {filtered.map((inc) => (
            <IncidentCard
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
