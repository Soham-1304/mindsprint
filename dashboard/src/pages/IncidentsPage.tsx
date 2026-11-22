import { ExternalLink, GitPullRequest } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ApprovalRequest, IncidentRecord } from "@/types";

interface IncidentsPageProps {
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  onOpenIncident: (incidentId: string) => void;
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

export function IncidentsPage({
  incidents,
  approvals,
  onOpenIncident,
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
    <div className="space-y-4">
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

      <div className="overflow-hidden rounded-xl border border-[#EAE2D9] bg-white shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[#665E56]">
            No incidents match this filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAF8F5] hover:bg-[#FAF8F5]">
                <TableHead className="w-[105px] text-[12px] text-[#665E56]">Status</TableHead>
                <TableHead className="w-[150px] text-[12px] text-[#665E56]">ID</TableHead>
                <TableHead className="text-[12px] text-[#665E56]">Incident</TableHead>
                <TableHead className="w-[110px] text-[12px] text-[#665E56]">Service</TableHead>
                <TableHead className="w-[130px] text-[12px] text-[#665E56]">Rule</TableHead>
                <TableHead className="w-[84px] text-[12px] text-[#665E56]">TTD</TableHead>
                <TableHead className="w-[110px] text-[12px] text-[#665E56]">Fix PR</TableHead>
                <TableHead className="w-[90px] text-right text-[12px] text-[#665E56]">
                  Detected
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inc) => {
                const needsApproval = pendingByInc.has(inc.id);
                return (
                  <TableRow
                    key={inc.id}
                    onClick={() => onOpenIncident(inc.id)}
                    className="cursor-pointer transition-colors hover:bg-[#FAF8F5]"
                  >
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                          inc.status === "RESOLVED"
                            ? "bg-[#F0FDF4] text-[#15803D]"
                            : needsApproval
                              ? "bg-[#FFF3EB] text-[#B83B00]"
                              : "bg-[#FEF2F2] text-[#B91C1C]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            inc.status === "RESOLVED"
                              ? "bg-[#15803D]"
                              : needsApproval
                                ? "bg-[#FF5500]"
                                : "bg-[#DC2626]",
                          )}
                        />
                        {inc.status === "RESOLVED"
                          ? "Resolved"
                          : needsApproval
                            ? "Review"
                            : inc.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] font-medium text-[#181614]">
                      {inc.id}
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal">
                      <div className="font-medium text-[#181614] line-clamp-1">{inc.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-[12px] text-[#665E56]">
                        {inc.diagnosisSummary}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-[#5C5650]">
                      {inc.service}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-[#665E56]">
                      {inc.ruleId}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] font-medium text-[#181614] tabular-nums">
                      {formatTtd(inc.timeToDiagnosisMs)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {inc.fixPrUrl ? (
                        <a
                          href={inc.fixPrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[12px] font-medium text-[#B83B00] hover:underline"
                        >
                          <GitPullRequest size={12} />
                          <span>#{inc.fixPrNumber}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="font-mono text-[12px] text-[#A89F96]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-[#78716C] tabular-nums">
                      {formatTime(inc.alarmRaisedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
