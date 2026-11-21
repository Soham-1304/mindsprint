import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { clearVerdictCache, detonatePackage } from "./detonator.js";
import { parseMemoryToMiB, runDiffGuard } from "./diff-guard.js";
import { loadSietchCore } from "./kiroween-bridge.js";
import { createControlPlaneApp } from "./standalone-server.js";
import { DEFAULT_LOCAL_PACKAGES, extractPackageChangesFromDiff, runSietchPrSuite } from "./suite.js";
import { damerauLevenshtein, runTyposquatGuard } from "./typosquat-guard.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PULSESHOP_DIR = path.resolve(__dirname, "../../../../pulseshop");

async function getBranchDiffOrFallback(branch: "low-memory" | "bad-package"): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", PULSESHOP_DIR, "show", "--format=", branch]);
    if (stdout.trim().length > 0) return stdout;
  } catch {
    // Fault branches were pruned from production pulseshop repo before GitHub push
  }
  if (branch === "low-memory") {
    return [
      "diff --git a/docker-compose.yml b/docker-compose.yml",
      "--- a/docker-compose.yml",
      "+++ b/docker-compose.yml",
      "@@ -67,6 +67,7 @@ services:",
      "     container_name: pulseshop-orders",
      "+    mem_limit: 24m",
      "     restart: unless-stopped",
    ].join("\n");
  }
  return [
    "diff --git a/services/orders/package.json b/services/orders/package.json",
    "--- a/services/orders/package.json",
    "+++ b/services/orders/package.json",
    "@@ -10,6 +10,7 @@",
    '     "cors": "^2.8.5",',
    '     "express": "^4.21.1",',
    '     "mongoose": "^8.8.1",',
    '-    "prom-client": "^15.1.3"',
    '+    "prom-client": "^15.1.3",',
    '+    "@sietch-demo/currency-format-lite": "1.0.2"',
    "   }",
    " }",
  ].join("\n");
}

