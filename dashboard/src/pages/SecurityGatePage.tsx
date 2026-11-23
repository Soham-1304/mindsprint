import {
  ChevronDown,
  ExternalLink,
  FileWarning,
  KeyRound,
  PackageSearch,
  Play,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SietchEvent, SietchPrScanResult } from "@/types";

interface SecurityGatePageProps {
  repoFullName: string;
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

export function SecurityGatePage({
  repoFullName,
  scans,
  onTriggerBranchScan,
}: SecurityGatePageProps) {
  const [running, setRunning] = useState<string | null>(null);

  const blockedCount = scans.filter((s) => s.blocked).length;

  async function runScan(branch: "bad-package" | "low-memory") {
    setRunning(branch);
    try {
      await onTriggerBranchScan(branch);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Distinct 3-Layer Pre-Merge Defense Pipeline Overview */}
      <div className="rounded-2xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#F0E9E1]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#FF5500]" />
              <h2 className="text-[15px] font-semibold text-[#181614]">
                3-Layer Pre-Merge Defense Pipeline
              </h2>
            </div>
            <p className="mt-0.5 text-[12.5px] text-[#665E56]">
              {scans.length} scans recorded ·{" "}
              <strong className="text-[#B91C1C]">{blockedCount} blocked</strong> before merge on{" "}
              <span className="font-mono">{repoFullName}</span>
            </p>
          </div>

          <details className="relative shrink-0">
            <summary className="inline-flex h-8 list-none items-center gap-1.5 rounded-md border border-[#E5DCD2] bg-[#FAF8F5] px-3 text-[12.5px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer">
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
                <span className="font-mono text-[11px] text-[#B91C1C]">PR #1</span>
              </button>
              <button
                type="button"
                disabled={running !== null}
                onClick={() => void runScan("low-memory")}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] text-[#181614] hover:bg-[#FAF8F5] cursor-pointer"
              >
                <span>Diff guard low-memory</span>
                <span className="font-mono text-[11px] text-[#B45309]">branch</span>
              </button>
            </div>
          </details>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#181614]">
              <KeyRound size={14} className="text-[#FF5500]" />
              <span>1. Package Sandbox</span>
            </div>
            <p className="mt-1 text-[12px] text-[#665E56]">
              Plants fake credentials (honeytokens) and detonates new npm packages to catch secret
              exfiltration.
            </p>
          </div>
          <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#181614]">
              <PackageSearch size={14} className="text-[#FF5500]" />
              <span>2. Typosquat &amp; Fresh Guard</span>
            </div>
            <p className="mt-1 text-[12px] text-[#665E56]">
              Flags slopsquatted names and newly published packages under the 48h quarantine window.
            </p>
          </div>
          <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#181614]">
              <FileWarning size={14} className="text-[#FF5500]" />
              <span>3. Secrets &amp; Infra Diff Guard</span>
            </div>
            <p className="mt-1 text-[12px] text-[#665E56]">
              Blocks leaked API keys and dangerous container regressions (e.g. `mem_limit: 24m`).
            </p>
          </div>
        </div>
      </div>

      {/* Verdict Cards (Every Scan Shows Exact Blocked Evidence Upfront) */}
      {scans.length === 0 ? (
        <div className="rounded-xl border border-[#EAE2D9] bg-white px-6 py-12 text-center text-[13px] text-[#665E56]">
          No pre-merge security scans recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => {
            const detonation = scan.layer1Detonations[0] ?? null;
            const prUrl = scan.prNumber
              ? `https://github.com/${repoFullName}/pull/${scan.prNumber}`
              : null;

            return (
              <article
                key={scan.id}
                className="overflow-hidden rounded-2xl border border-[#EAE2D9] bg-white shadow-[0_2px_8px_rgba(24,22,20,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8E0] bg-[#FAF8F5] px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold",
                        scan.blocked
                          ? "bg-[#FEF2F2] text-[#B91C1C]"
                          : "bg-[#F0FDF4] text-[#15803D]",
                      )}
                    >
                      {scan.blocked ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                      {scan.verdictKind}
                    </span>
                    <span className="font-mono text-[12.5px] font-semibold text-[#181614]">
                      {scan.branch}
                    </span>
                    {scan.commitSha && (
                      <span className="font-mono text-[11.5px] text-[#78716C]">
                        {scan.commitSha.slice(0, 7)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11.5px] text-[#78716C] tabular-nums">
                      {scan.durationMs}ms
                    </span>
                    {prUrl && (
                      <a
                        href={prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DCD2] bg-white px-2.5 font-mono text-[11.5px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
                      >
                        <span>PR #{scan.prNumber}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="text-[14px] font-semibold text-[#181614]">
                    {scan.githubCheckRun.title}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {/* Layer 1 Card */}
                    <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
                      <div className="text-[11.5px] font-semibold text-[#5C5650]">
                        Layer 1 · Sandbox
                      </div>
                      {detonation ? (
                        <div className="mt-1.5 space-y-2">
                          <div className="font-mono text-[12px] font-semibold text-[#181614]">
                            {detonation.packageName}@{detonation.packageVersion}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {detonation.tripwires.map((tw) => (
                              <span
                                key={tw.id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10.5px]",
                                  tw.status === "EXFILTRATED" || tw.status === "TAMPERED"
                                    ? "bg-[#FEF2F2] text-[#B91C1C]"
                                    : tw.status === "READ"
                                      ? "bg-[#FFFBEB] text-[#B45309]"
                                      : "bg-white text-[#78716C] border border-[#EAE2D9]",
                                )}
                              >
                                <KeyRound size={10} />
                                {tw.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[12px] text-[#78716C]">No package changes.</p>
                      )}
                    </div>

                    {/* Layer 2 Card */}
                    <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
                      <div className="text-[11.5px] font-semibold text-[#5C5650]">
                        Layer 2 · Typosquat
                      </div>
                      <p className="mt-1.5 text-[12px] text-[#181614]">
                        {scan.layer2Typosquat.findings.length > 0
                          ? scan.layer2Typosquat.findings[0].explanation
                          : `Checked ${scan.layer2Typosquat.checkedPackages} package(s): clear.`}
                      </p>
                    </div>

                    {/* Layer 3 Card */}
                    <div className="rounded-xl border border-[#EFE8E0] bg-[#FAF8F5] p-3.5">
                      <div className="text-[11.5px] font-semibold text-[#5C5650]">
                        Layer 3 · Diff guard
                      </div>
                      {scan.layer3DiffGuard.findings.length > 0 ? (
                        <div className="mt-1.5 space-y-1.5">
                          <div className="font-mono text-[11.5px] font-semibold text-[#B91C1C]">
                            {scan.layer3DiffGuard.findings[0].code}
                          </div>
                          <p className="text-[12px] text-[#5C5650]">
                            {scan.layer3DiffGuard.findings[0].explanation}
                          </p>
                          <pre className="overflow-x-auto rounded bg-white px-2 py-1 font-mono text-[11px] text-[#991B1B] border border-[#FECACA]">
                            {scan.layer3DiffGuard.findings[0].snippet}
                          </pre>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[12px] text-[#78716C]">
                          Scanned {scan.layer3DiffGuard.filesScanned} file(s): clean.
                        </p>
                      )}
                    </div>
                  </div>

                  {detonation && detonation.events.length > 0 && (
                    <details className="rounded-xl border border-[#EAE2D9] bg-[#FAF8F5]">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[12px] font-medium text-[#181614]">
                        <span>Sandbox syscall &amp; sink trace ({detonation.events.length} events)</span>
                        <ChevronDown size={14} className="text-[#78716C]" />
                      </summary>
                      <div className="max-h-56 overflow-y-auto border-t border-[#EAE2D9] bg-white divide-y divide-[#F0E9E1] font-mono text-[11.5px]">
                        {detonation.events.map((evt) => (
                          <div key={evt.seq} className="flex items-center gap-3 px-4 py-1.5">
                            <span className="w-8 text-[#B83B00]">#{evt.seq}</span>
                            <span className="w-14 text-[#78716C]">+{evt.t}ms</span>
                            <span className="w-16 font-semibold text-[#181614]">{evt.type}</span>
                            <span className="truncate text-[#5C5650]">{summarizeEvent(evt)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
