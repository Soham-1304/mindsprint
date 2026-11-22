import { ChevronDown, Play, ShieldAlert, ShieldCheck, X } from "lucide-react";
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
import type { SietchEvent, SietchPrScanResult } from "@/types";

interface SecurityGatePageProps {
  scans: SietchPrScanResult[];
  onTriggerBranchScan: (branch: "bad-package" | "low-memory") => Promise<void>;
}

function summarizeEvent(evt: SietchEvent): string {
  switch (evt.type) {
    case "exec":
      return `${evt.path ?? "exec"} ${evt.argv ? evt.argv.join(" ") : ""}`;
    case "file_read":
      return `READ ${evt.path ?? ""}`;
    case "file_write":
      return `${(evt.op ?? "write").toUpperCase()} ${evt.path ?? ""}`;
    case "dns":
      return `DNS ${evt.qtype ?? "A"} ${evt.name ?? ""}`;
    case "http":
      return `${evt.method ?? "GET"} ${evt.scheme ?? "http"}://${evt.host ?? ""}${evt.path ?? "/"}`;
    case "connect":
      return `CONNECT ${evt.address ?? ""}:${evt.port ?? 0}`;
    default:
      return `${evt.type} ${evt.code != null ? `code=${evt.code}` : ""}`;
  }
}

