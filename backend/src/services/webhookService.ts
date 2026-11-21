import crypto from 'node:crypto';
import axios from 'axios';
import { CONFIG } from '../config/index.js';
import { incidentManager } from './incidentManager.js';
import { serviceRegistry } from './serviceRegistry.js';
import { logCollector } from './logCollector.js';
import { culpritFinder } from './culpritFinder.js';
import { brainService } from './brainService.js';
import { handsService } from './handsService.js';
import { projectManager } from './projectManager.js';
import { ephemeralVault, redactSensitiveText } from '../privacy/ephemeralVault.js';
import { githubAppAuth } from '../github-app/auth.js';
import { prBot } from '../pr-bot/index.js';
import { wsBroadcaster } from '../api/websocket.js';
import { createSietchStore } from '../sietch/router.js';
import { runSietchPrSuite } from '../sietch/suite.js';
import type { Incident, IncidentCategory, TopFrame } from '../types/index.js';
import type { SietchPrScanResult } from '../sietch/types.js';

export const sietchStore = createSietchStore();

export class WebhookService {
  /**
   * Validates GitHub X-Hub-Signature-256 header using HMAC-SHA256 against raw request body Buffer/string.
   */
  public verifyGitHubSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    const secret = CONFIG.WEBHOOKS.GITHUB_SECRET;
    if (!secret) {
      return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature =
      'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  /**
   * Processes GitHub Webhook events (push, pull_request, workflow_run) asynchronously,
   * running the real Sietch 3-Layer Preventive Suite on diffs and posting GitHub Check Statuses.
   */
  public async handleGitHubEvent(
    event: string,
    payload: any
  ): Promise<{
    processed: boolean;
    summary: string;
    sietchScan?: SietchPrScanResult;
    revertPrUrl?: string;
  }> {
    const repoName = payload.repository?.full_name || `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`;
    const [repoOwner, repoShortName] = repoName.includes('/')
      ? repoName.split('/')
      : [CONFIG.GITHUB_OWNER, repoName];

    if (payload.installation?.id && Number.isFinite(Number(payload.installation.id))) {
      await githubAppAuth.registerInstallation(Number(payload.installation.id));
    }

    logCollector.appendLog('gateway-service', `[GitHub Webhook] Received '${event}' event from ${repoName}`);

    if (event === 'push') {
      const commits = payload.commits || [];
      const latest = commits[commits.length - 1] || payload.head_commit;
      const serviceId = payload.repository?.name || 'orders-service';
      const ref = String(payload.ref || 'refs/heads/main');
      const branch = ref.replace(/^refs\/heads\//, '');
      const commitSha = latest?.id || payload.after || 'unknown';
      const shortSha = commitSha.slice(0, 7);

      if (latest || payload.after) {
        const marker = incidentManager.recordDeployMarker({
          serviceId,
          commitSha: shortSha,
          commitMessage: latest?.message || 'push commit',
          author: latest?.author?.name || latest?.author?.email || payload.pusher?.name || 'developer',
          branch,
          timestamp: new Date().toISOString(),
          environment: branch === 'main' ? 'production' : 'preview',
          diffSummary: `Modified: ${[...(latest?.added || []), ...(latest?.modified || [])].join(', ') || 'codebase'}`,
        });

        serviceRegistry.updateVersion(serviceId, `${marker.commitSha} (${marker.commitMessage})`);
        wsBroadcaster.broadcast('DEPLOY_MARKER', marker);

        // Fetch diff and run Sietch 3-Layer Preventive Suite
        const diffText =
          (typeof payload.diffText === 'string' && payload.diffText) ||
          (await prBot.fetchCommitDiff(commitSha, repoOwner, repoShortName));

        if (diffText.trim().length > 0) {
          const scan = await runSietchPrSuite({
            repo: repoName,
            branch,
            commitSha,
            author: marker.author,
            diffText,
          });
          sietchStore.addScan(scan);
          wsBroadcaster.broadcast('SIETCH_SCAN_COMPLETE', scan);

          await prBot.postSietchCheckStatus({ commitSha, scan, repoOwner, repoName: repoShortName });

          let revertPrUrl: string | undefined;
          if (branch === 'main' && scan.verdictKind === 'MALICIOUS') {
            incidentManager.incrementBlockedThreats();
            logCollector.appendLog(
              'orders-service',
              `[SIETCH SHIELD] MALICIOUS push ${shortSha} to main detected! Opening Revert PR.`
            );
            const revertPr = await prBot.openRevertPr({
              incidentId: scan.id,
              commitSha,
              reason: `Sietch blocked MALICIOUS commit ${shortSha}: ${scan.githubCheckRun.title}`,
              repoOwner,
              repoName: repoShortName,
            });
            revertPrUrl = revertPr.prUrl;
            incidentManager.recordAudit({
              actor: 'SIETCH_GATE',
              tier: 'AUTO',
              action: `AUTO_REVERT_PR #${revertPr.prNumber}`,
              target: shortSha,
              outcome: 'EXECUTED',
            });
          } else if (scan.blocked) {
            incidentManager.incrementBlockedThreats();
          }

          return {
            processed: true,
            summary: `Push ${shortSha} registered & scanned by Sietch (${scan.verdictKind})`,
            sietchScan: scan,
            revertPrUrl,
          };
        }

        return {
          processed: true,
          summary: `Push registered: ${marker.commitSha} by ${marker.author}`,
        };
      }
    }

    if (event === 'pull_request') {
      const action = payload.action;
      const prNumber = payload.number as number;
      const pr = payload.pull_request || {};
      const branch = pr.head?.ref || `pr-${prNumber}`;
      const commitSha = pr.head?.sha || 'unknown';
      const author = pr.user?.login || 'developer';

      logCollector.appendLog('orders-service', `[GitHub Webhook] PR #${prNumber} ${action} on ${repoName}`);

      if (action === 'opened' || action === 'synchronize' || action === 'reopened') {
        const diffText =
          (typeof payload.diffText === 'string' && payload.diffText) ||
          (await prBot.fetchPullRequestDiff(prNumber, repoOwner, repoShortName));

        if (diffText.trim().length > 0) {
          const scan = await runSietchPrSuite({
            repo: repoName,
            branch,
            prNumber,
            commitSha,
            author,
            diffText,
          });
          sietchStore.addScan(scan);
          if (scan.blocked) {
            incidentManager.incrementBlockedThreats();
          }
          wsBroadcaster.broadcast('SIETCH_SCAN_COMPLETE', scan);

          await prBot.postSietchCheckStatus({ commitSha, scan, repoOwner, repoName: repoShortName });

          return {
            processed: true,
            summary: `PR #${prNumber} ${action} scanned by Sietch: ${scan.verdictKind} (blocked=${scan.blocked})`,
            sietchScan: scan,
          };
        }
      }

      return {
        processed: true,
        summary: `PR #${prNumber} ${action} processed`,
      };
    }

    if (event === 'workflow_run') {
      const status = payload.workflow_run?.status;
      const conclusion = payload.workflow_run?.conclusion;
      logCollector.appendLog(
        'gateway-service',
        `[CI/CD Workflow] '${payload.workflow_run?.name}' ${status} (${conclusion || 'in-progress'})`
      );
      return { processed: true, summary: `Workflow run ${status}` };
    }

    return { processed: true, summary: `Event '${event}' logged` };
  }

  /**
   * Processes Alertmanager Webhook (Prometheus Alertmanager format)
   */
  public async handleAlertmanagerAlert(payload: any): Promise<{ handled: boolean; incidentId?: string }> {
    const alerts = payload.alerts || [];
    if (alerts.length === 0) return { handled: false };

    for (const alert of alerts) {
      if (alert.status !== 'firing') continue;

      const labels = alert.labels || {};
      const annotations = alert.annotations || {};
      const serviceId = labels.service || labels.app || 'orders-service';
      const alertName = labels.alertname || 'HighErrorRate';
      const rule = annotations.summary || annotations.description || `${alertName} fired on ${serviceId}`;

      logCollector.appendLog(serviceId, `[Alertmanager Webhook] FIRING: ${alertName} (${rule})`);

      const { category, evidence } = culpritFinder.findCulprit(serviceId, rule);
      const alreadyActive = incidentManager.hasActiveIncident(serviceId);
      const incident = incidentManager.createIncident(serviceId, rule, category, evidence);

      if (!alreadyActive) {
        wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);

        const diagnosis = await brainService.diagnose(incident);
        incidentManager.setDiagnosis(incident.id, diagnosis);
        wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

        await this.dispatchOutgoingAlert(incident);
        await handsService.handleRemediation(incident);
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      }

      return { handled: true, incidentId: incident.id };
    }

    return { handled: true };
  }

  /**
   * Processes Grafana unified alerting webhook
   */
  public async handleGrafanaAlert(payload: any): Promise<{ handled: boolean; incidentId?: string }> {
    const ruleName = payload.ruleName || payload.title || 'Grafana Metric Threshold Alert';
    const state = payload.state || 'alerting';
    const serviceId = payload.labels?.service || 'orders-service';

    logCollector.appendLog(serviceId, `[Grafana Webhook] State: ${state.toUpperCase()} | Rule: ${ruleName}`);

    if (state === 'alerting') {
      const rule = `Grafana Alert: ${ruleName} (Threshold breached)`;
      const { category, evidence } = culpritFinder.findCulprit(serviceId, rule);

      const alreadyActive = incidentManager.hasActiveIncident(serviceId);
      const incident = incidentManager.createIncident(serviceId, rule, category, evidence);

      if (!alreadyActive) {
        wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);

        const diagnosis = await brainService.diagnose(incident);
        incidentManager.setDiagnosis(incident.id, diagnosis);
        wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

        await this.dispatchOutgoingAlert(incident);
        await handsService.handleRemediation(incident);
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      }

      return { handled: true, incidentId: incident.id };
    }

    return { handled: true };
  }

