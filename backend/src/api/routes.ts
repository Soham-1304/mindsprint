import { Router, type Request, type Response } from 'express';
import { CONFIG } from '../config/index.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { incidentManager } from '../services/incidentManager.js';
import { logCollector } from '../services/logCollector.js';
import { culpritFinder } from '../services/culpritFinder.js';
import { brainService, buildFullRcaReportMarkdown } from '../services/brainService.js';
import { handsService } from '../services/handsService.js';
import { webhookService, sietchStore } from '../services/webhookService.js';
import { syntheticProber } from '../services/syntheticProber.js';
import { projectManager } from '../services/projectManager.js';
import { prBot } from '../pr-bot/index.js';
import { githubAppAuth } from '../github-app/auth.js';
import { sqliteStore } from '../db/sqliteStore.js';
import { ephemeralVault } from '../privacy/ephemeralVault.js';
import { createSietchRouter } from '../sietch/router.js';
import { wsBroadcaster } from './websocket.js';
import type { CanaryGateResult, Incident } from '../types/index.js';

const router = Router();

function extractOperatorToken(req: Request): string | undefined {
  const tokenHeader = req.headers['x-operator-token'] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  return tokenHeader || bearerToken;
}

function validateOperatorToken(req: Request, res: Response): boolean {
  const providedToken = extractOperatorToken(req);
  if (!providedToken || providedToken !== CONFIG.OPERATOR_APPROVAL_TOKEN) {
    res.status(401).json({
      error:
        'Unauthorized: Invalid or missing operator approval token. Provide X-Operator-Token header or Bearer authorization.',
    });
    return false;
  }
  return true;
}

export function buildCanaryGateResult(release: string): CanaryGateResult {
  const services = serviceRegistry.getAll();
  const orders = serviceRegistry.getById('orders-service') || services[0];
  const allIncidents = incidentManager.getAll();
  const activeIncidents = allIncidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'FAILED'
  );

  const matchingScan = sietchStore.scans.find(
    (s) =>
      (s.commitSha && (s.commitSha === release || s.commitSha.startsWith(release))) ||
      s.branch === release
  );
  const sietchBlocked = Boolean(matchingScan?.blocked);

  const errorRate5xx = orders?.currentStats.errorRate5xx ?? null;
  const p95LatencyMs = orders?.currentStats.p95LatencyMs ?? null;
  const ordersRpm = orders?.currentStats.ordersRpm ?? orders?.currentStats.throughputRpm ?? null;

  const reasons: string[] = [];
  let verdict: 'PASS' | 'FAIL' | 'HOLD' = 'PASS';

  if (sietchBlocked) {
    verdict = 'FAIL';
    reasons.push(`Sietch preventive gate blocked release '${release}' (${matchingScan?.verdictKind}).`);
  }
  if (errorRate5xx !== null && errorRate5xx > CONFIG.THRESHOLDS.ERROR_RATE_MAX) {
    verdict = 'FAIL';
    reasons.push(
      `5xx error rate ${(errorRate5xx * 100).toFixed(1)}% exceeds threshold ${(CONFIG.THRESHOLDS.ERROR_RATE_MAX * 100).toFixed(1)}%.`
    );
  }
  if (p95LatencyMs !== null && p95LatencyMs > CONFIG.THRESHOLDS.LATENCY_P95_MAX_MS) {
    verdict = 'FAIL';
    reasons.push(`p95 latency ${p95LatencyMs}ms exceeds threshold ${CONFIG.THRESHOLDS.LATENCY_P95_MAX_MS}ms.`);
  }
  if (activeIncidents.length > 0) {
    const hasVerifyingOrWaiting = activeIncidents.some(
      (i) => i.status === 'WAITING_APPROVAL' || i.status === 'VERIFYING'
    );
    if (verdict !== 'FAIL') {
      verdict = hasVerifyingOrWaiting ? 'HOLD' : 'FAIL';
    }
    reasons.push(`${activeIncidents.length} active incident(s) in progress.`);
  }

  if (reasons.length === 0) {
    reasons.push('All PulseShop telemetry and Sietch security gates passed.');
  }

  return {
    release,
    verdict,
    checkedAt: new Date().toISOString(),
    metricsComparison: {
      errorRate5xx,
      p95LatencyMs,
      ordersRpm,
      activeIncidents: activeIncidents.length,
      sietchBlocked,
    },
    reasons,
  };
}