export function SecurityGatePage({ scans, onTriggerBranchScan }: SecurityGatePageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const active = selectedId ? scans.find((s) => s.id === selectedId) ?? null : null;
  const detonation = active?.layer1Detonations[0] ?? null;

  async function runScan(branch: "bad-package" | "low-memory") {
    setRunning(branch);
    try {
      await onTriggerBranchScan(branch);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[#665E56]">
          Every pull request and push to main is checked for malicious packages, typosquats, leaked
          secrets, and unsafe container limits before merge.
        </p>

        {/* Tucked Test Scan Menu */}
        <details className="relative shrink-0">
          <summary className="inline-flex h-8 list-none items-center gap-1.5 rounded-md border border-[#E5DCD2] bg-white px-3 text-[12.5px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer">
            <Play size={12} className="text-[#FF5500]" />
            <span>{running ? `Scanning ${running}...` : "Run test scan"}</span>
            <ChevronDown size={13} className="text-[#78716C]" />
          </summary>
          <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-lg border border-[#EAE2D9] bg-white p-1.5 shadow-md">
            <button
              type="button"
              disabled={running !== null}
              onClick={() => void runScan("bad-package")}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] text-[#181614] hover:bg-[#FAF8F5] cursor-pointer"
            >
              <span>Detonate bad-package</span>
              <span className="font-mono text-[11px] text-[#B91C1C]">PR #42</span>
            </button>
            <button
              type="button"
              disabled={running !== null}
              onClick={() => void runScan("low-memory")}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] text-[#181614] hover:bg-[#FAF8F5] cursor-pointer"
            >
              <span>Diff guard low-memory</span>
              <span className="font-mono text-[11px] text-[#B45309]">PR #43</span>
            </button>
          </div>
        </details>
      </div>

      {/* Scans Table */}
      <div className="overflow-hidden rounded-xl border border-[#EAE2D9] bg-white shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        {scans.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[#665E56]">
            No pre-merge security scans recorded yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAF8F5] hover:bg-[#FAF8F5]">
                <TableHead className="w-[120px] text-[12px] text-[#665E56]">Verdict</TableHead>
                <TableHead className="text-[12px] text-[#665E56]">Branch / PR</TableHead>
                <TableHead className="text-[12px] text-[#665E56]">Summary</TableHead>
                <TableHead className="w-[160px] text-[12px] text-[#665E56]">Layers</TableHead>
                <TableHead className="w-[90px] text-right text-[12px] text-[#665E56]">
                  Duration
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => {
                const l1Hit = scan.layer1Detonations.some((d) => d.findings.length > 0);
                const l2Hit = scan.layer2Typosquat.findings.length > 0;
                const l3Hit = scan.layer3DiffGuard.findings.length > 0;
                const layers = [
                  l1Hit ? "Sandbox" : null,
                  l2Hit ? "Typosquat" : null,
                  l3Hit ? "Diff guard" : null,
                ].filter(Boolean);

                return (
                  <TableRow
                    key={scan.id}
                    onClick={() => setSelectedId(scan.id)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-[#FAF8F5]",
                      active?.id === scan.id && "bg-[#FFF5EE]",
                    )}
                  >
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                          scan.blocked
                            ? "bg-[#FEF2F2] text-[#B91C1C]"
                            : scan.verdictKind === "SUSPICIOUS"
                              ? "bg-[#FFFBEB] text-[#B45309]"
                              : "bg-[#F0FDF4] text-[#15803D]",
                        )}
                      >
                        {scan.blocked ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
                        {scan.verdictKind}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] font-medium text-[#181614]">
                      {scan.branch}
                      {scan.prNumber ? ` · #${scan.prNumber}` : ""}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#5C5650]">
                      {scan.githubCheckRun.title}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-[#665E56]">
                      {layers.length > 0 ? layers.join(", ") : "All clear"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-[#78716C] tabular-nums">
                      {scan.durationMs}ms
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Selected Scan Detail Drawer */}
      {active && (
        <section className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-[#F0E9E1] pb-3">
            <div>
              <div className="flex items-center gap-2 font-mono text-[12px] text-[#78716C]">
                <span>{active.branch}</span>
                {active.prNumber && <span>· PR #{active.prNumber}</span>}
                {active.commitSha && <span>· {active.commitSha.slice(0, 7)}</span>}
              </div>
              <h3 className="mt-1 text-[15px] font-semibold text-[#181614]">
                {active.githubCheckRun.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78716C] hover:bg-[#F4EFE9] cursor-pointer"
              aria-label="Close scan details"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Layer 1 */}
            <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
              <div className="text-[12px] font-semibold text-[#181614]">
                1. Package sandbox
              </div>
              {detonation ? (
                <div className="mt-1.5 space-y-1 text-[12px] text-[#5C5650]">
                  <div className="font-mono text-[11.5px] text-[#181614]">
                    {detonation.packageName}@{detonation.packageVersion}
                  </div>
                  <div>
                    {detonation.findings.length} finding(s) · {detonation.honeytokensPlanted}{" "}
                    honeytokens planted
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#78716C]">No new packages added.</p>
              )}
            </div>

            {/* Layer 2 */}
            <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
              <div className="text-[12px] font-semibold text-[#181614]">
                2. Typosquat &amp; fresh-pkg guard
              </div>
              <p className="mt-1.5 text-[12px] text-[#5C5650]">
                {active.layer2Typosquat.findings.length > 0
                  ? active.layer2Typosquat.findings[0].explanation
                  : `Checked ${active.layer2Typosquat.checkedPackages} package(s): no anomalies.`}
              </p>
            </div>

            {/* Layer 3 */}
            <div className="rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
              <div className="text-[12px] font-semibold text-[#181614]">
                3. Secrets &amp; infra diff guard
              </div>
              <p className="mt-1.5 text-[12px] text-[#5C5650]">
                {active.layer3DiffGuard.findings.length > 0
                  ? `${active.layer3DiffGuard.findings[0].code}: ${active.layer3DiffGuard.findings[0].explanation}`
                  : `Scanned ${active.layer3DiffGuard.filesScanned} file(s): clean.`}
              </p>
            </div>
          </div>

          {detonation && detonation.events.length > 0 && (
            <details className="rounded-lg border border-[#EAE2D9] bg-[#FAF8F5]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[12.5px] font-medium text-[#181614]">
                <span>Sandbox event trace ({detonation.events.length} events)</span>
                <ChevronDown size={14} className="text-[#78716C]" />
              </summary>
              <div className="max-h-60 overflow-y-auto border-t border-[#EAE2D9] bg-white divide-y divide-[#F0E9E1] font-mono text-[11.5px]">
                {detonation.events.map((evt) => (
                  <div key={evt.seq} className="flex items-center gap-3 px-3.5 py-1.5">
                    <span className="w-8 text-[#B83B00]">#{evt.seq}</span>
                    <span className="w-14 text-[#78716C]">+{evt.t}ms</span>
                    <span className="w-16 font-semibold text-[#181614]">{evt.type}</span>
                    <span className="truncate text-[#5C5650]">{summarizeEvent(evt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
