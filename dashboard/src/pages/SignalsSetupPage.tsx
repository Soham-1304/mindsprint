import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LinkedProject } from "@/types";

interface SignalsSetupPageProps {
  project: LinkedProject;
  apiBase: string;
  onRescanSignals: (projectId: string) => Promise<void>;
}

type SnippetTab = "node" | "logstash" | "cloudwatch";

export function SignalsSetupPage({
  project,
  apiBase,
  onRescanSignals,
}: SignalsSetupPageProps) {
  const [rescanning, setRescanning] = useState(false);
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("node");
  const [copied, setCopied] = useState(false);

  const caps = project.capabilities;
  const webhookBase = apiBase || "https://patch-up-backend.onrender.com";
  const coveragePct = Math.round(
    (caps.activeSignalsCount / Math.max(caps.totalSignalsCount, 1)) * 100,
  );

  const snippets: Record<SnippetTab, { label: string; code: string }> = {
    node: {
      label: "Node / Express",
      code: `// Set PATCHUP_WEBHOOK_URL=${webhookBase}
if (process.env.PATCHUP_WEBHOOK_URL) {
  fetch(\`\${process.env.PATCHUP_WEBHOOK_URL}/api/webhooks/incident-bundle\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: "${project.fullName}",
      serviceId: "${project.repoName}-service",
      rule: "ERR_5XX_SPIKE",
      windowHours: 6,
      logs: recentLogs,
    }),
  }).catch(() => {});
}`,
    },
    logstash: {
      label: "Logstash",
      code: `output {
  if [level] == "error" {
    http {
      url => "${webhookBase}/api/webhooks/incident-bundle"
      http_method => "post"
      format => "json"
      content_type => "application/json"
    }
  }
}`,
    },
    cloudwatch: {
      label: "CloudWatch SNS",
      code: `aws sns subscribe \\
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:prod-alarms \\
  --protocol https \\
  --notification-endpoint ${webhookBase}/api/webhooks/cloudwatch`,
    },
  };

  async function handleRescan() {
    setRescanning(true);
    try {
      await onRescanSignals(project.id);
    } finally {
      setRescanning(false);
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(snippets[snippetTab].code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const signalRows = [
    {
      name: "GitHub App",
      ok: caps.githubApp,
      what: "Grants PR-only fix creation, commit diff access, and pre-merge check runs.",
      fix: caps.githubApp
        ? `Connected to ${project.fullName}`
        : "Install the Patch-Up SRE GitHub App on this repository.",
    },
    {
      name: "Health endpoint",
      ok: caps.healthEndpoint,
      what: `Probes ${project.deployedUrl ? `${project.deployedUrl.replace(/\/+$/, "")}${project.healthEndpoint || "/api/health"}` : "/api/health"} for HTTP 200.`,
      fix: caps.healthEndpoint
        ? "Returning HTTP 200."
        : "Endpoint returned non-200. Check upstream URLs or Settings.",
    },
    {
      name: "Prometheus /metrics",
      ok: caps.prometheusMetrics,
      what: `Scrapes ${project.metricsEndpoint || "/metrics"} for error rate and latency histograms.`,
      fix: caps.prometheusMetrics
        ? "Metrics scrape active."
        : "Expose /metrics or set a custom Prometheus URL in Settings.",
    },
    {
      name: "JSON /api/telemetry",
      ok: caps.jsonTelemetry,
      what: `Reads ${project.telemetryEndpoint || "/api/telemetry"} for p95 latency and 5xx stats.`,
      fix: caps.jsonTelemetry
        ? "Structured JSON telemetry active."
        : "Expose a JSON /api/telemetry route returning errorRate5xx and p95LatencyMs.",
    },
    {
      name: "Push logs (6h window)",
      ok: caps.pushLogsActive,
      what: "App pushes scrubbed logs only when a fault triggers. Zero logs stored at rest.",
      fix: caps.pushLogsActive
        ? "Push bundle received; zero-retention pipeline active."
        : "No push bundle received yet. Wire the webhook snippet below.",
    },
    {
      name: "Pre-merge security gate",
      ok: caps.sietchGate,
      what: "Scans every PR and push to main for malicious packages, typosquats, and leaked secrets.",
      fix: "Active on GitHub webhooks.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Coverage Header Card */}
      <div className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[15px] font-bold text-[#181614] tabular-nums">
                {caps.activeSignalsCount} / {caps.totalSignalsCount}
              </span>
              <span className="text-[13.5px] font-medium text-[#5C5650]">signals connected</span>
              <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#15803D]">
                {caps.accuracyLevel}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11.5px] text-[#78716C]">
              Last probed {new Date(caps.checkedAt).toLocaleTimeString()} · auto-probes every 5m
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={rescanning}
            onClick={() => void handleRescan()}
            className="h-8 border-[#E5DCD2] bg-white text-[12.5px] cursor-pointer"
          >
            <RefreshCw size={13} className={rescanning ? "animate-spin" : ""} />
            <span>{rescanning ? "Checking endpoints..." : "Re-check now"}</span>
          </Button>
        </div>

        <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F0E9E1]">
          <div
            className="h-full rounded-full bg-[#15803D] transition-all duration-300"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </div>

      {/* 2-Column Signal Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {signalRows.map((row) => (
          <div
            key={row.name}
            className="flex flex-col justify-between rounded-xl border border-[#EAE2D9] bg-white p-4 shadow-[0_1px_2px_rgba(24,22,20,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    row.ok ? "bg-[#15803D]" : "bg-[#DC2626]",
                  )}
                />
                <span className="text-[13.5px] font-semibold text-[#181614]">{row.name}</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium",
                  row.ok ? "bg-[#F0FDF4] text-[#15803D]" : "bg-[#FEF2F2] text-[#B91C1C]",
                )}
              >
                {row.ok ? "Connected" : "Needs setup"}
              </span>
            </div>

            <p className="mt-2 text-[12.5px] text-[#5C5650]">{row.what}</p>
            <p
              className={cn(
                "mt-2 border-t border-[#F0E9E1] pt-2 text-[12px]",
                row.ok ? "text-[#15803D]" : "text-[#B45309]",
              )}
            >
              {row.fix}
            </p>
          </div>
        ))}
      </div>

      {/* Push-on-Break Webhook Setup */}
      <section className="rounded-xl border border-[#EAE2D9] bg-white p-5 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-[#181614]">
              Push-on-break webhook setup
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#665E56]">
              Send error bundles only when a fault fires. Patch-Up diagnoses in memory and purges
              every byte after opening the Fix PR.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[#EAE2D9] bg-[#FAF8F5] p-0.5">
              {(["node", "logstash", "cloudwatch"] as SnippetTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSnippetTab(t)}
                  className={cn(
                    "h-7 rounded px-2.5 text-[12px] transition-colors cursor-pointer",
                    snippetTab === t
                      ? "bg-white font-semibold text-[#181614] shadow-xs"
                      : "font-medium text-[#665E56] hover:text-[#181614]",
                  )}
                >
                  {snippets[t].label}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-8 border-[#E5DCD2] bg-white text-[12px] cursor-pointer"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-[#EFE8E0] bg-[#FAF8F5] p-4 font-mono text-[12px] leading-relaxed text-[#181614]">
          {snippets[snippetTab].code}
        </pre>
      </section>
    </div>
  );
}