function mapIncidentForDashboard(inc: Incident) {
  const shortService = inc.serviceId.replace('-service', '') as 'gateway' | 'orders' | 'payments';
  const mappedService: 'gateway' | 'orders' | 'payments' =
    shortService === 'gateway' || shortService === 'orders' || shortService === 'payments'
      ? shortService
      : 'orders';

  const ruleId =
    inc.ruleTriggered.toLowerCase().includes('latency') || inc.ruleTriggered.toLowerCase().includes('slow')
      ? 'LATENCY_P95_DOUBLE'
      : inc.ruleTriggered.toLowerCase().includes('silent') || inc.ruleTriggered.toLowerCase().includes('order')
        ? 'BIZ_ORDERS_DROP'
        : inc.ruleTriggered.toLowerCase().includes('down') || inc.category === 'RUNTIME_FAULT'
          ? 'SERVICE_DOWN'
          : 'ERR_5XX_SPIKE';

  const status: 'RESOLVED' | 'MITIGATING' | 'OPEN' =
    inc.status === 'RESOLVED'
      ? 'RESOLVED'
      : inc.status === 'EXECUTING' || inc.status === 'RESOLVING' || inc.status === 'VERIFYING'
        ? 'MITIGATING'
        : 'OPEN';

  const faultCategory =
    inc.category === 'CODE_BUG'
      ? 'CODE_BUG'
      : inc.category === 'RUNTIME_FAULT' || inc.category === 'MEMORY_LEAK'
        ? 'RUNTIME_INSTANCE'
        : 'DEPENDENCY_FAULT';

  const safetyTier =
    inc.diagnosis?.safetyTier === 'AUTO_FIX'
      ? 'AUTO'
      : inc.diagnosis?.safetyTier === 'NEVER_DO'
        ? 'NEVER'
        : 'ASK_FIRST';

  const diagMs = (inc.timestamps.timeToDiagnosisSeconds ?? 12) * 1000;

  return {
    id: inc.id,
    title: inc.title,
    ruleId,
    severity: inc.severity === 'CRITICAL' ? 'Critical' : 'High',
    status,
    backendStatus: inc.status,
    service: mappedService,
    faultCategory,
    faultStartAt: inc.timestamps.faultStartedAt,
    alarmRaisedAt: inc.timestamps.alarmRaisedAt,
    causeNamedAt: inc.timestamps.causeNamedAt || inc.timestamps.alarmRaisedAt,
    resolvedAt: inc.timestamps.resolvedAt || null,
    timeToDiagnosisMs: diagMs,
    culpritCommitSha: inc.evidence.suspectCommit?.sha || null,
    culpritAuthor: inc.evidence.suspectCommit?.author || null,
    culpritFile: inc.evidence.suspectCommit?.file || null,
    culpritLine: inc.evidence.suspectCommit?.line || null,
    topFrame: inc.evidence.topFrame,
    gitBlameDiff: inc.evidence.suspectCommit?.diff,
    containerState: inc.evidence.containerState
      ? {
          container: inc.evidence.containerState.container || inc.serviceId,
          status: inc.evidence.containerState.status,
          exitCode: inc.evidence.containerState.exitCode ?? 0,
          oomKilled: Boolean(inc.evidence.containerState.oomKilled),
          restartCount: inc.evidence.containerState.restarts,
        }
      : undefined,
    diagnosisSummary: inc.diagnosis?.rootCause || inc.diagnosis?.summary || inc.ruleTriggered,
    diagnosisSource: inc.diagnosis?.diagnosisSource,
    modelUsed: inc.diagnosis?.modelUsed,
    counterfactualEvaluations: inc.diagnosis?.counterfactualEvaluations,
    recommendedStrategyIndex: inc.diagnosis?.recommendedStrategyIndex,
    selectedStrategyRationale: inc.diagnosis?.selectedStrategyRationale,
    isCascadingFailure: inc.diagnosis?.isCascadingFailure,
    confidence: inc.diagnosis?.confidence ?? 0.92,
    safetyTier,
    testProof: inc.evidence.testProof
      ? {
          beforeStatus: inc.evidence.testProof.beforeStatus,
          beforeOutput: inc.evidence.testProof.beforeOutput,
          afterStatus: inc.evidence.testProof.afterStatus,
          afterOutput: inc.evidence.testProof.afterOutput,
        }
      : undefined,
    fixPrUrl: inc.fixPrUrl ?? null,
    fixPrNumber: inc.fixPrNumber ?? null,
    sietchSelfGate: inc.sietchSelfGate,
    purgeReceipt: inc.purgeReceipt,
    rcaReportMarkdown: inc.rcaReportMarkdown,
    projectId: inc.projectId,
    metricSeries: [
      { label: '-2m', value: 0.2, baseline: 0.5 },
      { label: '-1m', value: 1.1, baseline: 0.5 },
      {
        label: 'Now',
        value:
          typeof inc.evidence.metricSnapshots?.errorRate5xx === 'number'
            ? Number((inc.evidence.metricSnapshots.errorRate5xx * 100).toFixed(1))
            : 12.0,
        baseline: 0.5,
      },
    ],
    metricUnit: '%',
    timeline: inc.actionsTaken.map((a, idx) => ({
      id: a.id,
      offsetLabel: `+${idx * 5}s`,
      timestamp: a.timestamp,
      stage: a.action.includes('FIX_PR')
        ? 'PR_BOT'
        : a.action.includes('Verifier')
          ? 'VERIFIER'
          : a.action.includes('SIETCH')
            ? 'SIETCH'
            : 'HANDS',
      title: a.action,
      detail: a.result,
      status: inc.status === 'RESOLVED' ? 'done' : 'active',
    })),
  };
}

