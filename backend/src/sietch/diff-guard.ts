/**
 * Layer 3: PR Diff Guard (Secrets & Dangerous Infrastructure Configs)
 *
 * Scans EVERY pull request git diff — even when package.json was not touched — for:
 *  1. Leaked credentials via @sietch/core's findHoneytokens() + deterministic secret matchers
 *     (AWS AKIA..., GitHub ghp_/gho_/ghs_/github_pat_, npm_..., private keys, .env secrets).
 *  2. Dangerous Docker / Kubernetes / Compose regressions:
 *     - Dangerously low container memory limits (e.g., `mem_limit: 24m` on PulseShop's low-memory branch)
 *     - Removed HEALTHCHECK / healthcheck / readinessProbe / livenessProbe
 *     - Privileged containers (`privileged: true`), host networking, root user, zero replicas.
 */

import { loadSietchCore } from "./kiroween-bridge.js";
import type { DiffGuardFinding, DiffGuardReport } from "./types.js";

interface SecretMatcher {
  readonly code: DiffGuardFinding["code"];
  readonly title: string;
  readonly regex: RegExp;
  readonly severity: DiffGuardFinding["severity"];
  readonly explanation: string;
}

const SECRET_MATCHERS: readonly SecretMatcher[] = [
  {
    code: "DIFF_AWS_KEY",
    title: "Hardcoded AWS Access Key ID in PR diff",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "Critical",
    explanation: "An AWS Access Key ID (AKIA...) was added directly in the PR diff.",
  },
  {
    code: "DIFF_GITHUB_TOKEN",
    title: "Hardcoded GitHub token in PR diff",
    regex: /\b(?:ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
    severity: "Critical",
    explanation: "A GitHub personal access or actions token was committed in the PR diff.",
  },
  {
    code: "DIFF_NPM_TOKEN",
    title: "Hardcoded npm auth token in PR diff",
    regex: /\bnpm_[A-Za-z0-9]{20,}\b/,
    severity: "Critical",
    explanation: "An npm registry authentication token (npm_...) was committed in the PR diff.",
  },
  {
    code: "DIFF_PRIVATE_KEY",
    title: "Private cryptographic key committed in PR diff",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    severity: "Critical",
    explanation: "A private key block was added to version control.",
  },
];

const ENV_SECRET_ASSIGNMENT =
  /^\s*(?:DATABASE_URL|MONGODB_URI|AWS_SECRET_ACCESS_KEY|STRIPE_SECRET_KEY|API_KEY|JWT_SECRET|PRIVATE_KEY|GITHUB_TOKEN|NPM_TOKEN)\s*=\s*["']?([^\s"']{8,})["']?/;

const PLACEHOLDER_VALUE = /(?:example|changeme|placeholder|your[_-]|xxx+|dummy|localhost|test-key|<.+>)/i;

/** Minimum safe memory limit in MiB for Node/microservice containers. */
const MIN_SAFE_MEMORY_MIB = 128;

/** Parse Docker Compose / K8s memory strings (`24m`, `64Mi`, `1g`, `512000k`) into MiB. */
export function parseMemoryToMiB(raw: string): number | null {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(b|k|kb|ki|m|mb|mi|g|gb|gi)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] ?? "b").toLowerCase();
  switch (unit) {
    case "b":
      return value / (1024 * 1024);
    case "k":
    case "kb":
    case "ki":
      return value / 1024;
    case "m":
    case "mb":
    case "mi":
      return value;
    case "g":
    case "gb":
    case "gi":
      return value * 1024;
    default:
      return null;
  }
}

function isInfraFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  return (
    base.includes("docker-compose") ||
    base.includes("compose.") ||
    base.startsWith("dockerfile") ||
    base.endsWith(".dockerfile") ||
    lower.startsWith("k8s/") ||
    lower.includes("/k8s/") ||
    lower.includes("/helm/") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml")
  );
}

function isDotEnvFile(filePath: string): boolean {
  const base = (filePath.split("/").pop() ?? "").toLowerCase();
  if (base.endsWith(".example") || base.endsWith(".sample") || base.endsWith(".template")) {
    return false;
  }
  return base === ".env" || base.startsWith(".env.");
}

