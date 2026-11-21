/**
 * Layer 1: Behavioral Sandbox Detonation (Core Sietch)
 *
 * Reuses:
 *  - @sietch/sandbox: buildCiProfile(), buildFakeHome() (checksum-valid honeytokens)
 *  - @sietch/core:    judge(), allowsInstall(), verdictCacheKey(), validateScanInput(), RULESET_VERSION
 *
 * Execution modes:
 *  - SIETCH_MODE=gvisor:        Checks runsc runtime via @sietch/sandbox; falls back cleanly if unavailable on macOS host.
 *  - SIETCH_MODE=fast-docker:   Runs node --require preload-hook.cjs inside a `--network=none --cap-drop=ALL` Docker container.
 *  - SIETCH_MODE=local-sandbox: Runs node --require preload-hook.cjs inside an ephemeral temp FakeHome with all network calls intercepted locally.
 */

import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  computeSha512Integrity,
  createCryptoRng,
  createSeededRng,
  type Event,
  type Finding,
  type FakeHome,
  loadSietchCore,
  loadSietchSandbox,
  type Profile,
  type RuleId,
  type ScanInput,
} from "./kiroween-bridge.js";
import type {
  Layer1DetonationResult,
  SietchExecutionMode,
  TripwireEntry,
} from "./types.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_HOOK_PATH = path.join(__dirname, "preload-hook.cjs");

/** In-memory verdict cache keyed by @sietch/core's verdictCacheKey(). */
const verdictCache = new Map<string, Layer1DetonationResult>();

export function getVerdictCacheSize(): number {
  return verdictCache.size;
}

export function clearVerdictCache(): void {
  verdictCache.clear();
}

export interface DetonatePackageOptions {
  readonly packageName: string;
  readonly packageVersion: string;
  /** Path to an unpacked npm package directory on disk. */
  readonly packageDir: string;
  readonly mode?: SietchExecutionMode;
  /** Optional deterministic RNG seed for repeatable tests/demos. */
  readonly seed?: string;
  /** Bypass the verdict cache and force a fresh detonation. */
  readonly bypassCache?: boolean;
  /** Allowlisted hosts (defaults to npm registry only). */
  readonly allowlist?: readonly string[];
}

async function hashDirectoryIntegrity(dir: string): Promise<string> {
  const entries = (await fs.readdir(dir)).sort();
  const chunks: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      const content = await fs.readFile(full, "utf8");
      chunks.push(`${name}:${content}`);
    }
  }
  return computeSha512Integrity(chunks.join("\n---\n"));
}

async function materializeFakeHome(fakeHome: FakeHome, targetHomeDir: string): Promise<void> {
  await fs.mkdir(targetHomeDir, { recursive: true });
  for (const dir of fakeHome.directories) {
    const rel = dir.path.slice(fakeHome.home.length + 1);
    const dest = path.join(targetHomeDir, rel);
    await fs.mkdir(dest, { recursive: true, mode: dir.mode });
  }
  for (const file of fakeHome.files) {
    const rel = file.path.slice(fakeHome.home.length + 1);
    const dest = path.join(targetHomeDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.bytes, { mode: file.mode });
  }
}

async function copyPackageIntoNodeModules(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyPackageIntoNodeModules(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

async function isGvisorAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("docker", ["info", "--format", "{{json .Runtimes}}"], {
      timeout: 2500,
    });
    return stdout.includes("runsc");
  } catch {
    return false;
  }
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: 1, stderr });
    });
  });
}

