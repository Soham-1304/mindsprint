/**
 * Express Router for the Sietch 3-Layer Preventive Suite (`/api/sietch/*`).
 * Plugs directly into sre-agent/backend or runs inside standalone-server.ts.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import express, { type Request, type Response, type Router } from "express";

import { clearVerdictCache, detonatePackage, getVerdictCacheSize } from "./detonator.js";
import { loadSietchCore } from "./kiroween-bridge.js";
import { DEFAULT_LOCAL_PACKAGES, runSietchPrSuite } from "./suite.js";
import {
  ECOSYSTEM_ADAPTERS,
  type SietchExecutionMode,
  type SietchPrScanResult,
} from "./types.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PULSESHOP_DIR = path.resolve(__dirname, "../../../../pulseshop");

export interface SietchRouterOptions {
  readonly pulseshopDir?: string;
  readonly onScanComplete?: (scan: SietchPrScanResult) => void;
}

export interface SietchStore {
  readonly scans: SietchPrScanResult[];
  addScan(scan: SietchPrScanResult): void;
  getScan(id: string): SietchPrScanResult | undefined;
}

export function createSietchStore(): SietchStore {
  const scans: SietchPrScanResult[] = [];
  return {
    scans,
    addScan(scan) {
      scans.unshift(scan);
      if (scans.length > 50) scans.length = 50;
    },
    getScan(id) {
      return scans.find((s) => s.id === id);
    },
  };
}

const ALLOWED_BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,80}$/;

const FALLBACK_BRANCH_DIFFS: Readonly<Record<string, { commitSha: string; diffText: string }>> = {
  "bad-package": {
    commitSha: "3450f2f",
    diffText: [
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
    ].join("\n"),
  },
  "low-memory": {
    commitSha: "6e71525",
    diffText: [
      "diff --git a/docker-compose.yml b/docker-compose.yml",
      "--- a/docker-compose.yml",
      "+++ b/docker-compose.yml",
      "@@ -67,6 +67,7 @@ services:",
      "       context: .",
      "       dockerfile: services/orders/Dockerfile",
      "     container_name: pulseshop-orders",
      "+    mem_limit: 24m",
      "     restart: unless-stopped",
    ].join("\n"),
  },
};

export function createSietchRouter(
  store: SietchStore = createSietchStore(),
  options: SietchRouterOptions = {},
): Router {
  const router = express.Router();
  const pulseshopDir = options.pulseshopDir ?? process.env.PULSESHOP_REPO_DIR ?? DEFAULT_PULSESHOP_DIR;

  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const core = await loadSietchCore();
      const blockedCount = store.scans.filter((s) => s.blocked).length;
      res.json({
        status: "online",
        rulesetVersion: core.RULESET_VERSION,
        defaultMode: (process.env.SIETCH_MODE as SietchExecutionMode) ?? "local-sandbox",
        ecosystemAdapters: ECOSYSTEM_ADAPTERS,
        cachedVerdicts: getVerdictCacheSize(),
        totalScans: store.scans.length,
        blockedScans: blockedCount,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load Sietch status" });
    }
  });

  router.get("/scans", (_req: Request, res: Response) => {
    res.json({ scans: store.scans });
  });

  router.get("/scans/:id", (req: Request, res: Response) => {
    const scan = store.getScan(String(req.params.id));
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    res.json(scan);
  });

  router.post("/detonate", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        packageName?: string;
        packageVersion?: string;
        mode?: SietchExecutionMode;
        bypassCache?: boolean;
      };
      const packageName = body.packageName ?? "@sietch-demo/currency-format-lite";
      const packageVersion = body.packageVersion ?? "1.0.2";
      const pkgDir = DEFAULT_LOCAL_PACKAGES[packageName];
      if (!pkgDir) {
        res.status(400).json({ error: `Unknown local demo package: ${packageName}` });
        return;
      }

      const detonation = await detonatePackage({
        packageName,
        packageVersion,
        packageDir: pkgDir,
        mode: body.mode,
        bypassCache: body.bypassCache ?? true,
      });

      res.json(detonation);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Detonation failed" });
    }
  });

  router.post("/scan-pr", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        branch?: string;
        repo?: string;
        prNumber?: number;
        commitSha?: string;
        author?: string;
        diffText?: string;
        mode?: SietchExecutionMode;
        bypassCache?: boolean;
      };
      if (!body.diffText || typeof body.diffText !== "string") {
        res.status(400).json({ error: "diffText (string) is required" });
        return;
      }
      if (body.bypassCache) clearVerdictCache();

      const scan = await runSietchPrSuite({
        branch: body.branch ?? "pr/manual-scan",
        repo: body.repo ?? "pulseshop/pulseshop",
        prNumber: body.prNumber,
        commitSha: body.commitSha,
        author: body.author,
        diffText: body.diffText,
        mode: body.mode,
      });
      store.addScan(scan);
      options.onScanComplete?.(scan);
      res.json(scan);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "PR scan failed" });
    }
  });

  /**
   * Live scan of an actual git branch inside /Users/sohamkarandikar/Documents/MindSprint/pulseshop
   * (e.g. `bad-package` or `low-memory`).
   */
  router.post("/scan-branch", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        branch?: string;
        prNumber?: number;
        mode?: SietchExecutionMode;
        bypassCache?: boolean;
      };
      const branch = body.branch ?? "bad-package";
      if (!ALLOWED_BRANCH_PATTERN.test(branch)) {
        res.status(400).json({ error: "Invalid branch name" });
        return;
      }
      if (body.bypassCache) clearVerdictCache();

      let diffText = "";
      let commitSha = "";
      let author = "soham@pulseshop.io";

      try {
        const [{ stdout: gitDiff }, { stdout: metaOut }] = await Promise.all([
          execFileAsync("git", ["-C", pulseshopDir, "show", "--format=", branch], { maxBuffer: 2 * 1024 * 1024 }),
          execFileAsync("git", ["-C", pulseshopDir, "show", "-s", "--format=%H|%ae", branch]),
        ]);
        diffText = gitDiff;
        const [sha = "", gitAuthor = "soham@pulseshop.io"] = metaOut.trim().split("|");
        commitSha = sha.slice(0, 7);
        author = gitAuthor;
      } catch {
        const fallback = FALLBACK_BRANCH_DIFFS[branch];
        if (!fallback) {
          res.status(404).json({ error: `Branch '${branch}' not found in local PulseShop repo` });
          return;
        }
        diffText = fallback.diffText;
        commitSha = fallback.commitSha;
      }

      const scan = await runSietchPrSuite({
        branch,
        repo: "Soham-1304/pulseshop",
        prNumber: body.prNumber ?? (branch === "bad-package" ? 42 : branch === "low-memory" ? 43 : 44),
        commitSha,
        author,
        diffText,
        mode: body.mode,
      });

      store.addScan(scan);
      options.onScanComplete?.(scan);
      res.json(scan);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Branch scan failed" });
    }
  });

  return router;
}
