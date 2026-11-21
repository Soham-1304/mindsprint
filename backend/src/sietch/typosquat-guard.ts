/**
 * Layer 2: Slopsquatting, Typosquatting & Fresh-Package Guard
 *
 * Runs deterministically BEFORE behavioral sandbox detonation to catch:
 *  - Hallucinated / non-existent packages (AI slopsquatting)
 *  - Names at Damerau-Levenshtein edit distance 1 from popular npm packages
 *  - Slopsquatting suffix/prefix lookalikes (e.g., axios-lite, currency-format-lite)
 *  - Newly published packages (< 48 hours old)
 */

import type { PackageMetadataHint, TyposquatFinding, TyposquatReport } from "./types.js";

export const POPULAR_NPM_PACKAGES: readonly string[] = [
  "express",
  "lodash",
  "axios",
  "react",
  "react-dom",
  "mongoose",
  "cors",
  "chalk",
  "zod",
  "jsonwebtoken",
  "dotenv",
  "commander",
  "typescript",
  "prom-client",
  "currency-formatter",
  "currency-format",
  "currency.js",
  "dinero.js",
  "dayjs",
  "moment",
  "date-fns",
  "uuid",
  "nanoid",
  "winston",
  "pino",
  "fastify",
  "next",
  "vite",
  "esbuild",
  "webpack",
  "redis",
  "ioredis",
  "stripe",
  "bcrypt",
  "bcryptjs",
  "helmet",
  "morgan",
  "multer",
  "nodemailer",
  "pg",
  "prisma",
  "sequelize",
  "socket.io",
  "octokit",
  "vitest",
  "jest",
  "mocha",
  "supertest",
  "playwright",
  "puppeteer",
  "semver",
  "glob",
  "rimraf",
  "mkdirp",
  "minimist",
  "yargs",
  "inquirer",
  "ora",
  "boxen",
  "got",
  "node-fetch",
  "undici",
  "cheerio",
  "sharp",
  "compression",
  "cookie-parser",
  "body-parser",
  "http-proxy-middleware",
  "rate-limiter-flexible",
  "express-rate-limit",
  "class-validator",
  "ajv",
  "joi",
  "yup",
] as const;

const POPULAR_SET: ReadonlySet<string> = new Set(POPULAR_NPM_PACKAGES);

const SLOPSQUAT_SUFFIXES = [
  "-lite",
  "-mini",
  "-tiny",
  "-utils",
  "-util",
  "-helper",
  "-helpers",
  "-js",
  "-node",
  "-core",
  "-next",
  "-v2",
  "-plus",
  "-pro",
  "-fast",
  "-simple",
  "-easy",
] as const;

const FRESH_THRESHOLD_HOURS = 48;

/** Compute optimal string alignment (Damerau-Levenshtein) distance between two strings. */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = best;
    }
  }
  return dp[m][n];
}

/** Strip an npm scope (`@scope/pkg` -> `pkg`) for lookalike comparison. */
function barePackageName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1).toLowerCase() : name.toLowerCase();
}

export interface TyposquatCheckCandidate {
  readonly name: string;
  readonly version?: string;
  readonly metadata?: PackageMetadataHint;
}

export interface TyposquatGuardOptions {
  /** Current reference clock in ms (defaults to Date.now()). */
  readonly nowMs?: number;
}

/**
 * Evaluate a list of added or bumped packages against Layer 2 rules.
 */
export function runTyposquatGuard(
  candidates: readonly TyposquatCheckCandidate[],
  options: TyposquatGuardOptions = {},
): TyposquatReport {
  const nowMs = options.nowMs ?? Date.now();
  const findings: TyposquatFinding[] = [];

  for (const candidate of candidates) {
    const fullName = candidate.name.trim();
    const bare = barePackageName(fullName);
    const meta = candidate.metadata;

    // 1. Hallucinated / non-existent package check
    if (meta?.exists === false) {
      findings.push({
        code: "SLOP_HALLUCINATED",
        severity: "Critical",
        packageName: fullName,
        version: candidate.version,
        title: "Non-existent / hallucinated package name",
        explanation: `Package "${fullName}" does not exist in the upstream npm registry (classic LLM slopsquatting target).`,
      });
    }

    // 2. Fresh-package (< 48h) check
    if (meta?.publishedAt) {
      const publishedMs = Date.parse(meta.publishedAt);
      if (Number.isFinite(publishedMs)) {
        const ageHours = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60));
        if (ageHours < FRESH_THRESHOLD_HOURS) {
          findings.push({
            code: "FRESH_PACKAGE_48H",
            severity: "High",
            packageName: fullName,
            version: candidate.version,
            publishedAgeHours: Number(ageHours.toFixed(1)),
            title: "Newly published package (< 48 hours old)",
            explanation: `Package "${fullName}@${candidate.version ?? "latest"}" was published ${ageHours.toFixed(1)}h ago (below the 48h quarantine threshold).`,
          });
        }
      }
    }

    // Skip edit-distance / suffix checks if exact popular package name (unscoped)
    if (POPULAR_SET.has(fullName.toLowerCase())) {
      continue;
    }

    // 3. Edit distance 1 from a popular package (typosquatting)
    let closestMatch: { popular: string; distance: number } | null = null;
    for (const popular of POPULAR_NPM_PACKAGES) {
      if (bare === popular) continue;
      // Avoid noisy matches on very short 2-3 char names like "pg" or "ora"
      if (popular.length < 4 && bare.length < 4) continue;
      const dist = damerauLevenshtein(bare, popular);
      if (dist === 1) {
        closestMatch = { popular, distance: dist };
        break;
      }
    }

    if (closestMatch) {
      findings.push({
        code: "TYPO_EDIT_DIST_1",
        severity: "High",
        packageName: fullName,
        version: candidate.version,
        closestPopularPackage: closestMatch.popular,
        editDistance: closestMatch.distance,
        title: "Typosquatting lookalike (edit distance 1)",
        explanation: `Package "${fullName}" is 1 edit away from popular package "${closestMatch.popular}".`,
      });
      continue;
    }

    // 4. Slopsquatting suffix lookalike (e.g., axios-lite, currency-format-lite, express-helper)
    for (const suffix of SLOPSQUAT_SUFFIXES) {
      if (!bare.endsWith(suffix)) continue;
      const stem = bare.slice(0, bare.length - suffix.length);
      if (stem.length < 4) continue;
      const matchedPopular = POPULAR_NPM_PACKAGES.find(
        (pop) => pop === stem || pop.startsWith(stem) || damerauLevenshtein(stem, pop) <= 1,
      );
      if (matchedPopular) {
        findings.push({
          code: "SLOP_SUFFIX_LOOKALIKE",
          severity: "High",
          packageName: fullName,
          version: candidate.version,
          closestPopularPackage: matchedPopular,
          title: "Slopsquatting suffix lookalike",
          explanation: `Package "${fullName}" appends "${suffix}" to popular package stem "${matchedPopular}", a common AI slopsquatting pattern.`,
        });
        break;
      }
    }
  }

  const hasCritical = findings.some((f) => f.severity === "Critical");
  const hasHigh = findings.some((f) => f.severity === "High");
  const status: TyposquatReport["status"] = hasCritical ? "BLOCK" : hasHigh ? "WARN" : "PASS";

  return {
    layer: "LAYER_2_TYPOSQUAT",
    checkedPackages: candidates.length,
    status,
    findings,
  };
}
