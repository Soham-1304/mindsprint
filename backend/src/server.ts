import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import { CONFIG } from './config/index.js';
import routes, { buildCanaryGateResult } from './api/routes.js';
import { wsBroadcaster } from './api/websocket.js';
import { metricsCollector } from './services/metricsCollector.js';
import { culpritFinder } from './services/culpritFinder.js';
import { incidentManager } from './services/incidentManager.js';
import { brainService } from './services/brainService.js';
import { handsService } from './services/handsService.js';
import { syntheticProber } from './services/syntheticProber.js';
import { sietchStore, webhookService } from './services/webhookService.js';
import { runSietchPrSuite } from './sietch/suite.js';

const execFileAsync = promisify(execFile);

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'UP',
      agent: 'Patch-Up + Sietch SRE Agent Backend (AIA-02)',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/gate/:release', (req, res) => {
    const gate = buildCanaryGateResult(String(req.params.release));
    return res.status(gate.verdict === 'FAIL' ? 409 : 200).json(gate);
  });

  app.use('/api', routes);

  return app;
}

async function bootstrapSietchScans(): Promise<void> {
  const repoDir = CONFIG.PULSESHOP_REPO_DIR;
  const fallbackDiffs: Record<string, { prNumber: number; commitSha: string; diffText: string }> = {
    'low-memory': {
      prNumber: 43,
      commitSha: '6e71525',
      diffText: [
        'diff --git a/docker-compose.yml b/docker-compose.yml',
        '--- a/docker-compose.yml',
        '+++ b/docker-compose.yml',
        '@@ -67,6 +67,7 @@ services:',
        '     container_name: pulseshop-orders',
        '+    mem_limit: 24m',
        '     restart: unless-stopped',
      ].join('\n'),
    },
    'bad-package': {
      prNumber: 42,
      commitSha: '3450f2f',
      diffText: [
        'diff --git a/services/orders/package.json b/services/orders/package.json',
        '--- a/services/orders/package.json',
        '+++ b/services/orders/package.json',
        '@@ -10,6 +10,7 @@',
        '     "mongoose": "^8.8.1",',
        '-    "prom-client": "^15.1.3"',
        '+    "prom-client": "^15.1.3",',
        '+    "@sietch-demo/currency-format-lite": "1.0.2"',
      ].join('\n'),
    },
  };

  for (const branch of ['low-memory', 'bad-package']) {
    let diffText = '';
    let commitSha = fallbackDiffs[branch].commitSha;
    try {
      await execFileAsync('git', ['-C', repoDir, 'rev-parse', '--verify', branch], {
        timeout: 3000,
      });
      const { stdout } = await execFileAsync('git', ['-C', repoDir, 'show', '--format=', branch], {
        timeout: 5000,
      });
      diffText = stdout;
    } catch {
      diffText = fallbackDiffs[branch].diffText;
    }

    try {
      if (diffText.trim().length > 0) {
        const scan = await runSietchPrSuite({
          repo: `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`,
          branch,
          prNumber: fallbackDiffs[branch].prNumber,
          commitSha,
          diffText,
        });
        sietchStore.addScan(scan);
        if (scan.blocked) {
          incidentManager.incrementBlockedThreats();
        }
      }
    } catch {
      // Non-blocking bootstrap
    }
  }
}

export function startServer() {
  const app = createApp();
  const server = http.createServer(app);

  wsBroadcaster.init(server);

  if (CONFIG.MONITORING_MODE === 'hybrid' || CONFIG.MONITORING_MODE === 'pull') {
    metricsCollector.start(async (serviceId, ruleTriggered) => {
      const { category, evidence } = await culpritFinder.findCulpritAsync(
        serviceId,
        ruleTriggered,
        sietchStore.scans[0]
      );

      const { incident, isNew, requiresReassessment } = incidentManager.checkNewEvidence(
        serviceId,
        ruleTriggered,
        category,
        evidence
      );

      if (!isNew && !requiresReassessment) {
        return;
      }

      console.log(
        `[Watcher Alarm] ${isNew ? 'New incident detected' : 'Meaningful new evidence detected'} on ${serviceId}: ${ruleTriggered}`
      );

      if (isNew) {
        wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);
      }

      await culpritFinder.enrichJitSourceForIncident(incident);
      const diagnosis = await brainService.diagnose(incident);
      incidentManager.setDiagnosis(incident.id, diagnosis);
      wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

      await webhookService.dispatchOutgoingAlert(incident);
      await handsService.handleRemediation(incident);
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
    });

    syntheticProber.startProbingLoop(15000);
  } else {
    console.log(
      `[Patch-Up] Running in '${CONFIG.MONITORING_MODE}' mode — autonomous pull scraping disabled (100% Push-On-Break).`
    );
  }

  void bootstrapSietchScans();

  server.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`
======================================================
  UNIFIED SRE AGENT + SIETCH BACKEND (AIA-02) RUNNING
======================================================
  Port:              http://localhost:${CONFIG.PORT}
  REST API:          http://localhost:${CONFIG.PORT}/api
  SSE Stream:        http://localhost:${CONFIG.PORT}/api/events/stream
  WebSocket:         ws://localhost:${CONFIG.PORT}/ws
  Canary Gate:       GET  /gate/:release
  Sietch Suite:      /api/sietch/*
  Dashboard View:    GET  /api/dashboard/overview
======================================================
`);
  });

  return server;
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer();
}