  /**
   * Dispatches outgoing incident notifications to Slack, Discord, ntfy (loud mobile alert), and PagerDuty.
   */
  public async dispatchOutgoingAlert(incident: Incident): Promise<void> {
    const { SLACK_URL, DISCORD_URL, NTFY_TOPIC_URL, PAGERDUTY_ROUTING_KEY } = CONFIG.WEBHOOKS;
    if (!SLACK_URL && !DISCORD_URL && !NTFY_TOPIC_URL && !PAGERDUTY_ROUTING_KEY) return;

    const diag = incident.diagnosis;
    const summaryText = `🚨 [SRE AGENT ALARM] Incident ${incident.id} on ${incident.serviceId}: ${diag?.rootCause || incident.title}`;

    const tasks: Promise<unknown>[] = [];

    if (SLACK_URL) {
      tasks.push(
        axios.post(
          SLACK_URL,
          {
            text: summaryText,
            attachments: [
              {
                color: incident.severity === 'CRITICAL' ? '#e02424' : '#f59e0b',
                title: incident.title,
                fields: [
                  { title: 'Status', value: incident.status, short: true },
                  { title: 'Safety Tier', value: diag?.safetyTier || 'AUTO_FIX', short: true },
                  { title: 'Diagnosis', value: diag?.rootCause || 'Under investigation', short: false },
                  { title: 'Remediation', value: diag?.suggestedFix.description || 'N/A', short: false },
                ],
                footer: 'Patch-Up + Sietch SRE Agent',
                ts: Math.floor(Date.now() / 1000),
              },
            ],
          },
          { timeout: 2500 }
        )
      );
    }

    if (DISCORD_URL) {
      tasks.push(axios.post(DISCORD_URL, { content: summaryText }, { timeout: 2500 }));
    }

    if (NTFY_TOPIC_URL) {
      tasks.push(
        axios.post(NTFY_TOPIC_URL, summaryText, {
          timeout: 2500,
          headers: {
            Title: `SRE Alarm: ${incident.id} (${incident.serviceId})`,
            Priority: 'urgent',
            Tags: 'rotating_light,warning',
          },
        })
      );
    }

    if (PAGERDUTY_ROUTING_KEY) {
      tasks.push(
        axios.post(
          'https://events.pagerduty.com/v2/enqueue',
          {
            routing_key: PAGERDUTY_ROUTING_KEY,
            event_action: 'trigger',
            dedup_key: incident.id,
            payload: {
              summary: summaryText,
              severity: incident.severity === 'CRITICAL' ? 'critical' : 'warning',
              source: incident.serviceId,
              custom_details: {
                ruleTriggered: incident.ruleTriggered,
                safetyTier: diag?.safetyTier || 'AUTO_FIX',
                rootCause: diag?.rootCause,
              },
            },
          },
          { timeout: 2500 }
        )
      );
    }

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[Webhook Notification] ${failures.length} notification channel(s) failed`);
    } else {
      logCollector.appendLog(incident.serviceId, `[Notification Webhook] Dispatched alert to configured channels.`);
    }
  }

  /**
   * Unified Push-On-Break Ingestion normalizing:
   * 1. PulseShop / App Push Bundle
   * 2. ELK / Logstash HTTP Output
   * 3. Prometheus Alertmanager / Grafana
   * 4. AWS CloudWatch / SNS Alarm JSON
   *
   * Scrubs & stores the 6-hour log/metric bundle in volatile RAM ephemeralVault
   * (zero disk/DB retention of raw logs) and triggers async CulpritFinder -> Brain -> Hands -> Purge.
   */
  public async handleIncidentBundle(rawPayload: any): Promise<{
    accepted: boolean;
    incidentId: string;
    source: 'app' | 'logstash' | 'alertmanager' | 'grafana' | 'cloudwatch';
    redactionsApplied: number;
    storedItems: number;
  }> {
    const payload = rawPayload || {};
    let source: 'app' | 'logstash' | 'alertmanager' | 'grafana' | 'cloudwatch' = 'app';
    let serviceId = String(payload.serviceId || payload.service || 'orders-service');
    let projectId: string | undefined = payload.projectId ? String(payload.projectId) : undefined;
    const repo: string | undefined = payload.repo ? String(payload.repo) : undefined;
    let rule = String(payload.rule || '');
    let severity: Incident['severity'] =
      payload.severity === 'HIGH' || payload.severity === 'MEDIUM' ? payload.severity : 'CRITICAL';
    let categoryOverride: IncidentCategory | undefined;
    let logs: string[] = Array.isArray(payload.logs) ? payload.logs.map((l: any) => String(l)) : [];
    let metrics: Record<string, any> =
      payload.metrics && typeof payload.metrics === 'object' ? { ...payload.metrics } : {};
    let topFrame: TopFrame | undefined = payload.topFrame;
    let stackTrace: string | undefined = payload.stack ? String(payload.stack) : undefined;
    const windowHours = typeof payload.windowHours === 'number' ? payload.windowHours : CONFIG.EPHEMERAL_WINDOW_HOURS;

    // 4. AWS CloudWatch / SNS Alarm JSON
    let cwAlarm = payload;
    if (payload.Type === 'Notification' && typeof payload.Message === 'string') {
      source = 'cloudwatch';
      try {
        cwAlarm = JSON.parse(payload.Message);
      } catch {
        cwAlarm = { AlarmName: payload.Subject || 'CloudWatch Alarm', NewStateValue: 'ALARM', NewStateReason: payload.Message };
      }
    } else if (payload.AlarmName || (payload.Trigger && payload.NewStateValue)) {
      source = 'cloudwatch';
    }

    if (source === 'cloudwatch') {
      const alarmName = String(cwAlarm.AlarmName || 'CloudWatch-Alarm');
      const trigger = cwAlarm.Trigger || {};
      const metricName = String(trigger.MetricName || '');
      const namespace = String(trigger.Namespace || '');
      const reason = String(cwAlarm.NewStateReason || `${metricName || alarmName} entered ALARM state`);
      const dims = Array.isArray(trigger.Dimensions) ? trigger.Dimensions : [];
      const lbOrServiceDim = dims.find((d: any) => d?.name === 'LoadBalancer' || d?.name === 'ServiceName' || d?.name === 'InstanceId');
      if (lbOrServiceDim?.value) {
        serviceId = String(lbOrServiceDim.value);
      }

      if (
        metricName === 'HTTPCode_ELB_5XX_Count' ||
        metricName === 'TargetResponseTime' ||
        metricName === 'StatusCheckFailed' ||
        namespace.includes('ApplicationELB') ||
        namespace.includes('EC2')
      ) {
        categoryOverride = 'RUNTIME_FAULT';
      } else if (metricName === 'MemoryUtilization' && namespace.includes('ECS')) {
        categoryOverride = 'MEMORY_LEAK';
      }

      rule = `CloudWatch Alarm [${alarmName}]: ${metricName || namespace || 'Threshold'} - ${reason}`.slice(0, 200);
      metrics = {
        ...metrics,
        namespace,
        metricName,
        newStateValue: cwAlarm.NewStateValue || 'ALARM',
        threshold: trigger.Threshold,
      };
      logs = [...logs, `[CloudWatch SNS] ${alarmName} (${cwAlarm.NewStateValue || 'ALARM'}): ${reason}`];
    } else if (Array.isArray(payload.alerts) && payload.alerts.length > 0) {
      // 3a. Prometheus Alertmanager
      source = 'alertmanager';
      const first = payload.alerts.find((a: any) => a.status === 'firing') || payload.alerts[0];
      const labels = first.labels || {};
      const annotations = first.annotations || {};
      serviceId = labels.service || labels.app || serviceId;
      rule = annotations.summary || annotations.description || `${labels.alertname || 'Alertmanager'} fired on ${serviceId}`;
      logs = [...logs, `[Alertmanager] ${labels.alertname || 'Alert'}: ${rule}`];
    } else if (payload.ruleName || (payload.state && payload.title)) {
      // 3b. Grafana
      source = 'grafana';
      serviceId = payload.labels?.service || serviceId;
      rule = `Grafana Alert: ${payload.ruleName || payload.title}`;
      logs = [...logs, `[Grafana] ${payload.state || 'alerting'}: ${rule}`];
    } else if (payload['@timestamp'] !== undefined || (payload.message && payload.level && !payload.rule)) {
      // 2. ELK / Logstash HTTP Output
      source = 'logstash';
      serviceId = String(payload.service || payload.host || serviceId);
      const msg = String(payload.message || 'Logstash error event');
      const lvl = String(payload.level || 'ERROR').toUpperCase();
      rule = `Logstash [${lvl}] ${msg.slice(0, 140)}`;
      logs = [`[${payload['@timestamp'] || new Date().toISOString()}] [${lvl}] ${msg}`, ...(stackTrace ? [stackTrace] : []), ...logs];
      if (!topFrame && payload.topFrame) {
        topFrame = payload.topFrame;
      }
    } else {
      // 1. PulseShop / App Push Bundle
      source = 'app';
      if (!rule) {
        rule = payload.error
          ? `App Push Error: ${String(payload.error).slice(0, 120)}`
          : `Push-On-Break bundle received from ${serviceId}`;
      }
    }

    // Mark project push logs active
    if (projectId) {
      projectManager.markPushLogsActive(projectId);
    } else if (repo) {
      projectManager.markPushLogsActive(repo);
      const found = projectManager.getProjectByRepo(repo);
      if (found) projectId = found.id;
    } else {
      projectManager.markPushLogsActive('pulseshop');
      const defaultProj = projectManager.getProject('pulseshop');
      if (defaultProj) projectId = defaultProj.id;
    }

    // Scrub logs before passing to CulpritFinder / IncidentManager
    const scrubbedLogs = logs.map((l) => redactSensitiveText(l).sanitized);
    for (const line of scrubbedLogs.slice(-5)) {
      logCollector.appendLog(serviceId, line);
    }

    const culprit = await culpritFinder.findCulpritAsync(serviceId, rule, sietchStore.scans[0], {
      projectId,
      topFrame,
      logs: scrubbedLogs,
    });

    const finalCategory: IncidentCategory = categoryOverride || culprit.category;
    const evidence = {
      ...culprit.evidence,
      metricSnapshots: { ...culprit.evidence.metricSnapshots, ...metrics },
      recentLogs: scrubbedLogs.slice(-20),
      ...(topFrame ? { topFrame } : {}),
      ...(stackTrace ? { stackTrace: redactSensitiveText(stackTrace).sanitized } : {}),
    };

    const { incident, isNew, requiresReassessment } = incidentManager.checkNewEvidence(
      serviceId,
      rule,
      finalCategory,
      evidence
    );

    if (projectId && !incident.projectId) {
      incident.projectId = projectId;
    }

    // Store raw 6h bundle ONLY in volatile RAM ephemeralVault (never disk/DB)
    const vaultRes = ephemeralVault.ingestBundle(incident.id, {
      logs,
      metrics,
      windowHours,
    });

    if (isNew) {
      wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);
    }

    if (isNew || requiresReassessment) {
      setImmediate(async () => {
        try {
          await culpritFinder.enrichJitSourceForIncident(incident);
          const diagnosis = await brainService.diagnose(incident);
          incidentManager.setDiagnosis(incident.id, diagnosis);
          wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

          await this.dispatchOutgoingAlert(incident);
          await handsService.handleRemediation(incident);
          wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
        } catch (err: any) {
          console.error(`[WebhookService] Async Push-On-Break pipeline error for ${incident.id}:`, err?.message || err);
        }
      });
    }

    return {
      accepted: true,
      incidentId: incident.id,
      source,
      redactionsApplied: vaultRes.redactionsApplied,
      storedItems: vaultRes.storedItems,
    };
  }
}

export const webhookService = new WebhookService();