function buildTripwireGrid(
  profile: Profile,
  events: readonly Event[],
  findings: readonly Finding[],
): TripwireEntry[] {
  const eventBySeq = new Map<number, Event>(events.map((e) => [e.seq, e]));

  const targets: {
    id: string;
    label: string;
    location: string;
    kind: TripwireEntry["kind"];
    pathNeedle: string;
    tokenNeedle?: string;
  }[] = [
    {
      id: "tripwire-npmrc",
      label: "~/.npmrc",
      location: `${profile.home}/.npmrc`,
      kind: "npm",
      pathNeedle: "/.npmrc",
      tokenNeedle: "npm",
    },
    {
      id: "tripwire-aws",
      label: "~/.aws/credentials",
      location: `${profile.home}/.aws/credentials`,
      kind: "aws-access-key",
      pathNeedle: "/.aws/credentials",
      tokenNeedle: "aws",
    },
    {
      id: "tripwire-ssh",
      label: "~/.ssh/id_ed25519",
      location: `${profile.home}/.ssh/id_ed25519`,
      kind: "ssh-key",
      pathNeedle: "/.ssh/id_ed25519",
      tokenNeedle: "ssh",
    },
    {
      id: "tripwire-workflows",
      label: ".github/workflows",
      location: `${profile.projectDir}/.github/workflows`,
      kind: "workflow",
      pathNeedle: "/.github/workflows",
    },
    {
      id: "tripwire-env",
      label: "workspace/.env",
      location: `${profile.projectDir}/.env`,
      kind: "env",
      pathNeedle: "/.env",
      tokenNeedle: "dotenv",
    },
    {
      id: "tripwire-github",
      label: "GITHUB_TOKEN / gh",
      location: `${profile.home}/.config/gh/hosts.yml`,
      kind: "github",
      pathNeedle: "/.config/gh/hosts.yml",
      tokenNeedle: "github",
    },
    {
      id: "tripwire-docker",
      label: "~/.docker/config.json",
      location: `${profile.home}/.docker/config.json`,
      kind: "generic",
      pathNeedle: "/.docker/config.json",
      tokenNeedle: "docker",
    },
  ];

  return targets.map((target) => {
    const matchedSeqs = new Set<number>();
    const matchedRules = new Set<RuleId>();
    let status: TripwireEntry["status"] = "UNTOUCHED";
    let detail = "Planted decoy untouched";

    for (const evt of events) {
      if (evt.type === "file_read" && evt.path.includes(target.pathNeedle)) {
        matchedSeqs.add(evt.seq);
        if (status === "UNTOUCHED") {
          status = "READ";
          detail = `Read by PID ${evt.pid} at seq #${evt.seq}`;
        }
      }
      if (evt.type === "file_write" && evt.path.includes(target.pathNeedle)) {
        matchedSeqs.add(evt.seq);
        status = "TAMPERED";
        detail = `${evt.op} on ${evt.path.split("/").slice(-3).join("/")} at seq #${evt.seq}`;
      }
    }

    for (const f of findings) {
      const touchesSeq = f.evidence.some((seq) => matchedSeqs.has(seq));
      const mentionsToken =
        f.ruleId === "R1" &&
        target.tokenNeedle &&
        f.explanation.toLowerCase().includes(target.tokenNeedle);

      if (mentionsToken) {
        matchedRules.add("R1");
        for (const seq of f.evidence) matchedSeqs.add(seq);
        status = "EXFILTRATED";
        detail = f.explanation;
      } else if (touchesSeq) {
        matchedRules.add(f.ruleId);
        if (f.ruleId === "R6" && target.kind === "workflow") {
          status = "TAMPERED";
          detail = f.explanation;
        }
      } else if (
        f.ruleId === "R6" &&
        target.kind === "workflow" &&
        f.evidence.some((seq) => {
          const e = eventBySeq.get(seq);
          return e?.type === "file_write" && e.path.includes(".github/workflows");
        })
      ) {
        matchedRules.add("R6");
        for (const seq of f.evidence) matchedSeqs.add(seq);
        status = "TAMPERED";
        detail = f.explanation;
      }
    }

    return {
      id: target.id,
      label: target.label,
      location: target.location,
      kind: target.kind,
      status,
      ruleIds: [...matchedRules],
      evidenceSeqs: [...matchedSeqs].sort((a, b) => a - b),
      detail,
    };
  });
}

/**
 * Detonate an npm package in an isolated sandbox seeded with real @sietch/sandbox
 * honeytokens and evaluate every captured event with @sietch/core's deterministic judge().
 */