function redactSnippet(line: string): string {
  return line
    .trim()
    .replace(/\b(AKIA[0-9A-Z]{4})[0-9A-Z]{12}\b/g, "$1************")
    .replace(/\b((?:ghp|gho|ghs|npm)_[A-Za-z0-9]{4})[A-Za-z0-9_]+\b/g, "$1************")
    .slice(0, 140);
}

export interface DiffGuardOptions {
  /** Optional known honeytokens or canary secrets to detect across raw/hex/base64 encodings via @sietch/core. */
  readonly knownTokens?: readonly { id: string; value: string }[];
}

/**
 * Scan a unified git diff for secrets (Layer 3A) and dangerous infra regressions (Layer 3B).
 */
export async function runDiffGuard(
  diffText: string,
  options: DiffGuardOptions = {},
): Promise<DiffGuardReport> {
  const core = await loadSietchCore();
  const compiledTokens =
    options.knownTokens && options.knownTokens.length > 0
      ? core.compileHoneytokens(options.knownTokens)
      : null;

  const lines = diffText.split(/\r?\n/);
  const findings: DiffGuardFinding[] = [];
  const filesSeen = new Set<string>();

  let currentFile = "";
  let newLineNum = 0;
  let oldLineNum = 0;
  let linesScanned = 0;

  for (const rawLine of lines) {
    if (rawLine.startsWith("diff --git ")) {
      const m = rawLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (m) {
        currentFile = m[2];
        filesSeen.add(currentFile);
      }
      continue;
    }
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice(6).trim();
      filesSeen.add(currentFile);
      continue;
    }
    if (rawLine.startsWith("--- ") || rawLine.startsWith("index ")) {
      continue;
    }
    if (rawLine.startsWith("@@ ")) {
      const hunk = rawLine.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLineNum = Number(hunk[1]);
        newLineNum = Number(hunk[2]);
      }
      continue;
    }

    const isAdded = rawLine.startsWith("+") && !rawLine.startsWith("+++");
    const isRemoved = rawLine.startsWith("-") && !rawLine.startsWith("---");

    if (isAdded) {
      const content = rawLine.slice(1);
      const lineNo = newLineNum;
      newLineNum++;
      linesScanned++;

      // 1. @sietch/core honeytoken/canary matcher (catches raw, hex, base64, double-base64, URL-encoded)
      if (compiledTokens) {
        const matches = core.findHoneytokens(compiledTokens, content);
        for (const match of matches) {
          findings.push({
            code: "DIFF_HONEYTOKEN_MATCH",
            category: "SECRET_LEAK",
            severity: "Critical",
            file: currentFile || "(unknown)",
            line: lineNo,
            title: "Canary/honeytoken secret leaked in PR diff",
            explanation: `Matched tracked secret "${match.tokenId}" (${match.encoding}) in ${currentFile || "diff"}.`,
            snippet: redactSnippet(content),
          });
        }
      }

      // 2. Deterministic secret pattern matchers
      for (const matcher of SECRET_MATCHERS) {
        if (matcher.regex.test(content)) {
          findings.push({
            code: matcher.code,
            category: "SECRET_LEAK",
            severity: matcher.severity,
            file: currentFile || "(unknown)",
            line: lineNo,
            title: matcher.title,
            explanation: `${matcher.explanation} (File: ${currentFile || "unknown"}:${lineNo}).`,
            snippet: redactSnippet(content),
          });
        }
      }

      // 3. Committed .env secrets
      if (isDotEnvFile(currentFile)) {
        const envMatch = content.match(ENV_SECRET_ASSIGNMENT);
        if (envMatch && !PLACEHOLDER_VALUE.test(envMatch[1])) {
          findings.push({
            code: "DIFF_ENV_SECRET",
            category: "SECRET_LEAK",
            severity: "High",
            file: currentFile,
            line: lineNo,
            title: "Unmasked secret committed in .env file",
            explanation: `Sensitive environment credential added to tracked file "${currentFile}" at line ${lineNo}.`,
            snippet: redactSnippet(content),
          });
        }
      }

      // 4. Dangerous infrastructure regressions on Docker / Compose / K8s files
      if (isInfraFile(currentFile)) {
        // 4a. Dangerously low memory limit (`mem_limit: 24m` or K8s `memory: 24Mi`)
        const memMatch = content.match(/^\s*(?:mem_limit|memory)\s*:\s*["']?([0-9.]+[a-zA-Z]*)["']?/);
        if (memMatch) {
          const mib = parseMemoryToMiB(memMatch[1]);
          if (mib !== null && mib < MIN_SAFE_MEMORY_MIB) {
            findings.push({
              code: "INFRA_LOW_MEMORY_LIMIT",
              category: "INFRA_REGRESSION",
              severity: "Critical",
              file: currentFile,
              line: lineNo,
              title: `Unsafe container memory limit (${memMatch[1]}) — OOMKill risk`,
              explanation: `Container memory limit set to ${memMatch[1]} (${mib.toFixed(0)} MiB), below the ${MIN_SAFE_MEMORY_MIB} MiB minimum safe floor for Node.js microservices. Deploying this will trigger immediate OOMKill crashes.`,
              snippet: content.trim(),
            });
          }
        }

        // 4b. Privileged container
        if (/^\s*privileged\s*:\s*true\b/i.test(content)) {
          findings.push({
            code: "INFRA_PRIVILEGED_CONTAINER",
            category: "INFRA_REGRESSION",
            severity: "Critical",
            file: currentFile,
            line: lineNo,
            title: "Privileged container enabled",
            explanation: `Container grants full host capabilities via \`privileged: true\` in ${currentFile}:${lineNo}.`,
            snippet: content.trim(),
          });
        }

        // 4c. Host network mode
        if (/^\s*(?:network_mode\s*:\s*["']?host["']?|hostNetwork\s*:\s*true)\b/i.test(content)) {
          findings.push({
            code: "INFRA_HOST_NETWORK",
            category: "INFRA_REGRESSION",
            severity: "High",
            file: currentFile,
            line: lineNo,
            title: "Host network namespace exposed",
            explanation: `Container bypasses network isolation via host networking in ${currentFile}:${lineNo}.`,
            snippet: content.trim(),
          });
        }

        // 4d. Zero replicas in production deployment
        if (/^\s*replicas\s*:\s*0\b/.test(content)) {
          findings.push({
            code: "INFRA_ZERO_REPLICAS",
            category: "INFRA_REGRESSION",
            severity: "Critical",
            file: currentFile,
            line: lineNo,
            title: "Deployment scaled to 0 replicas",
            explanation: `Setting \`replicas: 0\` in ${currentFile}:${lineNo} will cause immediate service downtime.`,
            snippet: content.trim(),
          });
        }

        // 4e. Root container user
        if (/^\s*(?:USER\s+root|runAsUser\s*:\s*0)\b/.test(content)) {
          findings.push({
            code: "INFRA_ROOT_USER",
            category: "INFRA_REGRESSION",
            severity: "High",
            file: currentFile,
            line: lineNo,
            title: "Container configured to run as root (UID 0)",
            explanation: `Running the workload as root increases container breakout blast radius (${currentFile}:${lineNo}).`,
            snippet: content.trim(),
          });
        }
      }
    } else if (isRemoved) {
      const content = rawLine.slice(1);
      const lineNo = oldLineNum;
      oldLineNum++;
      linesScanned++;

      // Catch removed HEALTHCHECK / healthcheck / livenessProbe / readinessProbe
      if (
        isInfraFile(currentFile) &&
        /^\s*(?:HEALTHCHECK\b|healthcheck\s*:|livenessProbe\s*:|readinessProbe\s*:)/.test(content)
      ) {
        findings.push({
          code: "INFRA_HEALTHCHECK_REMOVED",
          category: "INFRA_REGRESSION",
          severity: "High",
          file: currentFile,
          line: lineNo,
          title: "Container health check removed",
          explanation: `A container health or readiness probe was deleted in ${currentFile}:${lineNo}, blinding orchestrator self-healing.`,
          snippet: `-${content.trim()}`,
        });
      }
    } else {
      oldLineNum++;
      newLineNum++;
    }
  }

  const hasCritical = findings.some((f) => f.severity === "Critical");
  const hasHigh = findings.some((f) => f.severity === "High");
  const status: DiffGuardReport["status"] = hasCritical ? "BLOCK" : hasHigh ? "WARN" : "PASS";

  return {
    layer: "LAYER_3_DIFF_GUARD",
    filesScanned: filesSeen.size,
    linesScanned,
    status,
    findings,
  };
}
