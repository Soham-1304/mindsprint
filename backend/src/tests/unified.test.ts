import crypto from 'node:crypto';
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../config/index.js';
import { createApp } from '../server.js';
import { brainService } from '../services/brainService.js';
import { handsService } from '../services/handsService.js';
import { verifierService } from '../services/verifierService.js';
import { webhookService, sietchStore } from '../services/webhookService.js';
import { incidentManager } from '../services/incidentManager.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { prBot } from '../pr-bot/index.js';
import type { Incident } from '../types/index.js';
import type { SietchPrScanResult } from '../sietch/types.js';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  brainService.setMockGeminiCaller(undefined);
  brainService.setMockGroqCaller(undefined);
  vi.restoreAllMocks();
});

describe('Unified SRE Agent + Sietch Backend', () => {
  it('diagnoses via Gemini primary, falls back to Groq (AI_GROQ), and falls back to PulseShop heuristic', async () => {
    const inc = incidentManager.createIncident(
      'orders-service',
      '5xx error rate exceeded threshold: 16.5%',
      'CODE_BUG',
      {
        metricSnapshots: { errorRate5xx: 0.165, p95LatencyMs: 180, throughputRpm: 120 },
        recentLogs: ["TypeError: Cannot read properties of undefined (reading 'percentage') at calculatePromoDiscount"],
        stackTrace:
          "TypeError: Cannot read properties of undefined (reading 'percentage')\n    at calculatePromoDiscount (services/orders/src/routes/orders.js:51:28)",
      }
    );

    // 1. Primary Gemini mock
    brainService.setMockGeminiCaller(async () => ({
      summary: 'Null dereference in calculatePromoDiscount',
      rootCause: 'promo.discountMeta.percentage accessed without optional chaining',
      confidence: 0.96,
      safetyTier: 'AUTO_FIX',
      recoveryStrategies: [
        {
          name: 'Optional Chaining Fix PR',
          description: 'Guard promo.discountMeta.percentage',
          actionType: 'FIX_PR',
          tier: 'AUTO_FIX',
          risks: 'Low',
          targetFile: 'services/orders/src/routes/orders.js',
        },
      ],
    }));

    const geminiDiag = await brainService.diagnose(inc);
    expect(geminiDiag.diagnosisSource).toBe('AI_GEMINI');
    expect(geminiDiag.modelUsed).toBe(CONFIG.GEMINI_MODEL);

    // 2. Primary fails -> Groq backup succeeds
    brainService.setMockGeminiCaller(async () => {
      throw new Error('Gemini 429 rate limit');
    });
    brainService.setMockGroqCaller(async () => ({
      summary: 'Groq diagnosis: calculatePromoDiscount null dereference',
      rootCause: 'promo.discountMeta is undefined',
      confidence: 0.93,
      safetyTier: 'AUTO_FIX',
      recoveryStrategies: [
        {
          name: 'Guard discountMeta',
          description: 'Add optional chaining',
          actionType: 'FIX_PR',
          tier: 'AUTO_FIX',
          risks: 'Low',
        },
      ],
    }));

    const groqDiag = await brainService.diagnose(inc);
    expect(groqDiag.diagnosisSource).toBe('AI_GROQ');
    expect(groqDiag.modelUsed).toBe(CONFIG.GROQ_MODEL);

    // 3. Both fail -> PulseShop-grounded heuristic fallback
    brainService.setMockGroqCaller(async () => {
      throw new Error('Groq unavailable');
    });
    const heuristicDiag = await brainService.diagnose(inc);
    expect(heuristicDiag.diagnosisSource).toBe('DETERMINISTIC_HEURISTIC');
    expect(heuristicDiag.suggestedFix.targetFile).toBe('services/orders/src/routes/orders.js');
    expect(heuristicDiag.rootCause).toContain('calculatePromoDiscount');
  });

  it('verifies GitHub raw-body HMAC signatures accurately', () => {
    const prevSecret = CONFIG.WEBHOOKS.GITHUB_SECRET;
    CONFIG.WEBHOOKS.GITHUB_SECRET = 'test-webhook-secret-2026';

    try {
      const payload = Buffer.from(JSON.stringify({ ref: 'refs/heads/main', after: 'abc1234' }), 'utf8');
      const validSig = 'sha256=' + crypto.createHmac('sha256', CONFIG.WEBHOOKS.GITHUB_SECRET).update(payload).digest('hex');

      expect(webhookService.verifyGitHubSignature(payload, validSig)).toBe(true);
      expect(webhookService.verifyGitHubSignature(payload, 'sha256=deadbeef')).toBe(false);
      expect(webhookService.verifyGitHubSignature(payload, undefined)).toBe(false);
    } finally {
      CONFIG.WEBHOOKS.GITHUB_SECRET = prevSecret;
    }
  });

  it('accepts POST /api/deployments and evaluates GET /gate/:release', async () => {
    // Ensure clean healthy state
    await fetch(`${baseUrl}/api/incidents/reset`, { method: 'POST' });
    for (const inc of incidentManager.getAll()) {
      if (inc.status !== 'RESOLVED' && inc.status !== 'FAILED') {
        incidentManager.resolveIncident(inc.id, 'Resolved for gate test');
      }
    }

    const deployRes = await fetch(`${baseUrl}/api/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: 'abc123456789',
        branch: 'canary',
        service: 'orders-service',
        environment: 'canary',
        author: 'soham',
        timestamp: new Date().toISOString(),
      }),
    });
    expect(deployRes.status).toBe(201);
    const deployJson = (await deployRes.json()) as any;
    expect(deployJson.success).toBe(true);
    expect(deployJson.marker.commitSha).toBe('abc123456789');

    const gatePassRes = await fetch(`${baseUrl}/gate/abc123456789`);
    expect(gatePassRes.status).toBe(200);
    const gatePass = (await gatePassRes.json()) as any;
    expect(gatePass.verdict).toBe('PASS');

    // Simulate degraded 5xx -> gate FAIL (409)
    serviceRegistry.updateStats(
      'orders-service',
      {
        errorRate5xx: 0.25,
        p95LatencyMs: 50,
        throughputRpm: 100,
        memoryUsagePercent: 40,
        cpuPercent: 20,
      },
      'DEGRADED'
    );

    const gateFailRes = await fetch(`${baseUrl}/gate/abc123456789`);
    expect(gateFailRes.status).toBe(409);
    const gateFail = (await gateFailRes.json()) as any;
    expect(gateFail.verdict).toBe('FAIL');
    expect(gateFail.metricsComparison.errorRate5xx).toBe(0.25);

    await fetch(`${baseUrl}/api/incidents/reset`, { method: 'POST' });
  });

  it('PR Bot executes dry-run openFixPr, openRevertPr, and postSietchCheckStatus cleanly', async () => {
    const prevToken = CONFIG.GITHUB_TOKEN;
    CONFIG.GITHUB_TOKEN = '';

    try {
      const inc = incidentManager.createIncident('orders-service', '5xx spike', 'CODE_BUG', {
        metricSnapshots: { errorRate5xx: 0.2 },
        recentLogs: [],
      });

      const fixPr = await prBot.openFixPr({
        incident: inc,
        branchName: 'fix/test-pr-bot',
        targetFile: 'services/orders/src/routes/orders.js',
        fixedFileContent: '// fixed',
        title: 'fix(orders): guard discountMeta',
        body: 'Test PR body',
      });
      expect(fixPr.dryRun).toBe(true);
      expect(fixPr.prNumber).toBeGreaterThan(0);
      expect(fixPr.prUrl).toContain('github.com');

      const revertPr = await prBot.openRevertPr({
        incidentId: inc.id,
        commitSha: 'deadbeef1234',
        reason: 'Sietch blocked malicious package',
      });
      expect(revertPr.dryRun).toBe(true);
      expect(revertPr.branchName).toContain('sietch/revert-deadbee');

      const fakeScan = {
        id: 'scan-1',
        createdAt: new Date().toISOString(),
        repo: 'Soham-1304/pulseshop',
        branch: 'bad-package',
        prNumber: 46,
        verdictKind: 'MALICIOUS',
        blocked: true,
        rulesetVersion: '1.0.0',
        durationMs: 120,
        ecosystemAdapters: [],
        dependencyChanges: [],
        layer1Detonations: [],
        layer2Typosquat: { layer: 'LAYER_2_TYPOSQUAT', checkedPackages: 1, status: 'BLOCK', findings: [] },
        layer3DiffGuard: { layer: 'LAYER_3_DIFF_GUARD', filesScanned: 1, linesScanned: 10, status: 'PASS', findings: [] },
        githubCheckRun: {
          name: 'sietch/preventive-gate',
          status: 'completed',
          conclusion: 'failure',
          title: 'BLOCKED: Malicious package detected',
          summary: 'Blocked',
          markdownReport: '## Sietch Blocked',
        },
      } as unknown as SietchPrScanResult;

      const statusRes = await prBot.postSietchCheckStatus({
        commitSha: 'deadbeef1234',
        scan: fakeScan,
      });
      expect(statusRes.dryRun).toBe(true);
      expect(statusRes.statusPosted).toBe(true);
      expect(statusRes.commentPosted).toBe(true);
    } finally {
      CONFIG.GITHUB_TOKEN = prevToken;
    }
  });

  it('Verifier triggers handsService.executeUndo on verification timeout', async () => {
    const inc: Incident = incidentManager.createIncident(
      'orders-service',
      'p95 latency spike',
      'RUNTIME_FAULT',
      { metricSnapshots: { errorRate5xx: 0.1 }, recentLogs: [] }
    );
    inc.diagnosis = {
      diagnosisSource: 'DETERMINISTIC_HEURISTIC',
      summary: 'Retry storm',
      rootCause: 'Overloaded orders-service',
      evidence: ['p95 > 400ms'],
      confidence: 0.9,
      blastRadius: 'orders-service',
      recoveryStrategies: [],
      explanation: 'Trip breaker',
      safetyTier: 'AUTO_FIX',
      suggestedFix: {
        actionType: 'CIRCUIT_BREAKER_TRIP',
        description: 'Trip breaker on gateway-service',
        targetService: 'gateway-service',
      },
    };

    // Register a fake unhealthy service URL that will fail verification quickly
    serviceRegistry.registerOrUpdate({
      id: 'test-undo-svc',
      name: 'Test Undo Service',
      repo: 'Soham-1304/pulseshop',
      metricsUrl: 'http://127.0.0.1:1/metrics',
      healthUrl: 'http://127.0.0.1:1/health',
      containerName: 'pulseshop-orders',
      status: 'DEGRADED',
      currentVersion: 'v1',
      currentStats: {
        errorRate5xx: 0.5,
        p95LatencyMs: 900,
        throughputRpm: 10,
        memoryUsagePercent: 50,
        cpuPercent: 50,
      },
    });
    inc.serviceId = 'test-undo-svc';

    const undoSpy = vi.spyOn(handsService, 'executeUndo');
    const ok = await verifierService.watchRecovery(inc, 10, 40);

    expect(ok).toBe(false);
    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(inc.evidence.verificationEvidence?.undoExecuted).toBe(true);
    expect(inc.status).toBe('WAITING_APPROVAL');
  });

  it('serves unified GET /api/dashboard/overview and supports POST /api/approvals/:id/decide', async () => {
    const inc = incidentManager.createIncident('orders-service', 'Memory leak detected', 'MEMORY_LEAK', {
      metricSnapshots: { memoryUsagePercent: 95 },
      recentLogs: [],
    });
    inc.status = 'WAITING_APPROVAL';
    inc.diagnosis = {
      diagnosisSource: 'DETERMINISTIC_HEURISTIC',
      summary: 'Memory leak',
      rootCause: 'Unbounded cache',
      evidence: ['Heap > 90%'],
      confidence: 0.9,
      blastRadius: 'orders-service',
      recoveryStrategies: [],
      explanation: 'Scale memory',
      safetyTier: 'ASK_FIRST',
      suggestedFix: {
        actionType: 'SCALE_SERVICE',
        description: 'Scale container memory to 1024MB',
      },
    };

    const overviewRes = await fetch(`${baseUrl}/api/dashboard/overview`);
    expect(overviewRes.status).toBe(200);
    const overview = (await overviewRes.json()) as any;
    expect(overview.target?.name).toBe('PulseShop');
    expect(Array.isArray(overview.incidents)).toBe(true);
    expect(Array.isArray(overview.approvals)).toBe(true);
    expect(Array.isArray(overview.auditLog)).toBe(true);
    expect(Array.isArray(overview.sietchScans)).toBe(true);
    expect(Array.isArray(overview.postmortems)).toBe(true);

    // Reject via /api/approvals/:id/decide with operator token
    const unauthRes = await fetch(`${baseUrl}/api/approvals/apr-${inc.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'REJECTED' }),
    });
    expect(unauthRes.status).toBe(401);

    const rejectRes = await fetch(`${baseUrl}/api/approvals/apr-${inc.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operator-Token': CONFIG.OPERATOR_APPROVAL_TOKEN,
      },
      body: JSON.stringify({ decision: 'REJECTED', operator: 'judge', reason: 'Hold for maintenance window' }),
    });
    expect(rejectRes.status).toBe(200);
    const rejectJson = (await rejectRes.json()) as any;
    expect(rejectJson.decision).toBe('REJECTED');
  });
});