export async function detonatePackage(
  options: DetonatePackageOptions,
): Promise<Layer1DetonationResult> {
  const startedAt = Date.now();
  const core = await loadSietchCore();
  const sandbox = await loadSietchSandbox();

  const requestedMode: SietchExecutionMode =
    options.mode ?? (process.env.SIETCH_MODE as SietchExecutionMode) ?? "local-sandbox";

  const integrity = await hashDirectoryIntegrity(options.packageDir);
  const cacheKey = core.verdictCacheKey(
    {
      name: options.packageName,
      version: options.packageVersion,
      integrity,
    },
    core.RULESET_VERSION,
  );

  if (!options.bypassCache) {
    const cached = verdictCache.get(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }
  }

  // Resolve effective mode cleanly (fail-safe fallback on macOS without runsc/Docker daemon)
  let effectiveMode: SietchExecutionMode = requestedMode;
  let fallbackNote: string | undefined;

  if (requestedMode === "gvisor") {
    const hasGvisor = await isGvisorAvailable();
    if (!hasGvisor) {
      const hasDocker = await isDockerAvailable();
      effectiveMode = hasDocker ? "fast-docker" : "local-sandbox";
      fallbackNote = `gVisor (runsc) not available on host; executed via ${effectiveMode} feeding real @sietch/core judge().`;
    } else {
      // Even when gVisor exists, local demo packages without pre-built 4-image tarballs use fast-docker
      effectiveMode = "fast-docker";
      fallbackNote = "Local fixture package executed in fast-docker mode with @sietch/sandbox honeytokens.";
    }
  } else if (requestedMode === "fast-docker") {
    const hasDocker = await isDockerAvailable();
    if (!hasDocker) {
      effectiveMode = "local-sandbox";
      fallbackNote = "Docker daemon unavailable; executed via isolated local-sandbox preload hook.";
    }
  }

  // 1. Build real @sietch/sandbox GitHub Actions CI profile & FakeHome (15 checksum-valid honeytokens)
  const rng = options.seed ? createSeededRng(options.seed) : createCryptoRng();
  const arch = os.arch() === "arm64" ? "arm64" : "x64";
  const profile = sandbox.buildCiProfile({
    rng,
    clock: () => Date.now(),
    arch,
  });
  const fakeHome = sandbox.buildFakeHome(profile);

  // 2. Materialize isolated temp directory for the fake home & workspace
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sietch-detonate-"));
  const realHome = path.join(tempRoot, "home");
  const projectRel = profile.projectDir.slice(profile.home.length + 1);
  const realProject = path.join(realHome, projectRel);
  const realNodeModules = path.join(realProject, "node_modules");
  const pkgInstallDir = path.join(realNodeModules, ...options.packageName.split("/"));
  const traceFile = path.join(tempRoot, "trace.ndjson");

  try {
    await materializeFakeHome(fakeHome, realHome);
    await copyPackageIntoNodeModules(options.packageDir, pkgInstallDir);
    await fs.writeFile(traceFile, "", "utf8");

    const pkgJsonRaw = await fs.readFile(path.join(pkgInstallDir, "package.json"), "utf8");
    const pkgJson = JSON.parse(pkgJsonRaw) as {
      main?: string;
      scripts?: Record<string, string>;
    };

    const originMs = Date.now();

    const baseEnv: NodeJS.ProcessEnv = {
      ...profile.env,
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: realHome,
      GITHUB_WORKSPACE: realProject,
      SIETCH_SANDBOX_DETONATION: "1",
      SIETCH_TRACE_FILE: traceFile,
      SIETCH_REAL_HOME: realHome,
      SIETCH_VIRTUAL_HOME: profile.home,
      SIETCH_REAL_PROJECT: realProject,
      SIETCH_VIRTUAL_PROJECT: profile.projectDir,
      SIETCH_ORIGIN_MS: String(originMs),
    };

    // 3. Execute lifecycle scripts (`preinstall`, `install`, `postinstall`) in install phase
    const lifecycleHooks = ["preinstall", "install", "postinstall"] as const;
    let nextPid = 102;
    for (const hook of lifecycleHooks) {
      const scriptCmd = pkgJson.scripts?.[hook];
      if (!scriptCmd) continue;

      const scriptParts = scriptCmd.trim().split(/\s+/);
      const isNodeScript = scriptParts[0] === "node" && scriptParts.length >= 2;
      const scriptTarget = isNodeScript
        ? path.resolve(pkgInstallDir, scriptParts[1])
        : null;

      if (effectiveMode === "fast-docker" && scriptTarget) {
        const containerHome = profile.home;
        const containerProject = profile.projectDir;
        const containerPkgDir = path.posix.join(containerProject, "node_modules", options.packageName);
        const containerScript = path.posix.join(containerPkgDir, scriptParts[1]);
        await runProcess(
          "docker",
          [
            "run",
            "--rm",
            "--network=none",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--memory=128m",
            "--cpus=0.5",
            "-v",
            `${realHome}:${containerHome}:rw`,
            "-v",
            `${traceFile}:/tmp/sietch-trace.ndjson:rw`,
            "-v",
            `${PRELOAD_HOOK_PATH}:/tmp/preload-hook.cjs:ro`,
            "-w",
            containerPkgDir,
            "-e",
            `HOME=${containerHome}`,
            "-e",
            `GITHUB_WORKSPACE=${containerProject}`,
            "-e",
            "SIETCH_SANDBOX_DETONATION=1",
            "-e",
            "SIETCH_TRACE_FILE=/tmp/sietch-trace.ndjson",
            "-e",
            `SIETCH_REAL_HOME=${containerHome}`,
            "-e",
            `SIETCH_VIRTUAL_HOME=${containerHome}`,
            "-e",
            `SIETCH_REAL_PROJECT=${containerProject}`,
            "-e",
            `SIETCH_VIRTUAL_PROJECT=${containerProject}`,
            "-e",
            "SIETCH_PHASE=install",
            "-e",
            `SIETCH_ORIGIN_MS=${originMs}`,
            "-e",
            `SIETCH_VIRTUAL_PID=${nextPid++}`,
            "-e",
            "SIETCH_VIRTUAL_PPID=1",
            "node:22-alpine",
            "node",
            "--require",
            "/tmp/preload-hook.cjs",
            containerScript,
            ...scriptParts.slice(2),
          ],
          { cwd: pkgInstallDir, env: process.env, timeoutMs: 12000 },
        );
      } else if (scriptTarget) {
        await runProcess(
          process.execPath,
          ["--require", PRELOAD_HOOK_PATH, scriptTarget, ...scriptParts.slice(2)],
          {
            cwd: pkgInstallDir,
            env: {
              ...baseEnv,
              SIETCH_PHASE: "install",
              SIETCH_VIRTUAL_PID: String(nextPid++),
              SIETCH_VIRTUAL_PPID: "1",
            },
            timeoutMs: 8000,
          },
        );
      }
    }

    // 4. Execute `load` phase: require() the package entry point
    const entryFile = path.resolve(pkgInstallDir, pkgJson.main ?? "index.js");
    const entryExists = await fs
      .access(entryFile)
      .then(() => true)
      .catch(() => false);

    if (entryExists) {
      await runProcess(
        process.execPath,
        [
          "--require",
          PRELOAD_HOOK_PATH,
          "-e",
          `const mod = require(${JSON.stringify(entryFile)}); if (mod && typeof mod.formatCurrency === "function") mod.formatCurrency(42.5);`,
        ],
        {
          cwd: realProject,
          env: {
            ...baseEnv,
            SIETCH_PHASE: "load",
            SIETCH_VIRTUAL_PID: String(nextPid++),
            SIETCH_VIRTUAL_PPID: "1",
          },
          timeoutMs: 6000,
        },
      );
    }

    // 5. Parse captured NDJSON trace into strict @sietch/core Event[] with monotonic seq #1..#N
    const traceRaw = await fs.readFile(traceFile, "utf8");
    const parsedRaw = traceRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    let seq = 1;
    const events: Event[] = [];

    // Seed package-manager exec event (pid 1) so traces for zero-script packages still satisfy @sietch/core
    events.push({
      type: "exec",
      seq: seq++,
      t: 0,
      phase: "install",
      pid: 1,
      ppid: 0,
      path: "/usr/local/bin/npm",
      argv: ["npm", "ci", "--offline"],
    });

    for (const raw of parsedRaw) {
      events.push({
        ...(raw as Omit<Event, "seq">),
        seq: seq++,
      } as Event);
    }

    // 6. Assemble strict @sietch/core ScanInput and run REAL judge()
    const scanInput: ScanInput = {
      package: {
        name: options.packageName,
        version: options.packageVersion,
        integrity,
      },
      environment: {
        home: profile.home,
        projectDir: profile.projectDir,
        nodeModulesDir: profile.nodeModulesDir,
        tmpDirs: [...profile.tmpDirs],
        packageManagerPid: 1,
        sinkAddresses: ["10.200.0.2"],
        extraCredentialPaths: [...fakeHome.extraCredentialPaths],
      },
      allowlist: [...(options.allowlist ?? ["registry.npmjs.org"])],
      honeytokens: profile.honeytokens.map((h) => ({
        id: h.id,
        kind: h.kind,
        value: h.value,
      })),
      events,
      eventsTruncated: false,
    };

    const validation = core.validateScanInput(scanInput);
    const verdict = validation.ok
      ? core.judge(validation.value)
      : core.errorVerdict(validation.reason);
    const allowed = core.allowsInstall(verdict);
    const findings = verdict.findings;
    const tripwires = buildTripwireGrid(profile, events, findings);

    const result: Layer1DetonationResult = {
      packageName: options.packageName,
      packageVersion: options.packageVersion,
      integrity,
      cacheKey,
      cacheHit: false,
      mode: effectiveMode,
      requestedMode,
      fallbackNote,
      rulesetVersion: core.RULESET_VERSION,
      verdict,
      allowsInstall: allowed,
      durationMs: Math.max(1, Date.now() - startedAt),
      honeytokensPlanted: profile.honeytokens.length,
      tripwires,
      events,
      findings,
    };

    verdictCache.set(cacheKey, result);
    return result;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}
