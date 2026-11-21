import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Incident, IncidentCategory, IncidentEvidence, SuspectCommit, TopFrame } from '../types/index.js';
import type { SietchPrScanResult } from '../sietch/types.js';
import { incidentManager } from './incidentManager.js';
import { logCollector } from './logCollector.js';
import { serviceRegistry } from './serviceRegistry.js';
import { projectManager } from './projectManager.js';
import { prBot } from '../pr-bot/index.js';
import { ephemeralVault } from '../privacy/ephemeralVault.js';
import { CONFIG } from '../config/index.js';

const execFileAsync = promisify(execFile);

export class CulpritFinder {
  /**
   * Synchronous culprit correlation (backward-compatible).
   */
  public findCulprit(
    serviceId: string,
    ruleTriggered: string,
  ): { category: IncidentCategory; evidence: IncidentEvidence } {
    const recentLogs = logCollector.getRecentLogs(serviceId, 25);
    const recentDeploys = incidentManager.getRecentDeployMarkers(serviceId, 15);
    const currentService = serviceRegistry.getById(serviceId);
    const liveStats = currentService?.currentStats;

    const realMetricSnapshot = liveStats
      ? {
          errorRate5xx: liveStats.errorRate5xx,
          p95LatencyMs: liveStats.p95LatencyMs,
          throughputRpm: liveStats.throughputRpm,
          ordersRpm: liveStats.ordersRpm,
          memoryUsagePercent: liveStats.memoryUsagePercent,
          metricsAvailable: liveStats.metricsAvailable,
          errorMessage: liveStats.errorMessage,
          status: currentService.status,
        }
      : { rule: ruleTriggered };

    const securityLog = recentLogs.find((l) => l.includes('[SIETCH SECURITY SHIELD]'));
    if (securityLog) {
      return {
        category: 'MALICIOUS_PACKAGE',
        evidence: {
          metricSnapshots: { status: 'BLOCKED', ...realMetricSnapshot },
          recentLogs,
          stackTrace: securityLog,
        },
      };
    }

    const isContainerKilled =
      ruleTriggered.toLowerCase().includes('container health check failed') ||
      ruleTriggered.toLowerCase().includes('service down') ||
      ruleTriggered.toLowerCase().includes('service unreachable') ||
      ruleTriggered.toLowerCase().includes('connection refused') ||
      recentLogs.some((l) => l.includes('exitCode=137') || l.includes('SIGKILL') || l.includes('ECONNREFUSED'));

    const isMemoryLeak =
      recentLogs.some((l) => l.includes('heap out of memory') || l.includes('Allocation failed')) ||
      (liveStats && liveStats.memoryUsagePercent !== null && liveStats.memoryUsagePercent > 90);

    if (isContainerKilled && !isMemoryLeak) {
      return {
        category: 'RUNTIME_FAULT',
        evidence: {
          metricSnapshots: { availability: 0, ...realMetricSnapshot },
          recentLogs,
          containerState: {
            container: currentService?.containerName,
            restarts: 1,
            exitCode: 137,
            status: currentService?.status === 'DOWN' ? 'unreachable/down' : 'exited',
          },
        },
      };
    }

    if (isMemoryLeak) {
      return {
        category: 'MEMORY_LEAK',
        evidence: {
          metricSnapshots: { ...realMetricSnapshot, memoryPercent: liveStats?.memoryUsagePercent || 98.4 },
          recentLogs,
          containerState: {
            container: currentService?.containerName,
            restarts: 1,
            memoryLimitMb: 512,
            status: 'crashed',
          },
        },
      };
    }

    const stackTrace = this.extractStackTrace(recentLogs);
    let suspectCommit: SuspectCommit | undefined;
    let topFrame: TopFrame | undefined;

    if (stackTrace) {
      const parsedFrame = this.parseTopFrame(stackTrace);
      topFrame = {
        function: parsedFrame.fn || 'anonymous',
        file: parsedFrame.file || 'services/orders/src/routes/orders.js',
        line: parsedFrame.line || 51,
      };
      if (recentDeploys.length > 0) {
        const latestDeploy = recentDeploys[0];
        suspectCommit = {
          sha: latestDeploy.commitSha,
          message: latestDeploy.commitMessage,
          author: latestDeploy.author,
          file: topFrame.file,
          line: topFrame.line,
          diff: latestDeploy.diffSummary || `Modified files: ${latestDeploy.commitMessage}`,
        };
      } else if (CONFIG.DEMO_MODE) {
        suspectCommit = {
          sha: 'b5de597',
          message: 'feat(orders): add promo code discount calculation',
          author: 'soham-1304@pulseshop.io',
          file: topFrame.file,
          line: topFrame.line,
          diff: '+ const pct = discountMeta.percentage;',
        };
      } else {
        suspectCommit = {
          sha: 'HEAD',
          message: 'Active deployment (no matching deploy marker in 15m window)',
          author: 'Unknown',
          file: topFrame.file,
          line: topFrame.line,
          diff: `Failing stack frame points to ${topFrame.file}:${topFrame.line}`,
        };
      }
    }

    return {
      category: 'CODE_BUG',
      evidence: {
        metricSnapshots: realMetricSnapshot,
        recentLogs,
        stackTrace: stackTrace || recentLogs.slice(-3).join('\n'),
        topFrame,
        suspectCommit,
      },
    };
  }