describe("Sietch 3-Layer Preventive Suite (Piece 9)", () => {
  describe("Layer 1: Behavioral Sandbox Detonation (@sietch/core + @sietch/sandbox)", () => {
    it("detonates @sietch-demo/currency-format-lite@1.0.2 and triggers MALICIOUS (R1, R2, R3, R6, R10)", async () => {
      clearVerdictCache();
      const result = await detonatePackage({
        packageName: "@sietch-demo/currency-format-lite",
        packageVersion: "1.0.2",
        packageDir: DEFAULT_LOCAL_PACKAGES["@sietch-demo/currency-format-lite"],
        mode: "local-sandbox",
        seed: "mindsprint-aia-02-deterministic-seed",
      });

      expect(result.verdict.kind).toBe("MALICIOUS");
      expect(result.allowsInstall).toBe(false);
      expect(result.cacheKey).toMatch(/^verdict:v1:/);
      expect(result.honeytokensPlanted).toBeGreaterThanOrEqual(10);
      expect(result.events.length).toBeGreaterThanOrEqual(6);

      const ruleIds = new Set(result.findings.map((f) => f.ruleId));
      expect(ruleIds.has("R1")).toBe(true); // Base64-encoded npm honeytoken exfiltrated in HTTP POST body
      expect(ruleIds.has("R2")).toBe(true); // Read ~/.npmrc and ~/.aws/credentials
      expect(ruleIds.has("R3")).toBe(true); // Contacted non-allowlisted telemetry.currency-format.invalid
      expect(ruleIds.has("R6")).toBe(true); // Planted .github/workflows/telemetry.yml
      expect(ruleIds.has("R10")).toBe(true); // Spawned detached lingering background child process

      // Every finding must have valid seq citations into result.events
      const seqSet = new Set(result.events.map((e) => e.seq));
      for (const finding of result.findings) {
        expect(finding.evidence.length).toBeGreaterThan(0);
        for (const seq of finding.evidence) {
          expect(seqSet.has(seq)).toBe(true);
        }
      }

      // Tripwire grid reflects exfiltrated npmrc, read aws creds, and tampered workflows
      const npmrcTripwire = result.tripwires.find((t) => t.id === "tripwire-npmrc");
      const awsTripwire = result.tripwires.find((t) => t.id === "tripwire-aws");
      const workflowTripwire = result.tripwires.find((t) => t.id === "tripwire-workflows");
      expect(npmrcTripwire?.status).toBe("EXFILTRATED");
      expect(awsTripwire?.status).toBe("EXFILTRATED");
      expect(workflowTripwire?.status).toBe("TAMPERED");

      // Second detonation hits @sietch/core verdictCacheKey cache
      const cachedResult = await detonatePackage({
        packageName: "@sietch-demo/currency-format-lite",
        packageVersion: "1.0.2",
        packageDir: DEFAULT_LOCAL_PACKAGES["@sietch-demo/currency-format-lite"],
        mode: "local-sandbox",
      });
      expect(cachedResult.cacheHit).toBe(true);
      expect(cachedResult.cacheKey).toBe(result.cacheKey);
    });

    it("returns SAFE and allowsInstall=true for a clean benign package", async () => {
      const tmpPkg = await fs.mkdtemp(path.join(os.tmpdir(), "sietch-benign-pkg-"));
      try {
        await fs.writeFile(
          path.join(tmpPkg, "package.json"),
          JSON.stringify({ name: "clean-math-helper", version: "1.0.0", main: "index.js" }),
        );
        await fs.writeFile(
          path.join(tmpPkg, "index.js"),
          "module.exports = { add: (a, b) => a + b };\n",
        );

        const result = await detonatePackage({
          packageName: "clean-math-helper",
          packageVersion: "1.0.0",
          packageDir: tmpPkg,
          mode: "local-sandbox",
          bypassCache: true,
        });

        expect(result.verdict.kind).toBe("SAFE");
        expect(result.allowsInstall).toBe(true);
        expect(result.findings).toHaveLength(0);
      } finally {
        await fs.rm(tmpPkg, { recursive: true, force: true });
      }
    });
  });

  describe("Layer 2: Slopsquatting / Typosquatting & Fresh-Package Guard", () => {
    it("flags edit-distance-1 typosquats, suffix lookalikes, fresh packages (<48h), and hallucinated names", () => {
      expect(damerauLevenshtein("expresss", "express")).toBe(1);
      expect(damerauLevenshtein("axois", "axios")).toBe(1);

      const nowMs = Date.UTC(2026, 10, 21, 12, 0, 0);
      const report = runTyposquatGuard(
        [
          { name: "express", version: "4.21.1" }, // clean popular package
          { name: "expresss", version: "1.0.0" }, // edit distance 1
          { name: "axios-lite", version: "0.1.0" }, // suffix lookalike
          {
            name: "@sietch-demo/currency-format-lite",
            version: "1.0.2",
            metadata: { exists: true, publishedAt: new Date(nowMs - 6 * 3600 * 1000).toISOString() },
          },
          {
            name: "pulseshop-ai-hallucinated-sdk",
            version: "1.0.0",
            metadata: { exists: false },
          },
        ],
        { nowMs },
      );

      expect(report.status).toBe("BLOCK");
      const codes = report.findings.map((f) => `${f.packageName}:${f.code}`);
      expect(codes).toContain("expresss:TYPO_EDIT_DIST_1");
      expect(codes).toContain("axios-lite:SLOP_SUFFIX_LOOKALIKE");
      expect(codes).toContain("@sietch-demo/currency-format-lite:FRESH_PACKAGE_48H");
      expect(codes).toContain("@sietch-demo/currency-format-lite:SLOP_SUFFIX_LOOKALIKE");
      expect(codes).toContain("pulseshop-ai-hallucinated-sdk:SLOP_HALLUCINATED");
      expect(codes.some((c) => c.startsWith("express:"))).toBe(false);
    });
  });

  describe("Layer 3: PR Diff Guard (Secrets & Dangerous Infra Configs)", () => {
    it("parses Docker/K8s memory units accurately", () => {
      expect(parseMemoryToMiB("24m")).toBe(24);
      expect(parseMemoryToMiB("64Mi")).toBe(64);
      expect(parseMemoryToMiB("1g")).toBe(1024);
    });

    it("catches leaked AWS/GitHub/npm tokens, honeytokens, and removed HEALTHCHECK", async () => {
      const fakeDiff = [
        "diff --git a/.env b/.env",
        "+++ b/.env",
        "@@ -0,0 +1,4 @@",
        "+AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
        "+GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwx",
        "+NPM_TOKEN=npm_abcdefghijklmnopqrstuvwxyz1234567890",
        "+DATABASE_URL=postgres://admin:supersecretpass@prod.db:5432/shop",
        "diff --git a/services/orders/Dockerfile b/services/orders/Dockerfile",
        "+++ b/services/orders/Dockerfile",
        "@@ -10,3 +10,2 @@",
        "-HEALTHCHECK --interval=10s CMD curl -f http://localhost:4001/health || exit 1",
        "+USER root",
      ].join("\n");

      const report = await runDiffGuard(fakeDiff);
      expect(report.status).toBe("BLOCK");
      const codes = new Set(report.findings.map((f) => f.code));
      expect(codes.has("DIFF_AWS_KEY")).toBe(true);
      expect(codes.has("DIFF_GITHUB_TOKEN")).toBe(true);
      expect(codes.has("DIFF_NPM_TOKEN")).toBe(true);
      expect(codes.has("DIFF_ENV_SECRET")).toBe(true);
      expect(codes.has("INFRA_HEALTHCHECK_REMOVED")).toBe(true);
      expect(codes.has("INFRA_ROOT_USER")).toBe(true);
    });

    it("catches PulseShop's real `low-memory` branch (`mem_limit: 24m`) via Layer 3", async () => {
      const diffText = await getBranchDiffOrFallback("low-memory");

      const scan = await runSietchPrSuite({
        branch: "low-memory",
        prNumber: 43,
        diffText,
      });

      expect(scan.verdictKind).toBe("MALICIOUS");
      expect(scan.blocked).toBe(true);
      expect(scan.layer3DiffGuard.status).toBe("BLOCK");
      const lowMemFinding = scan.layer3DiffGuard.findings.find(
        (f) => f.code === "INFRA_LOW_MEMORY_LIMIT",
      );
      expect(lowMemFinding).toBeDefined();
      expect(lowMemFinding?.file).toBe("docker-compose.yml");
      expect(lowMemFinding?.snippet).toContain("mem_limit: 24m");
    });
  });

  describe("End-to-End 3-Layer PR Suite on PulseShop `bad-package` branch", () => {
    it("extracts @sietch-demo/currency-format-lite@1.0.2 from git diff and blocks PR with Red GitHub Check Run", async () => {
      const core = await loadSietchCore();
      const diffText = await getBranchDiffOrFallback("bad-package");

      const deps = extractPackageChangesFromDiff(diffText);
      expect(deps).toEqual([
        {
          name: "@sietch-demo/currency-format-lite",
          version: "1.0.2",
          file: "services/orders/package.json",
          action: "added",
        },
      ]);

      const scan = await runSietchPrSuite({
        branch: "bad-package",
        prNumber: 42,
        diffText,
      });

      expect(scan.rulesetVersion).toBe(core.RULESET_VERSION);
      expect(scan.verdictKind).toBe("MALICIOUS");
      expect(scan.blocked).toBe(true);
      expect(scan.githubCheckRun.conclusion).toBe("failure");
      expect(scan.layer1Detonations).toHaveLength(1);
      expect(scan.layer1Detonations[0].verdict.kind).toBe("MALICIOUS");
      expect(scan.layer2Typosquat.findings.length).toBeGreaterThanOrEqual(2);
      expect(scan.githubCheckRun.markdownReport).toContain("R1");
      expect(scan.githubCheckRun.markdownReport).toContain("R6");
    });
  });

  describe("Control Plane & Sietch HTTP API Integration", () => {
    it("serves /api/sietch/status, /api/dashboard/overview, and 1-tap approval execution", async () => {
      const app = await createControlPlaneApp();
      const server = app.listen(0);
      try {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        const base = `http://127.0.0.1:${port}`;

        const statusRes = await fetch(`${base}/api/sietch/status`);
        expect(statusRes.status).toBe(200);
        const statusJson = (await statusRes.json()) as {
          status: string;
          rulesetVersion: string;
          blockedScans: number;
        };
        expect(statusJson.status).toBe("online");
        expect(statusJson.blockedScans).toBeGreaterThanOrEqual(2);

        const overviewRes = await fetch(`${base}/api/dashboard/overview`);
        expect(overviewRes.status).toBe(200);
        const overview = (await overviewRes.json()) as {
          scorecard: { sietchPackagesBlocked: number; pendingApprovals: number };
          sietchScans: { branch: string; verdictKind: string }[];
        };
        expect(overview.scorecard.sietchPackagesBlocked).toBeGreaterThanOrEqual(2);
        expect(overview.sietchScans.some((s) => s.branch === "bad-package" && s.verdictKind === "MALICIOUS")).toBe(
          true,
        );
        expect(overview.sietchScans.some((s) => s.branch === "low-memory" && s.verdictKind === "MALICIOUS")).toBe(
          true,
        );

        const approveRes = await fetch(`${base}/api/approvals/APR-901/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "APPROVE" }),
        });
        expect(approveRes.status).toBe(200);
        const approveJson = (await approveRes.json()) as { approval: { status: string } };
        expect(approveJson.approval.status).toBe("EXECUTED");
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
