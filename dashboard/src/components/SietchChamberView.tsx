import {
  AlertOctagon,
  Bug,
  CheckCircle2,
  FileWarning,
  Flame,
  KeyRound,
  Layers,
  Play,
  ShieldAlert,
  TerminalSquare,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { SietchEvent, SietchPrScanResult } from "../types";

interface SietchChamberViewProps {
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
      return `${(evt.op ?? "write").toUpperCase()} ${evt.path ?? ""}${evt.target ? ` -> ${evt.target}` : ""}`;
    case "dns":
      return `DNS ${evt.qtype ?? "A"} ${evt.name ?? ""}`;
    case "http":
      return `${evt.method ?? "GET"} ${evt.scheme ?? "http"}://${evt.host ?? ""}${evt.path ?? "/"}`;
    case "connect":
      return `CONNECT ${evt.address ?? "unrecorded"}:${evt.port ?? 0}`;
    case "exit":
      return `EXIT pid=${evt.pid ?? "?"} code=${evt.code ?? "null"}${evt.signal ? ` sig=${evt.signal}` : ""}`;
    default:
      return JSON.stringify(evt);
  }
}

export function SietchChamberView({ scans, onTriggerBranchScan }: SietchChamberViewProps) {
  const [selectedScanId, setSelectedScanId] = useState<string>(scans[0]?.id ?? "");
  const [runningBranch, setRunningBranch] = useState<string | null>(null);
  const [onlyFlaggedSeq, setOnlyFlaggedSeq] = useState(false);

  const activeScan = scans.find((s) => s.id === selectedScanId) ?? scans[0];
  const detonation = activeScan?.layer1Detonations[0] ?? null;

  const seqToRules = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!detonation) return map;
    for (const f of detonation.findings) {
      for (const seq of f.evidence) {
        const list = map.get(seq) ?? [];
        if (!list.includes(f.ruleId)) list.push(f.ruleId);
        map.set(seq, list);
      }
    }
    return map;
  }, [detonation]);

  async function handleRun(branch: "bad-package" | "low-memory") {
    setRunningBranch(branch);
    try {
      await onTriggerBranchScan(branch);
      setSelectedScanId(""); // Snap to newest scan at index 0
    } finally {
      setRunningBranch(null);
    }
  }

  if (!activeScan) {
    return (
      <div className="panel">
        <div className="panel-body">
          No Sietch PR scans recorded yet. Trigger a live detonation on PulseShop&apos;s `bad-package` or `low-memory` branch.
        </div>
      </div>
    );
  }

  const displayedEvents = detonation
    ? onlyFlaggedSeq
      ? detonation.events.filter((e) => seqToRules.has(e.seq))
      : detonation.events
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Live Detonation Controls + Scan Switcher */}
      <div className="sietch-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-danger"
            disabled={runningBranch !== null}
            onClick={() => handleRun("bad-package")}
          >
            <Flame size={15} />
            <span>
              {runningBranch === "bad-package"
                ? "Detonating bad-package..."
                : "Live Detonate: bad-package (PR #42)"}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={runningBranch !== null}
            onClick={() => handleRun("low-memory")}
          >
            <Play size={14} />
            <span>
              {runningBranch === "low-memory"
                ? "Scanning low-memory..."
                : "Live Diff Guard: low-memory (PR #43)"}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {scans.slice(0, 5).map((scan) => (
            <button
              key={scan.id}
              type="button"
              className={`btn ${scan.id === activeScan.id ? "btn-primary" : ""}`}
              onClick={() => setSelectedScanId(scan.id)}
              style={{ padding: "6px 10px", fontSize: 12 }}
            >
              <span className="mono">{scan.branch}</span>
              <span
                className={`badge ${
                  scan.verdictKind === "MALICIOUS" || scan.verdictKind === "ERROR"
                    ? "badge-malicious"
                    : scan.verdictKind === "SUSPICIOUS"
                      ? "badge-suspicious"
                      : "badge-safe"
                }`}
              >
                {scan.verdictKind}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Package Verdict Banner + Ecosystem Adapter Badge */}
      <div className={`verdict-banner ${activeScan.verdictKind}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              className={`badge ${
                activeScan.verdictKind === "MALICIOUS" || activeScan.verdictKind === "ERROR"
                  ? "badge-malicious"
                  : activeScan.verdictKind === "SUSPICIOUS"
                    ? "badge-suspicious"
                    : "badge-safe"
              }`}
              style={{ fontSize: 13, padding: "4px 10px" }}
            >
              {activeScan.blocked ? <AlertOctagon size={14} /> : <CheckCircle2 size={14} />}
              VERDICT: {activeScan.verdictKind} {activeScan.blocked ? "// PR MERGE BLOCKED" : "// CLEAR"}
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              PR #{activeScan.prNumber ?? "?"} ({activeScan.branch}) · commit {activeScan.commitSha ?? "HEAD"} ·{" "}
              {activeScan.durationMs}ms
            </span>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600 }}>{activeScan.githubCheckRun.title}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>
            @sietch/core ruleset v{activeScan.rulesetVersion}
            {detonation ? ` · mode: ${detonation.mode} · cacheKey: ${detonation.cacheKey.slice(0, 48)}...` : ""}
          </div>
        </div>

        {/* Ecosystem Adapter Badge */}
        <div className="ecosystem-bar mono" aria-label="Ecosystem Adapters">
          <Layers size={13} color="var(--accent)" />
          {activeScan.ecosystemAdapters.map((adapter, idx) => (
            <span key={adapter.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {idx > 0 && <span style={{ color: "#475569" }}>|</span>}
              <span style={{ color: adapter.status === "active" ? "var(--safe)" : "var(--ink-muted)" }}>
                {adapter.label}{" "}
                <span style={{ color: adapter.status === "active" ? "var(--safe)" : "var(--ink-muted)" }}>
                  [{adapter.status === "active" ? "active" : "adapter spec"}]
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Honeytoken Tripwire Grid (Layer 1) */}
      {detonation && (
        <section className="panel" aria-label="Honeytoken Tripwire Grid">
          <div className="panel-header">
            <h2 className="panel-title">
              <KeyRound size={15} color="var(--accent)" />
              <span>
                Layer 1 Honeytoken Tripwire Grid ({detonation.honeytokensPlanted} Checksum-Valid Fakes Planted via
                @sietch/sandbox)
              </span>
            </h2>
            <span className="badge badge-malicious mono">
              {detonation.packageName}@{detonation.packageVersion}
            </span>
          </div>
          <div className="panel-body">
            <div className="tripwire-grid">
              {detonation.tripwires.map((tw) => (
                <div key={tw.id} className={`tripwire-card ${tw.status}`}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                      {tw.label}
                    </span>
                    <span
                      className={`badge ${
                        tw.status === "EXFILTRATED" || tw.status === "TAMPERED"
                          ? "badge-critical"
                          : tw.status === "READ"
                            ? "badge-high"
                            : "badge-muted"
                      }`}
                    >
                      {tw.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{tw.detail}</div>
                  {tw.ruleIds.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {tw.ruleIds.map((rid) => (
                        <span key={rid} className="badge badge-critical mono">
                          {rid}
                        </span>
                      ))}
                      {tw.evidenceSeqs.map((seq) => (
                        <span key={seq} className="badge badge-info mono">
                          seq #{seq}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Layer 2 & Layer 3 Preventive Findings */}
      <div className="evidence-two-col">
        {/* Layer 2 */}
        <section className="panel" aria-label="Layer 2 Typosquat and Fresh Package Guard">
          <div className="panel-header">
            <h3 className="panel-title">
              <Bug size={15} color="var(--warn)" />
              <span>Layer 2: Slopsquat / Typosquat &amp; Fresh-Pkg Guard</span>
            </h3>
            <span
              className={`badge ${
                activeScan.layer2Typosquat.status === "BLOCK"
                  ? "badge-critical"
                  : activeScan.layer2Typosquat.status === "WARN"
                    ? "badge-high"
                    : "badge-safe"
              }`}
            >
              {activeScan.layer2Typosquat.status} ({activeScan.layer2Typosquat.findings.length})
            </span>
          </div>
          <div className="panel-body">
            {activeScan.layer2Typosquat.findings.length === 0 ? (
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                No typosquatting, slopsquatting, or fresh-package anomalies detected across{" "}
                {activeScan.layer2Typosquat.checkedPackages} package(s).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeScan.layer2Typosquat.findings.map((f, idx) => (
                  <div key={idx} className="kv-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className={`badge ${f.severity === "Critical" ? "badge-critical" : "badge-high"} mono`}>
                        {f.code}
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-primary)" }}>
                        {f.packageName}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{f.explanation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Layer 3 */}
        <section className="panel" aria-label="Layer 3 PR Diff Guard">
          <div className="panel-header">
            <h3 className="panel-title">
              <FileWarning size={15} color="var(--danger)" />
              <span>Layer 3: PR Diff Guard (Secrets &amp; Infra Configs)</span>
            </h3>
            <span
              className={`badge ${
                activeScan.layer3DiffGuard.status === "BLOCK"
                  ? "badge-critical"
                  : activeScan.layer3DiffGuard.status === "WARN"
                    ? "badge-high"
                    : "badge-safe"
              }`}
            >
              {activeScan.layer3DiffGuard.status} ({activeScan.layer3DiffGuard.findings.length})
            </span>
          </div>
          <div className="panel-body">
            {activeScan.layer3DiffGuard.findings.length === 0 ? (
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                Scanned {activeScan.layer3DiffGuard.filesScanned} file(s) ({activeScan.layer3DiffGuard.linesScanned}{" "}
                diff lines): zero leaked secrets or unsafe container configs.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeScan.layer3DiffGuard.findings.map((f, idx) => (
                  <div key={idx} className="kv-item" style={{ borderColor: "var(--danger-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className={`badge ${f.severity === "Critical" ? "badge-critical" : "badge-high"} mono`}>
                        {f.code}
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                        {f.file}
                        {f.line ? `:${f.line}` : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 6 }}>{f.explanation}</div>
                    <pre className="code-block" style={{ padding: "6px 10px" }}>
                      {f.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Layer 1 @sietch/core Rule Findings & Live seq #1..#N Syscall/Sink Stream */}
      {detonation && (
        <section className="panel" aria-label="Sietch Rule Findings and Syscall Stream">
          <div className="panel-header">
            <h3 className="panel-title">
              <TerminalSquare size={15} color="var(--accent)" />
              <span>
                Live Detonation Trace (seq #1..#{detonation.events.length}) &amp; @sietch/core judge() Citations
              </span>
            </h3>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)" }}>
              <input
                type="checkbox"
                checked={onlyFlaggedSeq}
                onChange={(e) => setOnlyFlaggedSeq(e.target.checked)}
              />
              <span>Show flagged seq only</span>
            </label>
          </div>

          {/* Rules Summary Strip */}
          {detonation.findings.length > 0 && (
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {detonation.findings.map((f, idx) => (
                <div
                  key={`${f.ruleId}-${idx}`}
                  style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
                >
                  <span
                    className={`badge ${f.severity === "Critical" ? "badge-critical" : "badge-high"} mono`}
                  >
                    <ShieldAlert size={12} />
                    {f.ruleId} ({f.severity})
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-primary)", fontWeight: 500 }}>{f.title}:</span>
                  <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{f.explanation}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                    [{f.evidence.map((s) => `seq #${s}`).join(", ")}]
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Event Stream Table */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Time</th>
                  <th>Phase</th>
                  <th>Type</th>
                  <th>PID</th>
                  <th>Syscall / Capture Sink Event</th>
                  <th>Rules</th>
                </tr>
              </thead>
              <tbody>
                {displayedEvents.map((evt) => {
                  const rules = seqToRules.get(evt.seq) ?? [];
                  return (
                    <tr key={evt.seq} className={rules.length > 0 ? "seq-row-flagged" : ""}>
                      <td className="mono" style={{ color: "var(--accent)", whiteSpace: "nowrap" }}>
                        #{evt.seq}
                      </td>
                      <td className="mono" style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                        +{evt.t}ms
                      </td>
                      <td>
                        <span className="badge badge-muted mono">{evt.phase}</span>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {evt.type}
                      </td>
                      <td className="mono" style={{ color: "var(--ink-muted)" }}>
                        {evt.pid ?? "sink"}
                      </td>
                      <td className="mono" style={{ wordBreak: "break-all" }}>
                        <div>{summarizeEvent(evt)}</div>
                        {evt.type === "http" && evt.body && (
                          <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                            body: {evt.body.slice(0, 120)}
                            {evt.body.length > 120 ? "..." : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {rules.map((r) => (
                            <span key={r} className="badge badge-critical mono">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
