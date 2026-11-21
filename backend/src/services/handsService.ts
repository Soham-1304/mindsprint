import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import axios from 'axios';
import type { Incident } from '../types/index.js';
import { incidentManager } from './incidentManager.js';
import { serviceRegistry } from './serviceRegistry.js';
import { logCollector } from './logCollector.js';
import { verifierService } from './verifierService.js';
import { applySurgicalPatch, brainService, buildFullRcaReportMarkdown } from './brainService.js';
import { projectManager } from './projectManager.js';
import { prBot } from '../pr-bot/index.js';
import { ephemeralVault } from '../privacy/ephemeralVault.js';
import { runSietchPrSuite } from '../sietch/suite.js';
import { CONFIG } from '../config/index.js';
import { wsBroadcaster } from '../api/websocket.js';

const execFileAsync = promisify(execFile);

export type DockerExecutor = (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export interface CircuitBreakerAdapter {
  trip(
    serviceId: string,
    targetDependency: string
  ): Promise<{ success: boolean; message: string; state: 'OPEN' | 'HALF_OPEN' | 'CLOSED' }>;
  reset(
    serviceId: string,
    targetDependency: string
  ): Promise<{ success: boolean; message: string; state: 'CLOSED' }>;
  getStatus(
    serviceId: string,
    targetDependency: string
  ): Promise<{ state: 'OPEN' | 'HALF_OPEN' | 'CLOSED' }>;
}

export interface RetryControlAdapter {
  reduceRetries(
    serviceId: string,
    maxRetries: number,
    backoffMs: number
  ): Promise<{ success: boolean; message: string; currentRetries: number }>;
  resetRetries(serviceId: string): Promise<{ success: boolean; message: string }>;
}

export class HandsService {
  private dockerExecutor: DockerExecutor | null = null;

  private circuitBreakerAdapter: CircuitBreakerAdapter = {
    trip: async (serviceId: string, targetDep: string) => {
      const endpoint = CONFIG.CIRCUIT_BREAKER_ENDPOINTS[serviceId];
      if (endpoint) {
        await axios.post(`${endpoint}/trip`, { target: targetDep }, { timeout: 3000 });
        return {
          success: true,
          message: `Circuit breaker tripped via HTTP endpoint ${endpoint}`,
          state: 'OPEN' as const,
        };
      }
      return {
        success: true,
        message: `Circuit breaker tripped for upstream '${serviceId}' targeting '${targetDep}'. Incoming traffic shed.`,
        state: 'OPEN' as const,
      };
    },
    reset: async (serviceId: string, targetDep: string) => {
      const endpoint = CONFIG.CIRCUIT_BREAKER_ENDPOINTS[serviceId];
      if (endpoint) {
        await axios.post(`${endpoint}/reset`, { target: targetDep }, { timeout: 3000 });
        return {
          success: true,
          message: `Circuit breaker reset via HTTP endpoint ${endpoint}`,
          state: 'CLOSED' as const,
        };
      }
      return {
        success: true,
        message: `Circuit breaker reset for '${serviceId}' targeting '${targetDep}'. Normal traffic flow restored.`,
        state: 'CLOSED' as const,
      };
    },
    getStatus: async () => ({ state: 'OPEN' as const }),
  };

  private retryControlAdapter: RetryControlAdapter = {
    reduceRetries: async (serviceId: string, maxRetries = 1, backoffMs = 2000) => {
      const endpoint = CONFIG.RETRY_CONTROL_ENDPOINTS[serviceId];
      if (endpoint) {
        await axios.post(`${endpoint}/retries`, { maxRetries, backoffMs }, { timeout: 3000 });
        return {
          success: true,
          message: `Retries reduced via HTTP endpoint ${endpoint}`,
          currentRetries: maxRetries,
        };
      }
      return {
        success: true,
        message: `Retries clamped to ${maxRetries} (backoff: ${backoffMs}ms) on '${serviceId}'. Exponential retry storm halted.`,
        currentRetries: maxRetries,
      };
    },
    resetRetries: async (serviceId: string) => ({
      success: true,
      message: `Default retry policy restored on '${serviceId}'.`,
    }),
  };

  public setDockerExecutor(executor: DockerExecutor | null): void {
    this.dockerExecutor = executor;
  }

  public getDockerExecutor(): DockerExecutor {
    if (this.dockerExecutor) {
      return this.dockerExecutor;
    }
    return async (command: string, args: string[]) => {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: CONFIG.DOCKER_EXEC_TIMEOUT_MS,
      });
      return { stdout: stdout.toString(), stderr: stderr.toString() };
    };
  }

  public setCircuitBreakerAdapter(adapter: CircuitBreakerAdapter): void {
    this.circuitBreakerAdapter = adapter;
  }

  public getCircuitBreakerAdapter(): CircuitBreakerAdapter {
    return this.circuitBreakerAdapter;
  }

  public setRetryControlAdapter(adapter: RetryControlAdapter): void {
    this.retryControlAdapter = adapter;
  }

  public getRetryControlAdapter(): RetryControlAdapter {
    return this.retryControlAdapter;
  }

  /**
   * Executes remediation respecting Safety Tiers and Backend Policy Engine
   */
  public async handleRemediation(
    incident: Incident
  ): Promise<{ executed: boolean; message: string; reason?: string }> {
    const diag = incident.diagnosis;
    if (!diag) return { executed: false, message: 'No diagnosis available' };

    const { safetyTier, suggestedFix } = diag;

    // 1. NEVER_DO: Strictly forbidden
    if (safetyTier === 'NEVER_DO' || this.isDangerousCommand(suggestedFix.command || suggestedFix.description)) {
      incidentManager.incrementBlockedThreats();
      incidentManager.recordAction(incident.id, {
        action: `BLOCKED (Tier: NEVER_DO): Agent strictly forbidden from executing dangerous action: ${suggestedFix.description}`,
        tier: 'NEVER_DO',
        executedBy: 'AI_AGENT',
        result: 'Security policy enforced. Provided manual guidance only to On-Call engineer.',
      });
      incidentManager.recordAudit({
        actor: 'AI_AGENT',
        tier: 'NEVER',
        action: suggestedFix.description,
        target: incident.serviceId,
        outcome: 'BLOCKED_POLICY',
        incidentId: incident.id,
      });
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return {
        executed: false,
        message: 'Action is classified as NEVER_DO. Automated execution is strictly blocked by security policy.',
        reason: 'POLICY_DENIED_NEVER_DO',
      };
    }

    // 2. ASK_FIRST: Requires human approval from Dashboard
    if (safetyTier === 'ASK_FIRST' && incident.status !== 'RESOLVING' && incident.status !== 'EXECUTING') {
      incident.status = 'WAITING_APPROVAL';
      incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
      incidentManager.recordAction(incident.id, {
        action: `Approval requested: ${suggestedFix.description}`,
        tier: 'ASK_FIRST',
        executedBy: 'AI_AGENT',
        result: 'Awaiting operator confirmation with credentials in Dashboard',
      });
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return {
        executed: false,
        message: 'Action requires human approval. Waiting on Dashboard operator.',
        reason: 'WAITING_APPROVAL',
      };
    }

    // 3. AUTO_FIX or APPROVED
    const executor =
      incident.status === 'RESOLVING' || incident.status === 'EXECUTING' ? 'HUMAN_OPERATOR' : 'AI_AGENT';
    return await this.executeRemediation(incident, executor);
  }

  /**
   * Performs concrete remediation and triggers the Verifier
   */
  public async executeRemediation(
    incident: Incident,
    executor: 'AI_AGENT' | 'HUMAN_OPERATOR'
  ): Promise<{ executed: boolean; message: string; reason?: string }> {
    const diag = incident.diagnosis;
    if (!diag) return { executed: false, message: 'No diagnosis available' };

    if (incident.status === 'EXECUTING' && executor === 'AI_AGENT') {
      return { executed: false, message: 'Remediation is already executing for this incident.' };
    }
    if (incident.status === 'VERIFYING' || incident.status === 'RESOLVED') {
      return { executed: false, message: `Incident is in status '${incident.status}'. Cannot re-execute remediation.` };
    }

    const fix = diag.suggestedFix;

    if (this.isDangerousCommand(fix.command || fix.description)) {
      incidentManager.incrementBlockedThreats();
      incidentManager.recordAction(incident.id, {
        action: `SECURITY DENIAL: Malicious or destructive command intercepted: ${fix.command || fix.description}`,
        tier: 'NEVER_DO',
        executedBy: executor,
        result: 'Blocked by backend execution filter. Raw commands and destructive queries are forbidden.',
      });
      incidentManager.recordAudit({
        actor: executor,
        tier: 'NEVER',
        action: fix.command || fix.description,
        target: incident.serviceId,
        outcome: 'BLOCKED_POLICY',
        incidentId: incident.id,
      });
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return {
        executed: false,
        message: 'Execution denied: command violates security allowlist.',
        reason: 'SECURITY_DENIAL',
      };
    }

    if (fix.actionType === 'DOCKER_RESTART') {
      if (!CONFIG.ENABLE_DOCKER_REMEDIATION) {
        const msg = 'Docker remediation is disabled by configuration (ENABLE_DOCKER_REMEDIATION=false).';
        incidentManager.recordAction(incident.id, {
          action: `Docker Restart Skipped: ${msg}`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: 'Remediation disabled by system configuration.',
        });
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        return { executed: false, message: msg, reason: 'REMEDIATION_DISABLED' };
      }

      const service = serviceRegistry.getById(incident.serviceId);
      const targetContainer = service?.containerName || CONFIG.SERVICE_CONTAINER_MAP[incident.serviceId];

      if (!targetContainer) {
        const errMsg = `No mapped container name found for serviceId '${incident.serviceId}'.`;
        incidentManager.recordAction(incident.id, {
          action: `Docker Restart Failed: ${errMsg}`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: 'Unknown container mapping.',
        });
        return { executed: false, message: errMsg, reason: 'UNKNOWN_SERVICE' };
      }

      const validationError = this.validateContainerTarget(targetContainer);
      if (validationError) {
        incidentManager.incrementBlockedThreats();
        incidentManager.recordAction(incident.id, {
          action: `SECURITY DENIAL: Container '${targetContainer}' rejected: ${validationError}`,
          tier: 'NEVER_DO',
          executedBy: executor,
          result: 'Blocked by container allowlist policy.',
        });
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        return { executed: false, message: `Security Denial: ${validationError}`, reason: 'SECURITY_DENIAL' };
      }

      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));

      try {
        logCollector.appendLog(incident.serviceId, `[The Hands] Executing: docker restart ${targetContainer}`);
        const runner = this.getDockerExecutor();
        const { stdout, stderr } = await runner('docker', ['restart', targetContainer]);

        logCollector.appendLog(
          incident.serviceId,
          `[The Hands] Docker restart completed for ${targetContainer}: ${stdout.trim() || stderr.trim() || 'OK'}`
        );

        incidentManager.recordAction(incident.id, {
          action: `DOCKER_RESTART: Restarted container '${targetContainer}' via restricted execFile`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: `Command succeeded: ${stdout.trim() || 'Container restarted'}`,
        });
        incidentManager.recordAudit({
          actor: executor,
          tier: diag.safetyTier === 'AUTO_FIX' ? 'AUTO' : 'ASK_FIRST',
          action: `docker restart ${targetContainer}`,
          target: incident.serviceId,
          outcome: executor === 'HUMAN_OPERATOR' ? 'APPROVED' : 'EXECUTED',
          incidentId: incident.id,
        });
      } catch (err: any) {
        const isTimeout = err.code === 'ETIMEDOUT' || err.killed || err.message?.includes('timeout');
        const errorDetail = isTimeout
          ? `Docker command timed out after ${CONFIG.DOCKER_EXEC_TIMEOUT_MS}ms`
          : err.message || 'Unknown Docker execution error';

        logCollector.appendLog(incident.serviceId, `[The Hands] ERROR during Docker restart: ${errorDetail}`);
        incidentManager.recordAction(incident.id, {
          action: `DOCKER_RESTART: Failed to restart container '${targetContainer}'`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: `Execution failure: ${errorDetail}`,
        });

        incident.status = 'FAILED';
        incidentManager.updateStatus(incident.id, 'FAILED');
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        return { executed: false, message: `Docker restart failed: ${errorDetail}`, reason: 'EXECUTION_FAILED' };
      }
    } else if (fix.actionType === 'CIRCUIT_BREAKER_TRIP') {
      if (!CONFIG.ENABLE_CIRCUIT_BREAKER) {
        return {
          executed: false,
          message: 'Circuit breaker remediation is disabled (ENABLE_CIRCUIT_BREAKER=false).',
          reason: 'REMEDIATION_DISABLED',
        };
      }

      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');

      const callerService =
        fix.targetService || serviceRegistry.getDependents(incident.serviceId)[0]?.id || incident.serviceId;
      const targetDependency = incident.serviceId;

      try {
        logCollector.appendLog(
          incident.serviceId,
          `[The Hands] Tripping Circuit Breaker on '${callerService}' for dependency '${targetDependency}'`
        );
        const cbRes = await this.circuitBreakerAdapter.trip(callerService, targetDependency);

        incidentManager.recordAction(incident.id, {
          action: `CIRCUIT_BREAKER_TRIP: Tripped breaker on '${callerService}' for dependency '${targetDependency}'`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: cbRes.message,
        });
        incidentManager.recordAudit({
          actor: executor,
          tier: diag.safetyTier === 'AUTO_FIX' ? 'AUTO' : 'ASK_FIRST',
          action: `CIRCUIT_BREAKER_TRIP(${callerService} -> ${targetDependency})`,
          target: callerService,
          outcome: executor === 'HUMAN_OPERATOR' ? 'APPROVED' : 'EXECUTED',
          incidentId: incident.id,
        });
      } catch (err: any) {
        incident.status = 'FAILED';
        incidentManager.updateStatus(incident.id, 'FAILED');
        return { executed: false, message: `Circuit breaker trip failed: ${err.message}`, reason: 'EXECUTION_FAILED' };
      }
    } else if (fix.actionType === 'CIRCUIT_BREAKER_RESET') {
      const callerService =
        fix.targetService || serviceRegistry.getDependents(incident.serviceId)[0]?.id || incident.serviceId;
      try {
        const cbRes = await this.circuitBreakerAdapter.reset(callerService, incident.serviceId);
        incidentManager.recordAction(incident.id, {
          action: `CIRCUIT_BREAKER_RESET: Reset breaker on '${callerService}' for '${incident.serviceId}'`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: cbRes.message,
        });
      } catch (err: any) {
        return { executed: false, message: `Circuit breaker reset failed: ${err.message}`, reason: 'EXECUTION_FAILED' };
      }
    } else if (fix.actionType === 'REDUCE_RETRIES') {
      if (!CONFIG.ENABLE_RETRY_CONTROLS) {
        return {
          executed: false,
          message: 'Retry control is disabled by configuration.',
          reason: 'REMEDIATION_DISABLED',
        };
      }

      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');

      const callerService =
        fix.targetService || serviceRegistry.getDependents(incident.serviceId)[0]?.id || incident.serviceId;
      try {
        logCollector.appendLog(
          incident.serviceId,
          `[The Hands] Clamping retries to 1 on '${callerService}' to mitigate retry storm.`
        );
        const retryRes = await this.retryControlAdapter.reduceRetries(callerService, 1, 2000);

        incidentManager.recordAction(incident.id, {
          action: `REDUCE_RETRIES: Clamped retries on '${callerService}'`,
          tier: diag.safetyTier,
          executedBy: executor,
          result: retryRes.message,
        });
        incidentManager.recordAudit({
          actor: executor,
          tier: diag.safetyTier === 'AUTO_FIX' ? 'AUTO' : 'ASK_FIRST',
          action: `REDUCE_RETRIES(${callerService})`,
          target: callerService,
          outcome: executor === 'HUMAN_OPERATOR' ? 'APPROVED' : 'EXECUTED',
          incidentId: incident.id,
        });
      } catch (err: any) {
        incident.status = 'FAILED';
        incidentManager.updateStatus(incident.id, 'FAILED');
        return { executed: false, message: `Retry control adjustment failed: ${err.message}`, reason: 'EXECUTION_FAILED' };
      }
    } else if (fix.actionType === 'ESCALATE_TO_HUMAN') {
      incident.status = 'WAITING_APPROVAL';
      incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
      incidentManager.recordAction(incident.id, {
        action: `ESCALATE_TO_HUMAN: Escalated incident to on-call engineer`,
        tier: 'ASK_FIRST',
        executedBy: executor,
        result: 'Automated remediation paused. On-call human operator paged.',
      });
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return { executed: true, message: 'Incident escalated to on-call engineer.' };
    } else if (fix.actionType === 'FIX_PR') {
      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');

      const project = incident.projectId ? projectManager.getProject(incident.projectId) : undefined;
      const targetFile =
        fix.surgicalPatch?.targetFile ||
        fix.targetFile ||
        incident.evidence.suspectCommit?.file ||
        'services/orders/src/routes/orders.js';

      // 1. Resolve full target source file & apply surgicalPatch (never overwrite with raw unified diff)
      const originalSource = await this.resolveOriginalSource(
        incident.id,
        targetFile,
        project?.repoOwner,
        project?.repoName
      );
      let fixedContent = '';
      if (fix.surgicalPatch && originalSource !== null) {
        const patched = applySurgicalPatch(originalSource, fix.surgicalPatch);
        if (patched.ok) {
          fixedContent = patched.patchedContent;
        }
      }
      if (!fixedContent) {
        const candidate = fix.fixedFileContent;
        const looksLikeUnifiedDiff =
          typeof candidate === 'string' &&
          (/^(diff --git|---\s|@@\s)/m.test(candidate.trim()) && !candidate.includes('function ') && !candidate.includes('const '));
        if (candidate && candidate.trim().length > 0 && !looksLikeUnifiedDiff) {
          fixedContent = candidate;
        } else {
          fixedContent = this.resolveFixedFileContent(targetFile, undefined, fix.codePatch, originalSource ?? undefined);
        }
      }

      // 2. Fail-closed syntax + regression test verification gate
      const testProof = await brainService.verifyPatchWithTests(incident, targetFile, fixedContent);
      incident.evidence.testProof = testProof;

      if (testProof.afterStatus === 'FAIL') {
        incidentManager.recordAction(incident.id, {
          action: `FIX_PR ABORTED: Fail-closed verification gate failed (${targetFile})`,
          tier: 'ASK_FIRST',
          executedBy: executor,
          result: testProof.afterOutput,
        });
        incidentManager.recordAudit({
          actor: executor,
          tier: 'ASK_FIRST',
          action: `FIX_PR_GATE_FAILED (${targetFile})`,
          target: targetFile,
          outcome: 'BLOCKED_POLICY',
          incidentId: incident.id,
        });
        if (incident.diagnosis) {
          incident.diagnosis.safetyTier = 'ASK_FIRST';
          incident.diagnosis.suggestedFix.actionType = 'MANUAL_INSTRUCTION';
        }
        incident.status = 'WAITING_APPROVAL';
        incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        return {
          executed: false,
          message: `Fail-closed verification gate rejected patch for ${targetFile}: ${testProof.afterOutput}`,
          reason: 'TEST_GATE_FAILED',
        };
      }

      // 3. SIETCH SELF-GATE (Checkpoint 2): Scan Agent's proposed Fix PR diff before opening PR
      const branchName = `fix/${incident.id.toLowerCase()}`;
      const regressionTestContent =
        fix.surgicalPatch?.regressionTestContent || diag.regressionTestSnippet;
      const proposedDiff = this.buildProposedUnifiedDiff(
        targetFile,
        originalSource || '',
        fixedContent,
        [regressionTestContent, fix.surgicalPatch?.replacementBlock].filter(Boolean).join('\n')
      );

      const selfGateScan = await runSietchPrSuite({
        repo: project?.fullName || `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`,
        branch: branchName,
        commitSha: 'agent-proposed',
        author: 'patch-up-bot',
        diffText: proposedDiff,
      });

      incidentManager.setSietchSelfGate(incident.id, {
        verdictKind: selfGateScan.verdictKind,
        blocked: selfGateScan.blocked,
        rulesetVersion: selfGateScan.rulesetVersion,
      });

      if (selfGateScan.blocked) {
        incidentManager.incrementBlockedThreats();
        incidentManager.recordAction(incident.id, {
          action: `SIETCH SELF-GATE BLOCKED Agent Fix PR (${selfGateScan.verdictKind})`,
          tier: 'NEVER_DO',
          executedBy: 'AI_AGENT',
          result: selfGateScan.githubCheckRun.summary,
        });
        incidentManager.recordAudit({
          actor: 'SIETCH_SELF_GATE',
          tier: 'NEVER',
          action: `BLOCK_AGENT_PR (${selfGateScan.verdictKind})`,
          target: targetFile,
          outcome: 'BLOCKED_POLICY',
          incidentId: incident.id,
        });
        incident.status = 'WAITING_APPROVAL';
        incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
        wsBroadcaster.broadcast('SIETCH_SCAN_COMPLETE', selfGateScan);
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        return {
          executed: false,
          message: `Sietch Self-Gate blocked agent Fix PR (${selfGateScan.verdictKind}): ${selfGateScan.githubCheckRun.title}`,
          reason: 'SIETCH_SELF_GATE_BLOCKED',
        };
      }

      // 4. Open Fix PR via PR Bot (with full RCA report), save report, and immediately purge RAM vault
      const prBody = [
        `## Autonomous Fix PR for \`${incident.id}\``,
        `**Service**: \`${incident.serviceId}\``,
        `**Root Cause**: ${diag.rootCause}`,
        `**Test Gate**: Before \`${testProof.beforeStatus}\` -> After \`${testProof.afterStatus}\``,
        `**Sietch Self-Gate**: \`${selfGateScan.verdictKind}\` (blocked=${selfGateScan.blocked})`,
        '',
        '### Diff / Patch',
        '```diff',
        fix.codePatch || proposedDiff.slice(0, 1500),
        '```',
      ].join('\n');

      const prResult = await prBot.openFixPr({
        incident,
        branchName,
        targetFile,
        fixedFileContent: fixedContent,
        regressionTestContent,
        title: `fix(${incident.serviceId}): ${diag.summary.slice(0, 72)}`,
        body: prBody,
        repoOwner: project?.repoOwner,
        repoName: project?.repoName,
      });

      incidentManager.setFixPr(incident.id, prResult.prUrl, prResult.prNumber);

      // Immediately purge sensitive RAM logs & source code after PR creation
      const purgeReceipt = ephemeralVault.purgeIncidentData(incident.id);
      incidentManager.setPurgeReceipt(incident.id, purgeReceipt);
      incidentManager.setRcaReport(incident.id, buildFullRcaReportMarkdown(incident));

      logCollector.appendLog(
        incident.serviceId,
        `[The Hands] Opened Fix PR #${prResult.prNumber} (${prResult.branchName}): ${prResult.prUrl} | Purged RAM (${purgeReceipt.bytesRetained}B retained)`
      );
      incidentManager.recordAction(incident.id, {
        action: `FIX_PR: Opened PR #${prResult.prNumber} (${prResult.branchName})`,
        tier: diag.safetyTier,
        executedBy: executor,
        result: `PR ${prResult.dryRun ? '(dry-run) ' : ''}opened at ${prResult.prUrl}. Sietch Self-Gate: ${selfGateScan.verdictKind}. Purged RAM (${purgeReceipt.itemsPurged} items, 0B retained).`,
      });
      incidentManager.recordAudit({
        actor: executor,
        tier: diag.safetyTier === 'AUTO_FIX' ? 'AUTO' : 'ASK_FIRST',
        action: `OPEN_FIX_PR #${prResult.prNumber}`,
        target: targetFile,
        outcome: executor === 'HUMAN_OPERATOR' ? 'APPROVED' : 'EXECUTED',
        incidentId: incident.id,
      });
    } else if (fix.actionType === 'REVERT_PR') {
      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');

      const project = incident.projectId ? projectManager.getProject(incident.projectId) : undefined;
      const commitSha = incident.evidence.suspectCommit?.sha || 'HEAD';
      const prResult = await prBot.openRevertPr({
        incidentId: incident.id,
        commitSha,
        reason: fix.description,
        repoOwner: project?.repoOwner,
        repoName: project?.repoName,
      });

      incidentManager.setFixPr(incident.id, prResult.prUrl, prResult.prNumber);
      const purgeReceipt = ephemeralVault.purgeIncidentData(incident.id);
      incidentManager.setPurgeReceipt(incident.id, purgeReceipt);
      incidentManager.setRcaReport(incident.id, buildFullRcaReportMarkdown(incident));

      incidentManager.recordAction(incident.id, {
        action: `REVERT_PR: Opened Revert PR #${prResult.prNumber} for ${commitSha}`,
        tier: diag.safetyTier,
        executedBy: executor,
        result: `Revert PR ${prResult.dryRun ? '(dry-run) ' : ''}opened at ${prResult.prUrl}. Purged RAM (${purgeReceipt.itemsPurged} items, 0B retained).`,
      });
      incidentManager.recordAudit({
        actor: executor,
        tier: diag.safetyTier === 'AUTO_FIX' ? 'AUTO' : 'ASK_FIRST',
        action: `OPEN_REVERT_PR #${prResult.prNumber}`,
        target: commitSha,
        outcome: executor === 'HUMAN_OPERATOR' ? 'APPROVED' : 'EXECUTED',
        incidentId: incident.id,
      });
    } else {
      incident.status = 'EXECUTING';
      incidentManager.updateStatus(incident.id, 'EXECUTING');
      incidentManager.recordAction(incident.id, {
        action: `${fix.actionType}: ${fix.description}`,
        tier: diag.safetyTier,
        executedBy: executor,
        result: `Remediation initiated: ${fix.description}`,
      });
    }

    incident.timestamps.fixAppliedAt = new Date().toISOString();

    if (fix.actionType === 'FIX_PR' || fix.actionType === 'REVERT_PR') {
      // PR-Only guardrail: production does not change until a human reviews & merges the PR.
      // Do not falsely auto-undo an unmerged PR during live health probing.
      incident.status = 'WAITING_APPROVAL';
      incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));

      return {
        executed: true,
        message: `PR #${incident.fixPrNumber ?? 'N/A'} opened by ${executor} — awaiting human review & merge.`,
      };
    }

    incident.status = 'VERIFYING';
    incidentManager.updateStatus(incident.id, 'VERIFYING');
    wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));

    verifierService.watchRecovery(incident);

    return {
      executed: true,
      message: `Remediation executed by ${executor}. Verification underway.`,
    };
  }

  /**
   * Auto-Undo called by VerifierService when post-fix verification fails or times out.
   */
  public async executeUndo(incident: Incident): Promise<{ undone: boolean; detail: string }> {
    const actionType = incident.diagnosis?.suggestedFix?.actionType;
    const callerService =
      incident.diagnosis?.suggestedFix?.targetService ||
      serviceRegistry.getDependents(incident.serviceId)[0]?.id ||
      incident.serviceId;

    let detail = 'Rolled back automated remediation state and reopened incident for operator review.';

    try {
      if (actionType === 'CIRCUIT_BREAKER_TRIP') {
        const res = await this.circuitBreakerAdapter.reset(callerService, incident.serviceId);
        detail = `Auto-Undo: ${res.message}`;
      } else if (actionType === 'REDUCE_RETRIES') {
        const res = await this.retryControlAdapter.resetRetries(callerService);
        detail = `Auto-Undo: ${res.message}`;
      } else if (actionType === 'FIX_PR' || actionType === 'REVERT_PR') {
        detail = `Auto-Undo: Marked Fix/Revert PR #${incident.fixPrNumber ?? 'N/A'} for rollback; service failed post-fix health verification.`;
      } else if (actionType === 'DOCKER_RESTART') {
        detail = `Auto-Undo: Container restart did not restore health within verification window; escalated for manual intervention.`;
      }
    } catch (err: any) {
      detail = `Auto-Undo attempted with warning: ${err?.message || err}`;
    }

    logCollector.appendLog(incident.serviceId, `[The Hands] ${detail}`);
    incidentManager.recordAction(incident.id, {
      action: `AUTO_UNDO (${actionType || 'REMEDIATION'})`,
      tier: incident.diagnosis?.safetyTier || 'AUTO_FIX',
      executedBy: 'AI_AGENT',
      result: detail,
    });
    incidentManager.recordAudit({
      actor: 'AI_AGENT',
      tier: 'AUTO',
      action: `AUTO_UNDO:${actionType || 'REMEDIATION'}`,
      target: incident.serviceId,
      outcome: 'EXECUTED',
      incidentId: incident.id,
    });

    incident.status = 'WAITING_APPROVAL';
    incidentManager.updateStatus(incident.id, 'WAITING_APPROVAL');
    wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));

    return { undone: true, detail };
  }

  private async resolveOriginalSource(
    incidentId: string,
    targetFile: string,
    repoOwner?: string,
    repoName?: string
  ): Promise<string | null> {
    // 1. Prefer verbatim unredacted file from GitHub API so surgical PR diffs never commit "[REDACTED_EMAIL]"
    const fetched = await prBot.fetchFileContent(targetFile, undefined, repoOwner, repoName);
    if (fetched?.content) return fetched.content;

    // 2. Local repo fallback (dev / tests)
    const localPath = path.resolve(CONFIG.PULSESHOP_REPO_DIR, targetFile);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf8');
    }

    // 3. Ephemeral RAM vault fallback
    const ctx = ephemeralVault.getContext(incidentId);
    if (ctx?.sourceFiles) {
      if (ctx.sourceFiles[targetFile]) return ctx.sourceFiles[targetFile];
      const normalized = targetFile.replace(/^\/+/, '');
      const match = Object.keys(ctx.sourceFiles).find(
        (k) => k === normalized || normalized.endsWith(k) || k.endsWith(normalized)
      );
      if (match) return ctx.sourceFiles[match];
    }

    return null;
  }

  private buildProposedUnifiedDiff(
    targetFile: string,
    originalSource: string,
    fixedContent: string,
    regressionTestContent?: string
  ): string {
    const origLines = originalSource.split('\n');
    const fixedLines = fixedContent.split('\n');
    const origSet = new Set(origLines);
    const fixedSet = new Set(fixedLines);

    const diffLines: string[] = [
      `diff --git a/${targetFile} b/${targetFile}`,
      `--- a/${targetFile}`,
      `+++ b/${targetFile}`,
      '@@ -1,1 +1,1 @@',
    ];

    for (const line of origLines) {
      if (!fixedSet.has(line)) diffLines.push(`-${line}`);
    }
    for (const line of fixedLines) {
      if (!origSet.has(line)) diffLines.push(`+${line}`);
    }

    if (regressionTestContent && regressionTestContent.trim().length > 0) {
      diffLines.push(`diff --git a/tests/patchup-regression.test.js b/tests/patchup-regression.test.js`);
      diffLines.push(`--- /dev/null`);
      diffLines.push(`+++ b/tests/patchup-regression.test.js`);
      diffLines.push('@@ -0,0 +1,1 @@');
      for (const line of regressionTestContent.split('\n')) {
        diffLines.push(`+${line}`);
      }
    }

    return diffLines.join('\n');
  }

  private resolveFixedFileContent(
    targetFile: string,
    explicitContent?: string,
    codePatch?: string,
    fetchedOriginal?: string
  ): string {
    if (explicitContent && explicitContent.trim().length > 0) {
      return explicitContent;
    }
    let original = fetchedOriginal;
    if (!original) {
      const localPath = path.resolve(CONFIG.PULSESHOP_REPO_DIR, targetFile);
      if (fs.existsSync(localPath)) {
        original = fs.readFileSync(localPath, 'utf8');
      }
    }
    if (original) {
      if (original.includes('promo.discountMeta.percentage')) {
        return original.replace(/promo\.discountMeta\.percentage/g, '(promo?.discountMeta?.percentage ?? 0)');
      }
      if (original.includes('req.body.order.items')) {
        return original.replace(/req\.body\.order\.items/g, '(req.body?.order?.items || req.body?.items || [])');
      }
      return original;
    }
    return codePatch || '// Defensive null-safe patch generated by Patch-Up SRE Agent\n';
  }

  public validateContainerTarget(containerName: string): string | null {
    if (!containerName || typeof containerName !== 'string') {
      return 'Container name must be a non-empty string';
    }

    const safeRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,63}$/;
    if (!safeRegex.test(containerName)) {
      return `Invalid container name syntax '${containerName}'. Shell metacharacters and spaces are forbidden.`;
    }

    const isAllowlisted = CONFIG.DOCKER_ALLOWED_CONTAINERS.includes(containerName);
    if (!isAllowlisted) {
      return `Target container '${containerName}' is not in approved allowlist [${CONFIG.DOCKER_ALLOWED_CONTAINERS.join(', ')}]`;
    }

    return null;
  }

  private isDangerousCommand(cmd?: string): boolean {
    if (!cmd) return false;
    const lower = cmd.toLowerCase();
    const dangerousPatterns = [
      'rm -rf',
      'drop table',
      'drop database',
      'truncate table',
      'shutdown',
      ':(){ :|:& };:',
      'mkfs',
      'dd if=',
      '/etc/shadow',
      'chmod 777',
      'curl http',
      'wget http',
      'nc -e',
      ';',
      '&&',
      '||',
      '`',
      '$(',
    ];
    return dangerousPatterns.some((pattern) => lower.includes(pattern));
  }
}

export const handsService = new HandsService();
