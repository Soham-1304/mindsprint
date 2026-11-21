import http from 'node:http';
import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteStore } from '../db/sqliteStore.js';
import { assertPrOnlyBranch } from '../pr-bot/index.js';
import { EphemeralVault, redactSensitiveText } from '../privacy/ephemeralVault.js';
import { webhookService } from '../services/webhookService.js';
import { applySurgicalPatch, brainService } from '../services/brainService.js';
import { handsService } from '../services/handsService.js';
import { incidentManager } from '../services/incidentManager.js';
import { createApp } from '../server.js';
import type { Incident, LinkedProject } from '../types/index.js';

describe('Push-Ephemeral Privacy, SQLite, Sietch Self-Gate & Surgical Patch Platform', () => {
  beforeEach(() => {
    brainService.setMockGeminiCaller(undefined);
    brainService.setMockGroqCaller(undefined);
  });

  it('1. SQLite persistence stores and retrieves projects, incidents (without raw logs), and audit_log', () => {
    const store = new SqliteStore(':memory:');
    const now = new Date().toISOString();

    const project: LinkedProject = {
      id: 'proj-test-1',
      name: 'demo-app',
      repoOwner: 'acme',
      repoName: 'demo-app',
      fullName: 'acme/demo-app',
      defaultBranch: 'main',
      capabilities: {
        githubApp: true,
        healthEndpoint: true,
        prometheusMetrics: false,
        jsonTelemetry: false,
        pushLogsActive: true,
        sietchGate: true,
        activeSignalsCount: 4,
        totalSignalsCount: 6,
        accuracyLevel: 'MEDIUM',
        warnings: [],
        checkedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    store.saveProject(project);
    expect(store.getProjectById('proj-test-1')?.fullName).toBe('acme/demo-app');
    expect(store.getProjects().length).toBe(1);

    const inc: Incident = {
      id: 'INC-SQLITE-001',
      projectId: 'proj-test-1',
      serviceId: 'orders-service',
      title: 'SQLite Persistence Test',
      ruleTriggered: '5xx > 5%',
      category: 'CODE_BUG',
      status: 'RESOLVED',
      severity: 'CRITICAL',
      timestamps: { faultStartedAt: now, alarmRaisedAt: now, resolvedAt: now },
      evidence: {
        metricSnapshots: { errorRate5xx: 0.12 },
        recentLogs: ['SECRET RAW LOG LINE THAT MUST NOT BE PERSISTED'],
      },
      actionsTaken: [],
    };
    store.saveIncident(inc);
    const loaded = store.getIncidentById('INC-SQLITE-001');
    expect(loaded?.id).toBe('INC-SQLITE-001');
    expect(loaded?.evidence.recentLogs).toEqual([]);

    store.saveAuditEntry({
      id: 'aud-test-1',
      timestamp: now,
      actor: 'AI_AGENT',
      tier: 'AUTO',
      action: 'OPEN_FIX_PR',
      target: 'orders.js',
      outcome: 'EXECUTED',
      incidentId: 'INC-SQLITE-001',
    });
    expect(store.getAuditEntries(10)[0]?.action).toBe('OPEN_FIX_PR');
    store.close();
  });

  it('2. Hard PR-Only guardrail blocks direct writes to main/master', () => {
    expect(() => assertPrOnlyBranch('main')).toThrow(/POLICY_BLOCKED/);
    expect(() => assertPrOnlyBranch('master')).toThrow(/POLICY_BLOCKED/);
    expect(() => assertPrOnlyBranch('fix/inc-001')).not.toThrow();
  });

  it('3. EphemeralVault scrubs PII/secrets and issues SHA-256 PurgeReceipt with bytesRetained=0', () => {
    const vault = new EphemeralVault();
    const raw =
      'User alice@example.com failed auth with Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig123456 and AWS AKIAIOSFODNN7EXAMPLE';
    const scrubbed = redactSensitiveText(raw);
    expect(scrubbed.sanitized).not.toContain('alice@example.com');
    expect(scrubbed.sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(scrubbed.sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(scrubbed.redactions).toBeGreaterThanOrEqual(3);

    const ingest = vault.ingestBundle('INC-VAULT-1', {
      logs: [raw],
      metrics: { errorRate5xx: 0.2 },
      sourceFiles: { 'app.js': 'const db = "postgres://admin:supersecret@db.internal:5432/app";' },
      windowHours: 6,
    });
    expect(ingest.storedItems).toBe(3);
    expect(ingest.redactionsApplied).toBeGreaterThanOrEqual(4);

    const ctx = vault.getContext('INC-VAULT-1');
    expect(ctx?.sourceFiles['app.js']).toContain('[REDACTED_DB_PASS]');

    const receipt = vault.purgeIncidentData('INC-VAULT-1');
    expect(receipt.bytesRetained).toBe(0);
    expect(receipt.itemsPurged).toBe(3);
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(vault.getContext('INC-VAULT-1')).toBeUndefined();
  });

  it('4. Unified Push-On-Break ingestion handles App bundle, Logstash JSON, and AWS CloudWatch SNS ALB 5xx alarm', async () => {
    const appRes = await webhookService.handleIncidentBundle({
      projectId: 'pulseshop',
      serviceId: 'push-app-svc',
      rule: '5xx error rate exceeded 12%',
      severity: 'CRITICAL',
      windowHours: 6,
      metrics: { errorRate5xx: 0.12 },
      logs: ['ERROR TypeError: cannot read property x of undefined (contact ops@pulseshop.io)'],
    });
    expect(appRes.accepted).toBe(true);
    expect(appRes.source).toBe('app');
    expect(appRes.redactionsApplied).toBeGreaterThanOrEqual(1);

    const logstashRes = await webhookService.handleIncidentBundle({
      '@timestamp': new Date().toISOString(),
      level: 'ERROR',
      service: 'push-logstash-svc',
      message: 'Unhandled rejection in payment handler',
    });
    expect(logstashRes.accepted).toBe(true);
    expect(logstashRes.source).toBe('logstash');

    const cwRes = await webhookService.handleIncidentBundle({
      Type: 'Notification',
      Message: JSON.stringify({
        AlarmName: 'Pulseshop-ALB-5XX',
        NewStateValue: 'ALARM',
        NewStateReason: 'Threshold Crossed: 15 datapoints were greater than threshold (10.0)',
        Trigger: {
          MetricName: 'HTTPCode_ELB_5XX_Count',
          Namespace: 'AWS/ApplicationELB',
          Dimensions: [{ name: 'LoadBalancer', value: 'app/pulseshop-alb/12345' }],
          Threshold: 10,
        },
      }),
    });
    expect(cwRes.accepted).toBe(true);
    expect(cwRes.source).toBe('cloudwatch');
    const cwIncident = incidentManager.getById(cwRes.incidentId);
    expect(cwIncident?.category).toBe('RUNTIME_FAULT');
  });

  it('5. Surgical patch applySurgicalPatch preserves surrounding code and node --check rejects broken JS', async () => {
    const original = [
      'const header = true;',
      'function calc(promo) {',
      '  return promo.discountMeta.percentage;',
      '}',
      'const footer = true;',
    ].join('\n');

    const patched = applySurgicalPatch(original, {
      targetFile: 'services/orders/src/routes/orders.js',
      originalBlock: '  return promo.discountMeta.percentage;',
      replacementBlock: '  return promo?.discountMeta?.percentage ?? 0;',
    });

    expect(patched.ok).toBe(true);
    if (patched.ok) {
      expect(patched.patchedContent).toContain('const header = true;');
      expect(patched.patchedContent).toContain('const footer = true;');
      expect(patched.patchedContent).toContain('promo?.discountMeta?.percentage ?? 0');
    }

    // Whitespace / indentation-tolerant unique match
    const wsPatched = applySurgicalPatch(original, {
      targetFile: 'services/orders/src/routes/orders.js',
      originalBlock: 'function calc(promo) {\n      return promo.discountMeta.percentage;\n}',
      replacementBlock: 'function calc(promo) {\n  return promo?.discountMeta?.percentage ?? 0;\n}',
    });
    expect(wsPatched.ok).toBe(true);
    if (wsPatched.ok) {
      expect(wsPatched.patchedContent).toContain('promo?.discountMeta?.percentage ?? 0');
      expect(wsPatched.patchedContent).toContain('const footer = true;');
    }

    const inc = incidentManager.createIncident(
      'syntax-gate-svc',
      'Syntax gate test',
      'CODE_BUG',
      { metricSnapshots: {}, recentLogs: [] }
    );
    const brokenProof = await brainService.verifyPatchWithTests(
      inc,
      'services/orders/src/routes/orders.js',
      'function broken( { return ;;; }'
    );
    expect(brokenProof.afterStatus).toBe('FAIL');
    expect(brokenProof.afterOutput).toContain('Syntax validation failed');
  });

  it('6. Sietch Self-Gate blocks an Agent Fix PR containing a leaked AKIA secret or mem_limit: 24m', async () => {
    const inc = incidentManager.createIncident(
      'self-gate-svc',
      'Self gate secret leak test',
      'CODE_BUG',
      { metricSnapshots: {}, recentLogs: [] }
    );

    brainService.setMockGeminiCaller(async () => ({
      summary: 'Attempt fix with leaked AWS key in comment',
      rootCause: 'Missing null check',
      evidence: ['Log line'],
      confidence: 0.9,
      blastRadius: 'orders',
      safetyTier: 'AUTO_FIX',
      recoveryStrategies: [
        {
          name: 'Surgical Patch with Leaked Secret',
          description: 'Fix null check but accidentally include AKIA secret',
          actionType: 'FIX_PR',
          tier: 'AUTO_FIX',
          risks: 'High',
          targetFile: 'services/orders/src/routes/orders.js',
        },
      ],
      suggestedFix: {
        actionType: 'FIX_PR',
        description: 'Fix null check with accidental secret',
        targetFile: 'services/orders/src/routes/orders.js',
        surgicalPatch: {
          targetFile: 'services/orders/src/routes/orders.js',
          originalBlock: 'const pct = promo.discountMeta.percentage;',
          replacementBlock:
            'const pct = promo?.discountMeta?.percentage ?? 0; // leaked AKIAIOSFODNN7EXAMPLE',
        },
      },
    }));

    const diagnosis = await brainService.diagnose(inc);
    incidentManager.setDiagnosis(inc.id, diagnosis);

    const execResult = await handsService.handleRemediation(inc);
    expect(execResult.executed).toBe(false);
    expect(execResult.reason).toBe('SIETCH_SELF_GATE_BLOCKED');
    expect(inc.sietchSelfGate?.blocked).toBe(true);
    expect(inc.status).toBe('WAITING_APPROVAL');
  });

  it('7. GET /api/incidents/:id/report.md downloads clean Markdown RCA report with Purge Receipt', async () => {
    const inc = incidentManager.createIncident(
      'report-svc',
      'Report download test',
      'CODE_BUG',
      { metricSnapshots: { errorRate5xx: 0.1 }, recentLogs: [] }
    );
    incidentManager.setPurgeReceipt(inc.id, {
      incidentId: inc.id,
      purgedAt: new Date().toISOString(),
      bytesRetained: 0,
      itemsPurged: 4,
      redactionsApplied: 2,
      receiptHash: 'a'.repeat(64),
    });

    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };

    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/incidents/${inc.id}/report.md`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      expect(res.headers.get('content-disposition')).toContain(`patch-up-report-${inc.id}.md`);
      const text = await res.text();
      expect(text).toContain(`# Incident Postmortem & RCA Report: ${inc.id}`);
      expect(text).toContain('bytesRetained: 0');
      expect(text).toContain('a'.repeat(64));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