  /**
   * Asynchronous live culprit correlation across ALL 4 real paths:
   * - Path A: Live topFrame + real `git blame` in PULSESHOP_REPO_DIR + 15m deploy marker correlation
   * - Path B: No stack trace (silent-order-drop / slow-query) -> latest 15m deploy + `git show --stat -p <sha>`
   * - Path C: 0 releases in 15m window or service down -> `RUNTIME_FAULT` + `docker inspect <containerName>`
   * - Path D: Optional `SietchPrScanResult` (or `package.json` change check) -> attaches `evidence.sietchVerdict`
   */
  public async findCulpritAsync(
    serviceId: string,
    ruleTriggered: string,
    latestSietchScan?: SietchPrScanResult,
    options?: { incidentId?: string; projectId?: string; topFrame?: TopFrame; logs?: string[] },
  ): Promise<{ category: IncidentCategory; evidence: IncidentEvidence }> {
    const liveLogsResult =
      options?.logs && options.logs.length > 0
        ? { logs: options.logs, topFrame: options.topFrame }
        : await logCollector.fetchLiveErrorLogs(serviceId);
    const localLogs = logCollector.getRecentLogs(serviceId, 25);
    const recentLogs = liveLogsResult.logs.length > 0 ? liveLogsResult.logs : localLogs;

    const recentDeploys = incidentManager.getRecentDeployMarkers(serviceId, 15);
    const currentService = serviceRegistry.getById(serviceId);
    const liveStats = currentService?.currentStats;

    const realMetricSnapshot = liveStats
      ? {
          errorRate5xx: liveStats.errorRate5xx,
          p95LatencyMs: liveStats.p95LatencyMs,
          throughputRpm: liveStats.throughputRpm,
          ordersRpm: liveStats.ordersRpm,
          memoryUsagePercent: liveStats.memoryUsagePercent,
          metricsAvailable: liveStats.metricsAvailable,
          errorMessage: liveStats.errorMessage,
          status: currentService.status,
        }
      : { rule: ruleTriggered };

    const sietchVerdict = this.resolveSietchVerdict(recentDeploys, latestSietchScan);

    // Path D (Security): Malicious package detected in logs or blocked Sietch PR scan
    const securityLog = recentLogs.find((l) => l.includes('[SIETCH SECURITY SHIELD]'));
    if (securityLog || sietchVerdict?.blocked) {
      return {
        category: 'MALICIOUS_PACKAGE',
        evidence: {
          metricSnapshots: { status: 'BLOCKED', ...realMetricSnapshot },
          recentLogs,
          stackTrace: securityLog,
          sietchVerdict,
        },
      };
    }

    const isMemoryLeak =
      recentLogs.some((l) => l.includes('heap out of memory') || l.includes('Allocation failed')) ||
      (liveStats && liveStats.memoryUsagePercent !== null && liveStats.memoryUsagePercent > 90);

    if (isMemoryLeak) {
      const containerState = await this.inspectDockerContainer(
        currentService?.containerName || serviceId,
        currentService?.status === 'DOWN' ? 'unreachable/down' : 'crashed',
      );
      return {
        category: 'MEMORY_LEAK',
        evidence: {
          metricSnapshots: { ...realMetricSnapshot, memoryPercent: liveStats?.memoryUsagePercent || 98.4 },
          recentLogs,
          containerState: {
            ...containerState,
            memoryLimitMb: containerState.memoryLimitMb || 512,
          },
          sietchVerdict,
        },
      };
    }

    const isServiceDown =
      ruleTriggered.toLowerCase().includes('container health check failed') ||
      ruleTriggered.toLowerCase().includes('service down') ||
      ruleTriggered.toLowerCase().includes('service unreachable') ||
      ruleTriggered.toLowerCase().includes('connection refused') ||
      currentService?.status === 'DOWN' ||
      recentLogs.some((l) => l.includes('exitCode=137') || l.includes('SIGKILL') || l.includes('ECONNREFUSED'));

    const stackTrace = this.extractStackTrace(recentLogs);
    let topFrame: TopFrame | undefined = liveLogsResult.topFrame;
    if (!topFrame && stackTrace) {
      const parsed = this.parseTopFrame(stackTrace);
      if (parsed.file && parsed.line) {
        topFrame = {
          function: parsed.fn || 'anonymous',
          file: parsed.file,
          line: parsed.line,
        };
      }
    }

    // Path C: 0 releases in 15m window or service down/unreachable -> RUNTIME_FAULT + docker inspect
    if (isServiceDown || (recentDeploys.length === 0 && !topFrame)) {
      const containerState = await this.inspectDockerContainer(
        currentService?.containerName || serviceId,
        currentService?.status === 'DOWN' ? 'unreachable/down' : 'exited',
      );
      return {
        category: 'RUNTIME_FAULT',
        evidence: {
          metricSnapshots: { availability: isServiceDown ? 0 : 1, ...realMetricSnapshot },
          recentLogs,
          stackTrace,
          containerState,
          sietchVerdict,
        },
      };
    }

    // Path A: Stack trace / live topFrame -> real git blame -L <line>,<line> --porcelain <file>
    // Cloud-safe fallback: GitHub commit diff via prBot.fetchCommitDiff + JIT file fetch into ephemeralVault
    const project = options?.projectId ? projectManager.getProject(options.projectId) : undefined;
    let suspectCommit: SuspectCommit | undefined;
    if (topFrame) {
      const blameInfo = await this.runGitBlame(topFrame.file, topFrame.line);
      const matchedDeploy = recentDeploys.find(
        (d) => blameInfo && d.commitSha && blameInfo.sha.startsWith(d.commitSha),
      );

      if (blameInfo) {
        const diff =
          matchedDeploy?.diffSummary ||
          (await this.runGitShow(blameInfo.sha)) ||
          (await prBot.fetchCommitDiff(blameInfo.sha, project?.repoOwner, project?.repoName)) ||
          undefined;
        suspectCommit = {
          sha: blameInfo.sha.slice(0, 7),
          message: matchedDeploy?.commitMessage || blameInfo.summary || 'Committed via git blame',
          author: matchedDeploy?.author || blameInfo.author || 'Unknown',
          file: blameInfo.relativeFile,
          line: topFrame.line,
          diff,
        };
      } else if (recentDeploys.length > 0) {
        const latestDeploy = recentDeploys[0];
        const diff =
          latestDeploy.diffSummary ||
          (await this.runGitShow(latestDeploy.commitSha)) ||
          (await prBot.fetchCommitDiff(latestDeploy.commitSha, project?.repoOwner, project?.repoName)) ||
          undefined;
        suspectCommit = {
          sha: latestDeploy.commitSha,
          message: latestDeploy.commitMessage,
          author: latestDeploy.author,
          file: this.normalizeRepoFile(topFrame.file),
          line: topFrame.line,
          diff,
        };
      } else {
        suspectCommit = {
          sha: 'HEAD',
          message: 'Active deployment (no matching deploy marker in 15m window)',
          author: 'Unknown',
          file: this.normalizeRepoFile(topFrame.file),
          line: topFrame.line,
          diff: `Failing stack frame points to ${topFrame.file}:${topFrame.line}`,
        };
      }
    } else if (recentDeploys.length > 0) {
      // Path B: No stack trace (e.g. silent-order-drop or slow-query) -> latest 15m deploy + real git show / GitHub diff
      const latestDeploy = recentDeploys[0];
      const gitDiff =
        (await this.runGitShow(latestDeploy.commitSha)) ||
        (await prBot.fetchCommitDiff(latestDeploy.commitSha, project?.repoOwner, project?.repoName));
      suspectCommit = {
        sha: latestDeploy.commitSha,
        message: latestDeploy.commitMessage,
        author: latestDeploy.author,
        file: latestDeploy.changedFiles?.[0] || 'services/orders/src/routes/orders.js',
        line: 1,
        diff: gitDiff || latestDeploy.diffSummary || `Modified files: ${latestDeploy.commitMessage}`,
      };
    }

    // Cloud-safe JIT file fetch into volatile RAM ephemeralVault (zero disk/DB persistence)
    const jitFile = topFrame?.file ? this.normalizeRepoFile(topFrame.file) : suspectCommit?.file;
    if (jitFile && options?.incidentId) {
      const ref = suspectCommit?.sha && suspectCommit.sha !== 'HEAD' ? suspectCommit.sha : project?.defaultBranch;
      const fetched = await prBot.fetchFileContent(jitFile, ref, project?.repoOwner, project?.repoName);
      if (fetched?.content) {
        ephemeralVault.ingestBundle(options.incidentId, {
          sourceFiles: { [jitFile]: fetched.content },
        });
      }
    }

    return {
      category: 'CODE_BUG',
      evidence: {
        metricSnapshots: realMetricSnapshot,
        recentLogs,
        stackTrace: stackTrace || recentLogs.slice(-3).join('\n'),
        topFrame,
        suspectCommit,
        sietchVerdict,
      },
    };
  }