// ==========================================
// 0. Healthcheck & Sietch 3-Layer Preventive Suite Router
// ==========================================
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    agent: 'Patch-Up + Sietch SRE Agent Backend (AIA-02)',
    timestamp: new Date().toISOString(),
  });
});

router.use(
  '/sietch',
  createSietchRouter(sietchStore, {
    pulseshopDir: CONFIG.PULSESHOP_REPO_DIR,
    onScanComplete: (scan) => {
      if (scan.blocked) {
        incidentManager.incrementBlockedThreats();
      }
      wsBroadcaster.broadcast('SIETCH_SCAN_COMPLETE', scan);
    },
  })
);

// ==========================================
// 1. Live SSE Stream
// ==========================================
router.get('/events/stream', (req: Request, res: Response) => {
  wsBroadcaster.addSseClient(res);
});

// ==========================================
// 2. Services & Universal App Registry
// ==========================================
router.get('/services', (_req: Request, res: Response) => {
  res.json({ success: true, services: serviceRegistry.getAll() });
});

router.post('/services', (req: Request, res: Response) => {
  const { id, name, repo, metricsUrl, grafanaUrl, healthUrl, containerName } = req.body || {};
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }

  const created = serviceRegistry.register({
    id,
    name,
    repo: repo || `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`,
    metricsUrl: metricsUrl || 'http://localhost:3000/metrics',
    grafanaUrl,
    healthUrl: healthUrl || 'http://localhost:3000/health',
    containerName: containerName || id,
    status: 'HEALTHY',
    currentVersion: 'v1.0.0',
    currentStats: {
      errorRate5xx: 0.001,
      p95LatencyMs: 35,
      throughputRpm: 100,
      memoryUsagePercent: 30,
      cpuPercent: 10,
    },
  });

  wsBroadcaster.broadcast('SERVICE_REGISTERED', created);
  return res.status(201).json({ success: true, service: created });
});

router.get('/applications', (_req: Request, res: Response) => {
  res.json({ success: true, applications: syntheticProber.getAll() });
});

router.post('/applications/connect', async (req: Request, res: Response) => {
  const { name, type = 'backend', deployedUrl, healthEndpoint, metricsEndpoint, repoUrl } = req.body || {};
  if (!name || !deployedUrl) {
    return res.status(400).json({ error: 'name and deployedUrl are required to connect an application' });
  }

  const app = syntheticProber.connect({
    name,
    type,
    deployedUrl,
    healthEndpoint,
    metricsEndpoint,
    repoUrl,
  });

  await syntheticProber.probe(app);

  return res.status(201).json({
    success: true,
    message: `Application '${app.name}' hooked into autonomous maintenance.`,
    application: app,
    setupGuide: {
      dedicatedWebhookUrl: `${app.webhookUrl}`,
      token: app.webhookToken,
    },
  });
});

