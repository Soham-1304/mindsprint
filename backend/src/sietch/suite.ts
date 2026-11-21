/**
 * Sietch 3-Layer Preventive Suite Orchestrator
 *
 * Runs on every Pull Request (and on-demand via Dashboard / Listener webhook):
 *  - Layer 2: Slopsquatting / Typosquatting & Fresh-Package Guard
 *  - Layer 3: PR Diff Guard (Secrets & Dangerous Infra Configs)
 *  - Layer 1: Behavioral Sandbox Detonation (real @sietch/sandbox + @sietch/core judge())
 *
 * Emits a unified Verdict + GitHub Check Run Markdown payload.
 */

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detonatePackage } from "./detonator.js";
import { runDiffGuard } from "./diff-guard.js";
import { loadSietchCore, type VerdictKind } from "./kiroween-bridge.js";
import { runTyposquatGuard } from "./typosquat-guard.js";
import {
  ECOSYSTEM_ADAPTERS,
  type GitHubCheckRunPayload,
  type Layer1DetonationResult,
  type PackageMetadataHint,
  type SietchPrScanInput,
  type SietchPrScanResult,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Built-in local fixture map for MindSprint demo packages. */
export const DEFAULT_LOCAL_PACKAGES: Readonly<Record<string, string>> = {
  "@sietch-demo/currency-format-lite": path.resolve(
    __dirname,
    "../../../demo-packages/currency-format-lite",
  ),
};

/** Default metadata hints for known demo fixtures (simulates a 6-hour-old fresh package). */
function defaultMetadataFor(name: string): PackageMetadataHint | undefined {
  if (name === "@sietch-demo/currency-format-lite") {
    return {
      exists: true,
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      weeklyDownloads: 14,
    };
  }
  return undefined;
}

export interface ParsedDependencyChange {
  readonly name: string;
  readonly version: string;
  readonly file: string;
  readonly action: "added" | "bumped";
}

/**
 * Parse added or bumped dependencies from `package.json` hunks inside a git diff.
 */
export function extractPackageChangesFromDiff(diffText: string): ParsedDependencyChange[] {
  const lines = diffText.split(/\r?\n/);
  let currentFile = "";
  const removedInFile = new Map<string, Map<string, string>>();
  const addedRaw: { name: string; version: string; file: string }[] = [];

  const depLineRegex = /^\s*"(@?[a-z0-9._~/-]+)"\s*:\s*"([^"]+)"\s*,?\s*$/i;
  const nonDepKeys = new Set([
    "name",
    "version",
    "description",
    "main",
    "module",
    "type",
    "license",
    "author",
    "private",
    "start",
    "dev",
    "build",
    "test",
    "lint",
    "preinstall",
    "install",
    "postinstall",
    "node",
    "npm",
  ]);

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      continue;
    }
    if (!currentFile.endsWith("package.json")) continue;

    if (line.startsWith("-") && !line.startsWith("---")) {
      const m = line.slice(1).match(depLineRegex);
      if (m && !nonDepKeys.has(m[1])) {
        const map = removedInFile.get(currentFile) ?? new Map<string, string>();
        map.set(m[1], m[2]);
        removedInFile.set(currentFile, map);
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      const m = line.slice(1).match(depLineRegex);
      if (m && !nonDepKeys.has(m[1]) && /^[~^>=<0-9]|^(?:workspace|file|npm|latest):?/i.test(m[2])) {
        addedRaw.push({ name: m[1], version: m[2], file: currentFile });
      }
    }
  }

  const seen = new Set<string>();
  const changes: ParsedDependencyChange[] = [];
  for (const item of addedRaw) {
    const key = `${item.file}:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prevVersion = removedInFile.get(item.file)?.get(item.name);
    // Ignore trailing-comma formatting diffs where the package version did not change
    if (prevVersion === item.version) continue;
    changes.push({
      ...item,
      action: prevVersion !== undefined ? "bumped" : "added",
    });
  }
  return changes;
}

function combineVerdictKind(
  layer1: readonly Layer1DetonationResult[],
  layer2Status: "PASS" | "WARN" | "BLOCK",
  layer3Status: "PASS" | "WARN" | "BLOCK",
): VerdictKind {
  if (layer1.some((d) => d.verdict.kind === "ERROR")) return "ERROR";
  if (layer1.some((d) => d.verdict.kind === "MALICIOUS")) return "MALICIOUS";
  if (layer2Status === "BLOCK" || layer3Status === "BLOCK") return "MALICIOUS";
  if (
    layer1.some((d) => d.verdict.kind === "SUSPICIOUS") ||
    layer2Status === "WARN" ||
    layer3Status === "WARN"
  ) {
    return "SUSPICIOUS";
  }
  return "SAFE";
}

function buildGitHubCheckRun(result: Omit<SietchPrScanResult, "githubCheckRun">): GitHubCheckRunPayload {
  const blocked = result.blocked;
  const totalL1 = result.layer1Detonations.reduce((sum, d) => sum + d.findings.length, 0);
  const totalL2 = result.layer2Typosquat.findings.length;
  const totalL3 = result.layer3DiffGuard.findings.length;

  const title = blocked
    ? `SIETCH BLOCKED (${result.verdictKind}) — ${totalL1 + totalL2 + totalL3} preventive finding(s)`
    : result.verdictKind === "SUSPICIOUS"
      ? `SIETCH WARNING (SUSPICIOUS) — ${totalL1 + totalL2 + totalL3} advisory finding(s)`
      : `SIETCH PASSED (SAFE) — All 3 preventive layers clear`;

  const lines: string[] = [
    `## Sietch 3-Layer Preventive Shield — \`${result.verdictKind}\``,
    "",
    `- **Branch:** \`${result.branch}\` | **Ruleset:** \`@sietch/core v${result.rulesetVersion}\` | **Duration:** \`${result.durationMs}ms\``,
    `- **Layer 1 (Sandbox Detonation):** ${result.layer1Detonations.length} package(s) detonated, ${totalL1} rule finding(s)`,
    `- **Layer 2 (Typosquat & Fresh-Pkg Guard):** \`${result.layer2Typosquat.status}\` (${totalL2} finding(s))`,
    `- **Layer 3 (PR Diff & Infra Guard):** \`${result.layer3DiffGuard.status}\` (${totalL3} finding(s))`,
    "",
  ];

  if (totalL1 > 0) {
    lines.push("### Layer 1 — Behavioral Sandbox Findings (`@sietch/core judge()`)");
    lines.push("| Package | Rule | Severity | Evidence Seq | Explanation |");
    lines.push("|---|---|---|---|---|");
    for (const det of result.layer1Detonations) {
      for (const f of det.findings) {
        const seqs = f.evidence.map((s) => `#${s}`).join(", ");
        lines.push(
          `| \`${det.packageName}@${det.packageVersion}\` | **${f.ruleId}** | ${f.severity} | ${seqs} | ${f.explanation} |`,
        );
      }
    }
    lines.push("");
  }

  if (totalL2 > 0) {
    lines.push("### Layer 2 — Slopsquatting / Typosquatting & Fresh-Package Findings");
    for (const f of result.layer2Typosquat.findings) {
      lines.push(`- **[${f.severity}] \`${f.code}\`** — ${f.explanation}`);
    }
    lines.push("");
  }

  if (totalL3 > 0) {
    lines.push("### Layer 3 — PR Diff Secrets & Infrastructure Config Findings");
    for (const f of result.layer3DiffGuard.findings) {
      lines.push(
        `- **[${f.severity}] \`${f.code}\`** (\`${f.file}${f.line ? `:${f.line}` : ""}\`) — ${f.explanation}`,
      );
    }
    lines.push("");
  }

  return {
    name: "Sietch 3-Layer Preventive Shield",
    status: "completed",
    conclusion: blocked
      ? "failure"
      : result.verdictKind === "SUSPICIOUS"
        ? "action_required"
        : "success",
    title,
    summary: `Layer 1: ${totalL1} finding(s) | Layer 2: ${result.layer2Typosquat.status} (${totalL2}) | Layer 3: ${result.layer3DiffGuard.status} (${totalL3})`,
    markdownReport: lines.join("\n"),
  };
}