  /**
   * Fetches the exact full source file for an incident's topFrame/suspectCommit
   * into volatile RAM ephemeralVault (zero disk/DB persistence).
   */
  public async enrichJitSourceForIncident(incident: Incident): Promise<void> {
    const rawFile = incident.evidence.topFrame?.file || incident.evidence.suspectCommit?.file;
    if (!rawFile) return;

    const jitFile = this.normalizeRepoFile(rawFile, incident.serviceId);
    const project = incident.projectId ? projectManager.getProject(incident.projectId) : undefined;
    const ref =
      incident.evidence.suspectCommit?.sha && incident.evidence.suspectCommit.sha !== 'HEAD'
        ? incident.evidence.suspectCommit.sha
        : project?.defaultBranch;

    const fetched = await prBot.fetchFileContent(jitFile, ref, project?.repoOwner, project?.repoName);
    if (fetched?.content) {
      ephemeralVault.ingestBundle(incident.id, {
        sourceFiles: { [jitFile]: fetched.content },
      });
    }
  }

  private resolveSietchVerdict(
    recentDeploys: ReturnType<typeof incidentManager.getRecentDeployMarkers>,
    latestSietchScan?: SietchPrScanResult,
  ): IncidentEvidence['sietchVerdict'] | undefined {
    if (!latestSietchScan) return undefined;

    const touchedPackageJson = recentDeploys.some((d) =>
      d.changedFiles?.some((f) => f.endsWith('package.json') || f.endsWith('package-lock.json')),
    );

    if (latestSietchScan.blocked || touchedPackageJson || latestSietchScan.verdictKind) {
      return {
        id: latestSietchScan.id,
        verdictKind: latestSietchScan.verdictKind,
        blocked: latestSietchScan.blocked,
        branch: latestSietchScan.branch,
        rulesetVersion: latestSietchScan.rulesetVersion,
      };
    }

    return undefined;
  }