router.post('/applications/:id/probe', async (req: Request, res: Response) => {
  const appId = String(req.params.id);
  const app = syntheticProber.getById(appId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const result = await syntheticProber.probe(app);
  return res.json({ success: true, application: app, probeResult: result });
});

router.delete('/applications/:id', (req: Request, res: Response) => {
  const appId = String(req.params.id);
  const deleted = syntheticProber.remove(appId);
  if (!deleted) return res.status(404).json({ error: 'Application not found' });
  return res.json({ success: true, message: `Application '${appId}' unhooked.` });
});

router.post('/webhooks/ingest/:appId', async (req: Request, res: Response) => {
  const appId = String(req.params.appId);
  try {
    const result = await syntheticProber.handleIngestedWebhook(appId, req.body, req.headers);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/services/:id/metrics', (req: Request, res: Response) => {
  const service = serviceRegistry.getById(String(req.params.id));
  if (!service) return res.status(404).json({ error: 'Service not found' });
  return res.json({
    success: true,
    serviceId: service.id,
    currentStats: service.currentStats,
    history: service.history,
  });
});

router.get('/services/:id/logs', (req: Request, res: Response) => {
  const service = serviceRegistry.getById(String(req.params.id));
  if (!service) return res.status(404).json({ error: 'Service not found' });
  return res.json({
    success: true,
    serviceId: service.id,
    logs: logCollector.getRecentLogs(service.id),
  });
});

// ==========================================
// 3. Deployments & Canary Gate
// ==========================================
router.post('/deployments', (req: Request, res: Response) => {
  const { sha, branch, service, environment, author, timestamp, commitMessage, diffSummary } = req.body || {};
  if (!sha) {
    return res.status(400).json({ error: 'sha is required' });
  }
  const serviceId = service || 'orders-service';
  const marker = incidentManager.recordDeployMarker({
    serviceId,
    commitSha: String(sha),
    commitMessage: commitMessage || `deploy(${branch || 'main'}): ${String(sha).slice(0, 7)}`,
    author: author || 'github-actions',
    branch: branch || 'main',
    timestamp: timestamp || new Date().toISOString(),
    environment: environment || 'production',
    diffSummary,
  });

  serviceRegistry.updateVersion(serviceId, `${String(sha).slice(0, 7)} (${branch || 'main'})`);
  wsBroadcaster.broadcast('DEPLOY_MARKER', marker);
  return res.status(201).json({ success: true, marker });
});

router.post(['/deploy', '/webhooks/deploy'], (req: Request, res: Response) => {
  const { serviceId, commitSha, commitMessage, author, branch, environment, diffSummary } = req.body || {};
  if (!serviceId || !commitSha) {
    return res.status(400).json({ error: 'serviceId and commitSha are required' });
  }

  const marker = incidentManager.recordDeployMarker({
    serviceId,
    commitSha,
    commitMessage: commitMessage || 'feat: automated deployment',
    author: author || 'deploy-bot@pulseshop.dev',
    branch: branch || 'main',
    timestamp: new Date().toISOString(),
    environment: environment || 'production',
    diffSummary,
  });

  serviceRegistry.updateVersion(serviceId, `${commitSha.slice(0, 7)} (${commitMessage || 'latest'})`);
  wsBroadcaster.broadcast('DEPLOY_MARKER', marker);
  return res.status(201).json({ success: true, marker });
});

router.get('/gate/:release', (req: Request, res: Response) => {
  const release = String(req.params.release);
  const gate = buildCanaryGateResult(release);
  return res.status(gate.verdict === 'FAIL' ? 409 : 200).json(gate);
});

// ==========================================
// 4. Webhooks (GitHub HMAC, Alertmanager, Grafana, Logs)
// ==========================================
router.post('/webhooks/github', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody: Buffer | string = (req as any).rawBody || JSON.stringify(req.body || {});
  const event = (req.headers['x-github-event'] as string) || 'push';

  if (!webhookService.verifyGitHubSignature(rawBody, signature)) {
    console.warn(`[GitHub Webhook] Rejected '${event}' — invalid X-Hub-Signature-256.`);
    return res.status(401).json({ error: 'Invalid GitHub webhook signature' });
  }

  console.log(`[GitHub Webhook] Accepted '${event}' from ${req.body?.repository?.full_name || 'unknown'}`);
  try {
    const result = await webhookService.handleGitHubEvent(event, req.body || {});
    return res.json({ success: true, result });
  } catch (err: any) {
    console.error(`[GitHub Webhook] Handler error for '${event}':`, err?.message || err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks/alertmanager', async (req: Request, res: Response) => {
  try {
    const result = await webhookService.handleAlertmanagerAlert(req.body || {});
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks/grafana', async (req: Request, res: Response) => {
  try {
    const result = await webhookService.handleGrafanaAlert(req.body || {});
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(['/webhooks/incident-bundle', '/webhooks/cloudwatch'], async (req: Request, res: Response) => {
  try {
    const result = await webhookService.handleIncidentBundle(req.body || {});
    return res.status(202).json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4b. GitHub App & Vercel-Style Project Onboarding
// ==========================================
router.get('/github/status', async (_req: Request, res: Response) => {
  let installations = sqliteStore.getInstallations();
  if (installations.length === 0 && githubAppAuth.isConfigured()) {
    installations = await githubAppAuth.syncInstallationsFromGitHub();
  }
  res.json({
    configured: githubAppAuth.isConfigured(),
    installUrl: githubAppAuth.getInstallUrl(),
    installations,
  });
});

router.get('/github/install', (req: Request, res: Response) => {
  const state = req.query.state ? String(req.query.state) : undefined;
  const installUrl = githubAppAuth.getInstallUrl(state);
  if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
    return res.json({ configured: githubAppAuth.isConfigured(), installUrl });
  }
  return res.redirect(installUrl);
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const rawId = req.query.installation_id;
  const installationId = rawId ? Number(rawId) : NaN;
  if (!Number.isFinite(installationId) || installationId <= 0) {
    return res.status(400).json({ error: 'Valid installation_id query parameter is required' });
  }
  try {
    await githubAppAuth.registerInstallation(installationId);
    const redirectUrl = `${CONFIG.DASHBOARD_PUBLIC_URL.replace(/\/+$/, '')}?github_installed=1&installation_id=${installationId}`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/github/repos', async (req: Request, res: Response) => {
  const installationId = req.query.installation_id ? Number(req.query.installation_id) : undefined;
  try {
    const repos = await githubAppAuth.listAccessibleRepos(
      installationId && Number.isFinite(installationId) ? installationId : undefined
    );
    return res.json({ success: true, repos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/projects', (_req: Request, res: Response) => {
  res.json({ success: true, projects: projectManager.listProjects() });
});

router.post('/projects/import', async (req: Request, res: Response) => {
  const {
    repoOwner,
    repoName,
    defaultBranch,
    installationId,
    deployedUrl,
    healthEndpoint,
    metricsEndpoint,
    telemetryEndpoint,
    prometheusUrl,
  } = req.body || {};

  if (!repoOwner || !repoName) {
    return res.status(400).json({ error: 'repoOwner and repoName are required' });
  }

  try {
    const project = await projectManager.importProject({
      repoOwner: String(repoOwner),
      repoName: String(repoName),
      defaultBranch: defaultBranch ? String(defaultBranch) : undefined,
      installationId: installationId != null ? Number(installationId) : undefined,
      deployedUrl: deployedUrl ? String(deployedUrl) : undefined,
      healthEndpoint: healthEndpoint ? String(healthEndpoint) : undefined,
      metricsEndpoint: metricsEndpoint ? String(metricsEndpoint) : undefined,
      telemetryEndpoint: telemetryEndpoint ? String(telemetryEndpoint) : undefined,
      prometheusUrl: prometheusUrl ? String(prometheusUrl) : undefined,
    });
    return res.status(201).json({ success: true, project });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/discover', async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  try {
    const capabilities = await projectManager.discoverCapabilities(projectId);
    const project = projectManager.getProject(projectId);
    return res.json({ success: true, capabilities, project });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

router.delete('/projects/:id', (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const deleted = sqliteStore.deleteProject(projectId);
  if (!deleted) {
    return res.status(404).json({ error: `Project '${projectId}' not found` });
  }
  return res.json({ success: true, deletedId: projectId });
});

// ==========================================
// 4c. Privacy & Zero-Retention Status
// ==========================================
router.get('/privacy/status', (_req: Request, res: Response) => {
  res.json({
    monitoringMode: CONFIG.MONITORING_MODE,
    ephemeralStats: ephemeralVault.getStats(),
    ephemeralWindowHours: CONFIG.EPHEMERAL_WINDOW_HOURS,
    ephemeralTtlMs: CONFIG.EPHEMERAL_TTL_MS,
    retentionPolicy: {
      rawLogsPersisted: false,
      sourceCodePersisted: false,
      piiScrubbingEnabled: true,
      purgeOnPrCreation: true,
    },
  });
});

router.post(['/logs', '/webhooks/logs'], (req: Request, res: Response) => {
  const { serviceId, message, error, stack, level = 'ERROR' } = req.body || {};
  if (!serviceId) {
    return res.status(400).json({ error: 'serviceId is required' });
  }

  const logLine = `[${level}] ${message || error || 'Application Error'}${stack ? '\n' + stack : ''}`;
  logCollector.appendLog(serviceId, logLine);

  if (String(level).toUpperCase() === 'ERROR' || String(level).toUpperCase() === 'FATAL' || stack) {
    const rule = `Application Exception: ${message || error || 'Unhandled Error'}`;
    const { category, evidence } = culpritFinder.findCulprit(serviceId, rule);
    if (stack) evidence.stackTrace = stack;

    const { incident, isNew, requiresReassessment } = incidentManager.checkNewEvidence(
      serviceId,
      rule,
      category,
      evidence
    );

    if (isNew || requiresReassessment) {
      if (isNew) wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);
      setTimeout(async () => {
        const diagnosis = await brainService.diagnose(incident);
        incidentManager.setDiagnosis(incident.id, diagnosis);
        wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));
        await handsService.handleRemediation(incident);
        wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      }, 200);
    }
  }

  return res.status(201).json({ success: true, message: 'Log ingested and processed' });
});

// ==========================================
// 5. Incidents, Approvals, Audit Log & Scorecard
// ==========================================
router.get('/incidents', (_req: Request, res: Response) => {
  res.json({ success: true, incidents: incidentManager.getAll() });
});

router.get('/incidents/:id', (req: Request, res: Response) => {
  const incident = incidentManager.getById(String(req.params.id));
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  return res.json({ success: true, incident });
});

router.get('/incidents/:id/diff', async (req: Request, res: Response) => {
  const incident = incidentManager.getById(String(req.params.id));
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  let diffText = '';
  let source: 'github_pr' | 'blame_fallback' | 'none' = 'none';

  if (incident.fixPrNumber) {
    const project = incident.projectId
      ? projectManager.getProject(incident.projectId)
      : projectManager.listProjects()[0];
    const owner = project?.repoOwner || CONFIG.GITHUB_OWNER;
    const repo = project?.repoName || CONFIG.GITHUB_REPO;
    try {
      const fetched = await prBot.fetchPullRequestDiff(incident.fixPrNumber, owner, repo);
      if (fetched && fetched.trim().length > 0) {
        diffText = fetched;
        source = 'github_pr';
      }
    } catch {
      // Fallback below
    }
  }

  if (!diffText && incident.evidence?.suspectCommit?.diff) {
    diffText = incident.evidence.suspectCommit.diff;
    source = 'blame_fallback';
  }

  return res.json({
    success: true,
    incidentId: incident.id,
    prNumber: incident.fixPrNumber ?? null,
    prUrl: incident.fixPrUrl ?? null,
    source,
    diff: diffText,
  });
});

router.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const {
      deployedUrl,
      defaultBranch,
      healthEndpoint,
      metricsEndpoint,
      telemetryEndpoint,
      prometheusUrl,
    } = req.body || {};
    const project = await projectManager.updateProjectSettings(projectId, {
      ...(deployedUrl !== undefined ? { deployedUrl: String(deployedUrl).trim() } : {}),
      ...(defaultBranch ? { defaultBranch: String(defaultBranch).trim() } : {}),
      ...(healthEndpoint ? { healthEndpoint: String(healthEndpoint).trim() } : {}),
      ...(metricsEndpoint ? { metricsEndpoint: String(metricsEndpoint).trim() } : {}),
      ...(telemetryEndpoint ? { telemetryEndpoint: String(telemetryEndpoint).trim() } : {}),
      ...(prometheusUrl !== undefined ? { prometheusUrl: String(prometheusUrl).trim() } : {}),
    });
    return res.json({ success: true, project });
  } catch (err: any) {
    return res.status(404).json({ error: err?.message || 'Project not found' });
  }
});

router.get('/incidents/:id/report.md', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const incident = incidentManager.getById(id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const markdown = incident.rcaReportMarkdown || buildFullRcaReportMarkdown(incident);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="patch-up-report-${id}.md"`);
  return res.send(markdown);
});

router.post('/incidents/:id/approve', async (req: Request, res: Response) => {
  if (!validateOperatorToken(req, res)) return;

  const incident = incidentManager.getById(String(req.params.id));
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  if (incident.status === 'EXECUTING' || incident.status === 'VERIFYING') {
    return res.status(400).json({ error: `Incident is currently in '${incident.status}' state.` });
  }
  if (incident.status === 'RESOLVED') {
    return res.status(400).json({ error: 'Incident is already RESOLVED.' });
  }
  if (incident.status !== 'WAITING_APPROVAL') {
    return res.status(400).json({ error: `Incident is in status '${incident.status}', not waiting for approval.` });
  }

  incidentManager.updateStatus(incident.id, 'EXECUTING');
  const result = await handsService.executeRemediation(incident, 'HUMAN_OPERATOR');
  wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
  return res.json({ success: true, message: 'Action approved and executed by operator', result });
});

router.post('/incidents/:id/reject', (req: Request, res: Response) => {
  if (!validateOperatorToken(req, res)) return;

  const incident = incidentManager.getById(String(req.params.id));
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const operator = String(req.body?.operator || 'oncall-operator');
  const reason = req.body?.reason ? String(req.body.reason) : undefined;
  const updated = incidentManager.rejectIncident(incident.id, operator, reason);
  wsBroadcaster.broadcast('INCIDENT_UPDATED', updated);
  return res.json({ success: true, message: 'Action rejected by operator', incident: updated });
});

router.post('/approvals/:id/decide', async (req: Request, res: Response) => {
  if (!validateOperatorToken(req, res)) return;

  const rawId = String(req.params.id);
  const incidentId = rawId.startsWith('apr-') ? rawId.slice(4) : rawId;
  const incident = incidentManager.getById(incidentId);
  if (!incident) return res.status(404).json({ error: `Incident/Approval '${rawId}' not found` });

  const decision = String(req.body?.decision || '').toUpperCase();
  const operator = String(req.body?.operator || 'oncall-operator');
  const reason = req.body?.reason ? String(req.body.reason) : undefined;

  if (decision === 'REJECT' || decision === 'REJECTED') {
    const updated = incidentManager.rejectIncident(incident.id, operator, reason);
    wsBroadcaster.broadcast('INCIDENT_UPDATED', updated);
    return res.json({ success: true, decision: 'REJECTED', incident: updated });
  }

  if (decision === 'APPROVE' || decision === 'APPROVED') {
    if (incident.status === 'WAITING_APPROVAL') {
      incidentManager.updateStatus(incident.id, 'EXECUTING');
      const result = await handsService.executeRemediation(incident, 'HUMAN_OPERATOR');
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return res.json({ success: true, decision: 'APPROVED', result, incident: incidentManager.getById(incident.id) });
    }
    return res.status(400).json({ error: `Incident is in status '${incident.status}', not WAITING_APPROVAL.` });
  }

  return res.status(400).json({ error: "decision must be 'APPROVED' or 'REJECTED'" });
});

router.get('/scorecard', (_req: Request, res: Response) => {
  res.json({ success: true, scorecard: incidentManager.getScorecard() });
});

router.get('/audit-log', (_req: Request, res: Response) => {
  res.json({ success: true, auditLog: incidentManager.getAuditLog() });
});

router.get('/postmortems', (_req: Request, res: Response) => {
  const incidents = incidentManager.getAll().filter((i) => !!i.postmortem);
  res.json({
    success: true,
    postmortems: incidents.map((i) => ({
      incidentId: i.id,
      serviceId: i.serviceId,
      resolvedAt: i.timestamps.resolvedAt,
      timeToDiagnosisSeconds: i.timestamps.timeToDiagnosisSeconds,
      timeToRecoverySeconds: i.timestamps.timeToRecoverySeconds,
      fixPrUrl: i.fixPrUrl ?? null,
      content: i.postmortem,
    })),
  });
});

// ==========================================
// 6. Unified Dashboard Overview Endpoint
// ==========================================
router.get('/dashboard/overview', (_req: Request, res: Response) => {
  const services = serviceRegistry.getAll();
  const allIncidents = incidentManager.getAll();
  const sc = incidentManager.getScorecard();

  const mappedServices = services.map((s) => {
    let port = 3000;
    try {
      const u = new URL(s.healthUrl);
      if (u.port) port = parseInt(u.port, 10);
    } catch {
      // default port
    }
    return {
      name: s.id.replace('-service', ''),
      port,
      status: s.status === 'HEALTHY' ? ('healthy' as const) : ('degraded' as const),
    };
  });

  const mappedIncidents = allIncidents.map(mapIncidentForDashboard);

  const approvals = allIncidents
    .filter((i) => i.status === 'WAITING_APPROVAL' || i.actionsTaken.some((a) => a.tier === 'ASK_FIRST'))
    .map((i) => ({
      id: `apr-${i.id}`,
      incidentId: i.id,
      createdAt: i.timestamps.alarmRaisedAt,
      tier: 'ASK_FIRST' as const,
      status:
        i.status === 'WAITING_APPROVAL'
          ? ('PENDING' as const)
          : i.status === 'FAILED'
            ? ('REJECTED' as const)
            : ('APPROVED' as const),
      actionTitle: i.diagnosis?.suggestedFix.description || i.title,
      target: i.serviceId,
      rationale: i.diagnosis?.selectedStrategyRationale || i.diagnosis?.rootCause || i.ruleTriggered,
      evidenceCitations: i.diagnosis?.evidence || [i.ruleTriggered],
      undoPlan: i.diagnosis?.suggestedFix.undoAction || 'Rollback automated action via HandsService.executeUndo',
    }));

  const postmortems = allIncidents
    .filter((i) => Boolean(i.postmortem))
    .map((i) => {
      const faultMs = new Date(i.timestamps.faultStartedAt).getTime();
      const alarmMs = new Date(i.timestamps.alarmRaisedAt).getTime();
      const causeMs = new Date(i.timestamps.causeNamedAt || i.timestamps.alarmRaisedAt).getTime();
      return {
        id: `pm-${i.id}`,
        incidentId: i.id,
        title: i.title,
        generatedAt: i.timestamps.resolvedAt || i.timestamps.alarmRaisedAt,
        service: i.serviceId.replace('-service', ''),
        severity: i.severity === 'CRITICAL' ? ('Critical' as const) : ('High' as const),
        faultStartAt: i.timestamps.faultStartedAt,
        alarmRaisedAt: i.timestamps.alarmRaisedAt,
        causeNamedAt: i.timestamps.causeNamedAt || i.timestamps.alarmRaisedAt,
        resolvedAt: i.timestamps.resolvedAt || i.timestamps.alarmRaisedAt,
        detectionLagMs: Math.max(0, alarmMs - faultMs),
        diagnosisDurationMs: Math.max(0, causeMs - alarmMs),
        totalTtdMs: (i.timestamps.timeToDiagnosisSeconds ?? 12) * 1000,
        manualBaselineMs: CONFIG.MANUAL_DIAGNOSIS_BASELINE_SEC * 1000,
        fixPrUrl: i.fixPrUrl ?? null,
        markdown: i.postmortem || '',
      };
    });

  const projects = projectManager.listProjects();
  const probeHistoryByProject: Record<string, ReturnType<typeof projectManager.getProbeHistory>> = {};
  for (const p of projects) {
    probeHistoryByProject[p.id] = projectManager.getProbeHistory(p.id);
  }
  const projectServices = services.map((s) => ({
    id: s.id,
    name: s.id.replace(/-service$/, ''),
    url: s.healthUrl,
    status: s.status,
    errorRate5xx: s.currentStats.errorRate5xx,
    p95LatencyMs: s.currentStats.p95LatencyMs,
    throughputRpm: s.currentStats.throughputRpm,
    version: s.currentVersion,
    lastCheckedAt: s.lastCheck,
  }));

  res.json({
    target: {
      name: projects[0]?.name || 'PulseShop',
      activeRelease: services[0]?.currentVersion || 'main',
      canarySplit: {
        stable: 90,
        canary: 10,
        stableLabel: 'main',
        canaryLabel: 'canary',
      },
      services: mappedServices,
    },
    projects,
    projectServices,
    probeHistoryByProject,
    activeProjectId: projects[0]?.id || 'pulseshop',
    monitoringMode: CONFIG.MONITORING_MODE,
    githubApp: {
      configured: githubAppAuth.isConfigured(),
      installUrl: githubAppAuth.getInstallUrl(),
      installations: sqliteStore.getInstallations(),
    },
    ephemeralStats: ephemeralVault.getStats(),
    scorecard: {
      meanTtdMs: sc.avgTimeToDiagnosisSeconds * 1000,
      manualBaselineMs: sc.manualBaselineSeconds * 1000,
      incidentsTotal: sc.totalIncidents,
      fixPrsOpened: sc.fixPrsOpened,
      sietchPackagesBlocked: sc.threatsBlockedBySietch,
      pendingApprovals: sc.pendingApprovals,
    },
    incidents: mappedIncidents,
    approvals,
    auditLog: incidentManager.getAuditLog(),
    sietchScans: sietchStore.scans,
    postmortems,
    applications: syntheticProber.getAll(),
    connectedApplications: syntheticProber.getAll(),
  });
});

// ==========================================
// 7. Fault Simulation & Demo Control
// ==========================================
router.post('/incidents/simulate', async (req: Request, res: Response) => {
  const { scenario, serviceId = 'orders-service' } = req.body || {};
  const validScenarios = ['bug_checkout', 'slow_query', 'killed_service', 'bad_package', 'memory_leak'];

  if (!validScenarios.includes(scenario)) {
    return res.status(400).json({ error: `Invalid scenario. Choose from: ${validScenarios.join(', ')}` });
  }

  logCollector.injectFaultLogs(serviceId, scenario);

  if (scenario === 'bug_checkout') {
    serviceRegistry.updateStats(
      serviceId,
      { errorRate5xx: 0.165, p95LatencyMs: 190, throughputRpm: 120, memoryUsagePercent: 50, cpuPercent: 32 },
      'DEGRADED'
    );
  } else if (scenario === 'slow_query') {
    serviceRegistry.updateStats(
      serviceId,
      { errorRate5xx: 0.08, p95LatencyMs: 2400, throughputRpm: 80, memoryUsagePercent: 62, cpuPercent: 78 },
      'DEGRADED'
    );
  } else if (scenario === 'killed_service') {
    serviceRegistry.updateStats(
      serviceId,
      { errorRate5xx: 1.0, p95LatencyMs: 0, throughputRpm: 0, memoryUsagePercent: 0, cpuPercent: 0 },
      'DOWN'
    );
  } else if (scenario === 'memory_leak') {
    serviceRegistry.updateStats(
      serviceId,
      { errorRate5xx: 0.04, p95LatencyMs: 650, throughputRpm: 210, memoryUsagePercent: 96.8, cpuPercent: 88 },
      'WARNING'
    );
  }

  const rule =
    scenario === 'killed_service'
      ? 'Service down: Container health check failed'
      : scenario === 'slow_query'
        ? 'p95 response time spike: 2400ms > 400ms'
        : scenario === 'bad_package'
          ? 'Sietch blocked malicious package'
          : '5xx error rate exceeded threshold: 16.5%';

  const { category, evidence } = culpritFinder.findCulprit(serviceId, rule);
  const incident = incidentManager.createIncident(serviceId, rule, category, evidence);
  wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);

  setTimeout(async () => {
    const diagnosis = await brainService.diagnose(incident);
    incidentManager.setDiagnosis(incident.id, diagnosis);
    wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

    await handsService.handleRemediation(incident);
    wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
  }, 400);

  return res.json({
    success: true,
    message: `Scenario '${scenario}' simulated successfully. Incident ${incident.id} triggered.`,
    incidentId: incident.id,
  });
});

router.post('/incidents/reset', (_req: Request, res: Response) => {
  for (const s of serviceRegistry.getAll()) {
    serviceRegistry.updateStats(
      s.id,
      {
        errorRate5xx: 0.002,
        p95LatencyMs: 45,
        throughputRpm: 450,
        ordersRpm: 85,
        memoryUsagePercent: 40,
        cpuPercent: 15,
      },
      'HEALTHY'
    );
  }

  logCollector.appendLog('gateway-service', '[Demo Reset] System reset to clean baseline healthy state.');
  wsBroadcaster.broadcast('SYSTEM_RESET', { status: 'HEALTHY' });
  res.json({ success: true, message: 'All services reset to HEALTHY baseline.' });
});

export default router;