/**
 * Execute all 3 preventive layers against a Pull Request diff.
 */
export async function runSietchPrSuite(input: SietchPrScanInput): Promise<SietchPrScanResult> {
  const startedAt = Date.now();
  const core = await loadSietchCore();
  const scanId = input.scanId ?? `sietch-${crypto.randomBytes(4).toString("hex")}`;

  const dependencyChanges = extractPackageChangesFromDiff(input.diffText);

  // Layer 2: Slopsquatting / Typosquatting & Fresh-Package Guard
  const layer2Typosquat = runTyposquatGuard(
    dependencyChanges.map((dep) => ({
      name: dep.name,
      version: dep.version,
      metadata: input.packageMetadata?.[dep.name] ?? defaultMetadataFor(dep.name),
    })),
  );

  // Layer 3: PR Diff Guard (runs on EVERY PR diff, even without package.json changes)
  const layer3DiffGuard = await runDiffGuard(input.diffText, {
    knownTokens: input.knownTokens,
  });

  // Layer 1: Behavioral Sandbox Detonation for every added/bumped package resolvable locally
  const localMap: Record<string, string> = {
    ...DEFAULT_LOCAL_PACKAGES,
    ...(input.localPackageOverrides ?? {}),
  };

  const layer1Detonations: Layer1DetonationResult[] = [];
  for (const dep of dependencyChanges) {
    const pkgDir = localMap[dep.name];
    if (!pkgDir) continue;
    const cleanVersion = dep.version.replace(/^[\^~>=<\s]+/, "") || "0.0.0";
    const detonation = await detonatePackage({
      packageName: dep.name,
      packageVersion: cleanVersion,
      packageDir: pkgDir,
      mode: input.mode,
    });
    layer1Detonations.push(detonation);
  }

  const verdictKind = combineVerdictKind(
    layer1Detonations,
    layer2Typosquat.status,
    layer3DiffGuard.status,
  );
  const blocked = verdictKind === "MALICIOUS" || verdictKind === "ERROR";

  const baseResult: Omit<SietchPrScanResult, "githubCheckRun"> = {
    id: scanId,
    createdAt: new Date().toISOString(),
    repo: input.repo ?? "pulseshop/pulseshop",
    branch: input.branch,
    prNumber: input.prNumber,
    commitSha: input.commitSha,
    author: input.author ?? "soham@pulseshop.io",
    verdictKind,
    blocked,
    rulesetVersion: core.RULESET_VERSION,
    durationMs: Math.max(1, Date.now() - startedAt),
    ecosystemAdapters: ECOSYSTEM_ADAPTERS,
    dependencyChanges,
    layer1Detonations,
    layer2Typosquat,
    layer3DiffGuard,
  };

  return {
    ...baseResult,
    githubCheckRun: buildGitHubCheckRun(baseResult),
  };
}