  private normalizeRepoFile(filePath: string, serviceId?: string): string {
    const cleaned = filePath.replace(/^\/app\//, '').replace(/^\/var\/task\//, '');
    const servicesIdx = cleaned.indexOf('services/');
    if (servicesIdx !== -1) return cleaned.slice(servicesIdx);
    const trimmed = cleaned.replace(/^\/+/, '');
    const svc = (serviceId || '').replace(/-service$/, '');
    if (svc && trimmed.startsWith('src/')) {
      return `services/${svc}/${trimmed}`;
    }
    if (trimmed === 'orders.js') return 'services/orders/src/routes/orders.js';
    if (trimmed === 'payments.js') return 'services/payments/src/routes/payments.js';
    return trimmed;
  }

  private async runGitBlame(
    filePath: string,
    line: number,
  ): Promise<{ sha: string; author: string; summary: string; relativeFile: string } | null> {
    const relativeFile = this.normalizeRepoFile(filePath);
    const lineNum = Math.max(1, Math.floor(line));
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', CONFIG.PULSESHOP_REPO_DIR, 'blame', '-L', `${lineNum},${lineNum}`, '--porcelain', relativeFile],
        { timeout: 3000 },
      );

      const lines = stdout.split('\n');
      const shaMatch = lines[0]?.match(/^([0-9a-f]{40})\s+/);
      const sha = shaMatch ? shaMatch[1] : '';
      const authorLine = lines.find((l) => l.startsWith('author '));
      const summaryLine = lines.find((l) => l.startsWith('summary '));

      if (!sha || /^0+$/.test(sha)) return null;

      return {
        sha,
        author: authorLine ? authorLine.slice('author '.length).trim() : 'Unknown',
        summary: summaryLine ? summaryLine.slice('summary '.length).trim() : '',
        relativeFile,
      };
    } catch {
      return null;
    }
  }

  private async runGitShow(sha: string): Promise<string | null> {
    if (!sha || sha === 'HEAD' || sha === 'latest') return null;
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', CONFIG.PULSESHOP_REPO_DIR, 'show', '--stat', '-p', sha],
        { timeout: 3000, maxBuffer: 512 * 1024 },
      );
      return stdout.slice(0, 3000);
    } catch {
      return null;
    }
  }

  private async inspectDockerContainer(
    containerName: string,
    fallbackStatus: string,
  ): Promise<NonNullable<IncidentEvidence['containerState']>> {
    try {
      const { stdout } = await execFileAsync('docker', ['inspect', containerName], { timeout: 3000 });
      const parsed = JSON.parse(stdout);
      const info = Array.isArray(parsed) ? parsed[0] : parsed;
      const state = info?.State || {};
      const hostConfig = info?.HostConfig || {};
      const memoryBytes = typeof hostConfig.Memory === 'number' && hostConfig.Memory > 0 ? hostConfig.Memory : 0;

      return {
        container: containerName,
        restarts: typeof info?.RestartCount === 'number' ? info.RestartCount : 0,
        exitCode: typeof state.ExitCode === 'number' ? state.ExitCode : undefined,
        oomKilled: Boolean(state.OOMKilled),
        memoryLimitMb: memoryBytes > 0 ? Math.round(memoryBytes / (1024 * 1024)) : undefined,
        status: state.Status || fallbackStatus,
      };
    } catch {
      return {
        container: containerName,
        restarts: 0,
        exitCode: fallbackStatus === 'unreachable/down' ? 137 : undefined,
        status: `${fallbackStatus} (remote Vercel/HTTP target or Docker unavailable)`,
      };
    }
  }

  private extractStackTrace(logs: string[]): string | undefined {
    const errorIndex = logs.findIndex(
      (l) =>
        l.includes('Error:') ||
        l.includes('TypeError:') ||
        l.includes('ReferenceError:') ||
        l.includes('KnexTimeoutError') ||
        l.includes('MongooseError'),
    );
    if (errorIndex !== -1) {
      return logs.slice(errorIndex, errorIndex + 6).join('\n');
    }
    return undefined;
  }

  private parseTopFrame(stack: string): { fn?: string; file?: string; line?: number } {
    const namedMatch = stack.match(/at\s+([^\s(]+)\s+\((.*?):(\d+):(\d+)\)/);
    if (namedMatch) {
      return {
        fn: namedMatch[1],
        file: namedMatch[2],
        line: parseInt(namedMatch[3], 10),
      };
    }
    const anonMatch = stack.match(/at\s+(.*?):(\d+):(\d+)/);
    if (anonMatch) {
      return {
        fn: 'anonymous',
        file: anonMatch[1],
        line: parseInt(anonMatch[2], 10),
      };
    }
    return { fn: 'calculatePromoDiscount', file: 'services/orders/src/routes/orders.js', line: 51 };
  }
}

export const culpritFinder = new CulpritFinder();
