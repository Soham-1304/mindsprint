import { Check, ChevronDown, ChevronUp, Copy, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { LinkedProject } from "../types";

interface TelemetryReadinessBarProps {
  project: LinkedProject | undefined;
  apiBase: string;
  onRescanSignals: (projectId: string) => Promise<void>;
}

type SnippetTab = "app" | "logstash" | "cloudwatch";

export function TelemetryReadinessBar({
  project,
  apiBase,
  onRescanSignals,
}: TelemetryReadinessBarProps) {
  const [rescanning, setRescanning] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("app");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!project) return null;

  const caps = project.capabilities;
  const signals = [
    { key: "githubApp", label: "GitHub App", ok: caps.githubApp },
    { key: "health", label: "/health", ok: caps.healthEndpoint },
    { key: "metrics", label: "Prometheus /metrics", ok: caps.prometheusMetrics },
    { key: "telemetry", label: "/api/telemetry", ok: caps.jsonTelemetry },
    { key: "pushLogs", label: "Push Logs (6h)", ok: caps.pushLogsActive },
    { key: "sietch", label: "Sietch 3-Layer", ok: caps.sietchGate },
  ];

  const hasWarnings = caps.warnings.length > 0 || caps.activeSignalsCount < caps.totalSignalsCount;
  const accuracyClass =
    caps.accuracyLevel === "HIGH"
      ? "badge-safe"
      : caps.accuracyLevel === "MEDIUM"
        ? "badge-ask"
        : "badge-critical";

  const webhookEndpoint = `${apiBase || window.location.origin}/api/webhooks/incident-bundle`;
  const cloudwatchEndpoint = `${apiBase || window.location.origin}/api/webhooks/cloudwatch`;

  const snippets: Record<SnippetTab, { label: string; code: string }> = {
    app: {
      label: "App Error Hook (Node / Express)",
      code: `// Set PATCHUP_WEBHOOK_URL=${apiBase || "https://patch-up-backend.onrender.com"}
if (process.env.PATCHUP_WEBHOOK_URL) {
  fetch(\`\${process.env.PATCHUP_WEBHOOK_URL}/api/webhooks/incident-bundle\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: "${project.fullName}",
      serviceId: "${project.repoName}-service",
      rule: "ERR_5XX_SPIKE",
      windowHours: 6,
      topFrame,
      logs: recentLogs,
    }),
  }).catch(() => {});
}`,
    },
    logstash: {
      label: "Logstash HTTP Output",
      code: `output {
  if [level] == "error" {
    http {
      url => "${webhookEndpoint}"
      http_method => "post"
      format => "json"
      content_type => "application/json"
    }
  }
}`,
    },
    cloudwatch: {
      label: "AWS CloudWatch SNS",
      code: `# Subscribe an HTTPS SNS Topic to Patch-Up CloudWatch Endpoint:
aws sns subscribe \\
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:prod-alarms \\
  --protocol https \\
  --notification-endpoint ${cloudwatchEndpoint}`,
    },
  };

  async function handleRescan() {
    if (!project) return;
    setRescanning(true);
    try {
      await onRescanSignals(project.id);
    } finally {
      setRescanning(false);
    }
  }

  function handleCopy(key: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <section className="readiness-strip" aria-label="Telemetry Readiness">
      <div className="readiness-row">
        <div className="readiness-meta">
          <span className="readiness-title">
            <Radio size={14} color="#22d3ee" />
            <span>Telemetry Readiness</span>
          </span>
          <span className="mono" style={{ fontSize: 12, color: "#94a3b8" }}>
            {project.fullName}
          </span>
          <span className={`badge ${accuracyClass} mono`}>
            {caps.accuracyLevel} ({caps.activeSignalsCount}/{caps.totalSignalsCount})
          </span>
        </div>

        <div className="readiness-signals">
          {signals.map((sig) => (
            <span
              key={sig.key}
              className={`signal-chip mono ${sig.ok ? "signal-ok" : "signal-missing"}`}
            >
              <span className={`dot ${sig.ok ? "dot-healthy" : "dot-degraded"}`} aria-hidden="true" />
              {sig.label}
            </span>
          ))}
        </div>

        <div className="readiness-actions">
          {hasWarnings && (
            <button
              type="button"
              className="btn"
              style={{ padding: "5px 10px", fontSize: 12 }}
              onClick={() => setShowSnippets((v) => !v)}
            >
              {showSnippets ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>Push Snippets</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{ padding: "5px 10px", fontSize: 12 }}
            onClick={handleRescan}
            disabled={rescanning}
          >
            <RefreshCw size={13} className={rescanning ? "spin-icon" : ""} />
            <span>{rescanning ? "Scanning..." : "Re-Scan Signals"}</span>
          </button>
        </div>
      </div>

      {hasWarnings && caps.warnings.length > 0 && (
        <div className="readiness-warnings">
          {caps.warnings.map((warn, idx) => (
            <div key={idx} className="readiness-warning-item">
              <ShieldAlert size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {showSnippets && (
        <div className="readiness-snippets">
          <div className="snippet-tabs">
            {(["app", "logstash", "cloudwatch"] as SnippetTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`snippet-tab ${snippetTab === tab ? "active" : ""}`}
                onClick={() => setSnippetTab(tab)}
              >
                {snippets[tab].label}
              </button>
            ))}
            <button
              type="button"
              className="btn"
              style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 12 }}
              onClick={() => handleCopy(snippetTab, snippets[snippetTab].code)}
            >
              {copiedKey === snippetTab ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedKey === snippetTab ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="code-block" style={{ margin: 0 }}>
            {snippets[snippetTab].code}
          </pre>
        </div>
      )}
    </section>
  );
}
