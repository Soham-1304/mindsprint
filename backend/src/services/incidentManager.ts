import type {
  AuditLogEntry,
  DeployMarker,
  Incident,
  IncidentAction,
  IncidentDiagnosis,
  IncidentEvidence,
  IncidentStatus,
  PurgeReceipt,
  Scorecard,
} from '../types/index.js';
import { CONFIG } from '../config/index.js';
import { sqliteStore } from '../db/sqliteStore.js';

export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private deployMarkers: DeployMarker[] = [];
  private auditLog: AuditLogEntry[] = [];
  private threatsBlockedCount = 0;

  constructor() {
    this.loadFromStore();
  }

  private loadFromStore(): void {
    const storedIncidents = sqliteStore.getIncidents();
    if (storedIncidents.length > 0) {
      for (const inc of storedIncidents) {
        this.incidents.set(inc.id, inc);
      }
      this.auditLog = sqliteStore.getAuditEntries(200);
    }
    // Zero seeded/fake incidents: all incidents come strictly from live webhooks, probes, or real fault triggers.
  }

  private seedHistoricalData(): void {
    // Seed an initial PulseShop deployment marker
    this.deployMarkers.push({
      id: 'dep-001',
      serviceId: 'orders-service',
      commitSha: 'b5de597',
      commitMessage: 'feat(orders): add promo code discount calculation to checkout',
      author: 'soham-1304@pulseshop.io',
      branch: 'main',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      environment: 'production',
      diffSummary: 'Changed services/orders/src/routes/orders.js (+14, -4) - calculatePromoDiscount()',
      changedFiles: ['services/orders/src/routes/orders.js'],
    });

    const pastIncidentId = 'INC-20261121-001';
    const t0 = new Date(Date.now() - 7200000).toISOString();
    const t1 = new Date(Date.now() - 7180000).toISOString();
    const t2 = new Date(Date.now() - 7164000).toISOString(); // 16s diagnosis
    const t3 = new Date(Date.now() - 7140000).toISOString();
    const t4 = new Date(Date.now() - 7080000).toISOString();

    const historicalIncident: Incident = {
      id: pastIncidentId,
      serviceId: 'orders-service',
      title: 'PulseShop Orders 5xx Spike in calculatePromoDiscount()',
      ruleTriggered: '5xx error rate exceeded threshold: 14.2% (Threshold: 5%)',
      category: 'CODE_BUG',
      status: 'RESOLVED',
      severity: 'CRITICAL',
      fixPrUrl: 'https://github.com/Soham-1304/pulseshop/pull/7',
      fixPrNumber: 7,
      timestamps: {
        faultStartedAt: t0,
        alarmRaisedAt: t1,
        causeNamedAt: t2,
        fixAppliedAt: t3,
        resolvedAt: t4,
        timeToDiagnosisSeconds: 16,
        timeToRecoverySeconds: 100,
      },
      evidence: {
        metricSnapshots: {
          errorRate5xx: 0.142,
          p95LatencyMs: 140,
          ordersRpm: 120,
        },
        recentLogs: [
          "ERROR [orders] TypeError: Cannot read properties of undefined (reading 'percentage')",
          '    at calculatePromoDiscount (services/orders/src/routes/orders.js:51:28)',
        ],
        stackTrace: `TypeError: Cannot read properties of undefined (reading 'percentage')
    at calculatePromoDiscount (services/orders/src/routes/orders.js:51:28)`,
        topFrame: {
          function: 'calculatePromoDiscount',
          file: 'services/orders/src/routes/orders.js',
          line: 51,
          column: 28,
          error: "Cannot read properties of undefined (reading 'percentage')",
        },
        suspectCommit: {
          sha: 'ad314b7',
          message: 'feat(orders): add promo code discount calculation to checkout',
          author: 'Soham-1304',
          file: 'services/orders/src/routes/orders.js',
          line: 51,
          diff: [
            '@@ -48,7 +48,9 @@ function calculatePromoDiscount(promoCode, subtotal) {',
            '   const discountMeta = PROMO_CODES[promoCode];',
            '-  const pct = discountMeta.percentage;',
            '+  if (!discountMeta || typeof discountMeta.percentage !== "number") {',
            '+    return 0;',
            '+  }',
            '+  const pct = discountMeta.percentage;',
            '   return Math.round(subtotal * (pct / 100) * 100) / 100;',
          ].join('\n'),
        },
      },
      diagnosis: {
        diagnosisSource: 'AI_GEMINI',
        modelUsed: CONFIG.GEMINI_MODEL,
        summary: 'Checkout endpoint throwing TypeError in calculatePromoDiscount when promo metadata is missing.',
        rootCause:
          'Unchecked property access (discountMeta.percentage) at services/orders/src/routes/orders.js:51 threw TypeError when promoCode was omitted or unrecognized.',
        evidence: [
          'TypeError at calculatePromoDiscount (services/orders/src/routes/orders.js:51)',
          '5xx error spike to 14.2% following commit b5de597',
        ],
        confidence: 0.98,
        uncertainty: 'High confidence due to exact topFrame + git blame match on commit b5de597.',
        blastRadius: 'Limited to PulseShop POST /orders checkout route.',
        recoveryStrategies: [
          {
            name: 'Null-safe Promo Discount Fix PR',
            description: 'Guard discountMeta?.percentage ?? 0 in calculatePromoDiscount() and add unit test.',
            actionType: 'FIX_PR',
            tier: 'AUTO_FIX',
            risks: 'Low risk, backward-compatible with all checkout payloads.',
            targetFile: 'services/orders/src/routes/orders.js',
          },
          {
            name: 'Revert Commit ad314b7 via PR',
            description: 'Open a clean git revert PR for commit ad314b7 to restore previous promo logic.',
            actionType: 'REVERT_PR',
            tier: 'AUTO_FIX',
            risks: 'Temporarily disables new promo discount codes until re-introduced safely.',
            targetFile: 'services/orders/src/routes/orders.js',
          },
        ],
        explanation:
          'Commit ad314b7 introduced direct access to discountMeta.percentage without optional chaining when promoCode is null.',
        safetyTier: 'AUTO_FIX',
        suggestedFix: {
          actionType: 'FIX_PR',
          description: 'Apply null guard: if (!discountMeta || typeof discountMeta.percentage !== "number") return 0;',
          targetFile: 'services/orders/src/routes/orders.js',
          codePatch: '-  const pct = discountMeta.percentage;\n+  if (!discountMeta || typeof discountMeta.percentage !== "number") return 0;\n+  const pct = discountMeta.percentage;',
        },
        regressionTestSnippet: 'it("handles checkout without promoCode safely", async () => { ... })',
      },
      actionsTaken: [
        {
          id: 'act-001',
          action: 'Created branch fix/inc-20261121-002-506g and opened PR #7 with regression test',
          tier: 'AUTO_FIX',
          executedBy: 'AI_AGENT',
          timestamp: t3,
          result: 'PR #7 opened on Soham-1304/pulseshop',
        },
        {
          id: 'act-002',
          action: 'Post-fix verification: syntax check & pre-merge security self-gate passed',
          tier: 'AUTO_FIX',
          executedBy: 'AI_AGENT',
          timestamp: t4,
          result: 'RAM purged (0 B retained)',
        },
      ],
      postmortem: `# Postmortem: INC-20261121-001
**Service**: PulseShop Orders Service
**Impact**: Checkout 5xx error rate spiked to 14.2% for ~100 seconds.
**Time to Diagnose**: 16 seconds (vs 18m manual baseline — 98.5% faster).
**Root Cause**: Unchecked \`discountMeta.percentage\` access in \`services/orders/src/routes/orders.js:51\` (commit \`ad314b7\`).
**Fix**: PR #7 added null-safe guard and regression test.`,
    };

    this.incidents.set(pastIncidentId, historicalIncident);
    sqliteStore.saveIncident(historicalIncident);

    const initialAudit: AuditLogEntry = {
      id: 'aud-001',
      timestamp: t3,
      actor: 'AI_AGENT',
      tier: 'AUTO',
      action: 'FIX_PR_OPENED (#7)',
      target: 'orders-service (services/orders/src/routes/orders.js:51)',
      outcome: 'EXECUTED',
      incidentId: pastIncidentId,
    };
    this.auditLog.push(initialAudit);
    sqliteStore.saveAuditEntry(initialAudit);
  }

  public hasActiveIncident(serviceId: string): boolean {
    return Array.from(this.incidents.values()).some(
      (i) => i.serviceId === serviceId && i.status !== 'RESOLVED' && i.status !== 'FAILED',
    );
  }

  public getActiveIncident(serviceId: string): Incident | undefined {
    return Array.from(this.incidents.values()).find(
      (i) => i.serviceId === serviceId && i.status !== 'RESOLVED' && i.status !== 'FAILED',
    );
  }

  /**
   * Evaluates incoming alarm evidence against existing active incident.
   * Suppresses duplicate AI invocations unless meaningful new evidence is detected.
   */
  public checkNewEvidence(
    serviceId: string,
    ruleTriggered: string,
    category: Incident['category'],
    evidence: IncidentEvidence,
  ): { incident: Incident; isNew: boolean; requiresReassessment: boolean } {
    const active = this.getActiveIncident(serviceId);
    if (!active) {
      const incident = this.createIncident(serviceId, ruleTriggered, category, evidence);
      return { incident, isNew: true, requiresReassessment: true };
    }

    let hasNewStackTrace = false;
    let hasNewCommit = false;
    let hasStateChange = false;

    if (evidence.stackTrace && !active.evidence.stackTrace) {
      active.evidence.stackTrace = evidence.stackTrace;
      hasNewStackTrace = true;
    }
    if (evidence.topFrame && !active.evidence.topFrame) {
      active.evidence.topFrame = evidence.topFrame;
    }
    if (evidence.suspectCommit && (!active.evidence.suspectCommit || active.evidence.suspectCommit.sha === 'HEAD')) {
      active.evidence.suspectCommit = evidence.suspectCommit;
      hasNewCommit = true;
    }
    if (
      evidence.containerState &&
      (!active.evidence.containerState || active.evidence.containerState.status !== evidence.containerState.status)
    ) {
      active.evidence.containerState = evidence.containerState;
      hasStateChange = true;
    }
    if (evidence.sietchVerdict && !active.evidence.sietchVerdict) {
      active.evidence.sietchVerdict = evidence.sietchVerdict;
    }

    if (evidence.recentLogs && evidence.recentLogs.length > 0) {
      active.evidence.recentLogs = [...active.evidence.recentLogs, ...evidence.recentLogs].slice(-30);
    }

    const requiresReassessment = hasNewStackTrace || hasNewCommit || hasStateChange;

    active.actionsTaken.push({
      id: `act-${Date.now()}`,
      action: requiresReassessment
        ? `Meaningful new evidence detected (${hasNewStackTrace ? 'New Stack Trace; ' : ''}${hasNewCommit ? 'New Commit; ' : ''}${hasStateChange ? 'State Change; ' : ''}): Triggering AI reassessment`
        : `Repeated alarm suppressed: ${ruleTriggered}`,
      tier: active.diagnosis?.safetyTier || 'AUTO_FIX',
      executedBy: 'AI_AGENT',
      timestamp: new Date().toISOString(),
      result: requiresReassessment ? 'Scheduled AI re-diagnosis' : 'Suppressed duplicate AI invocation',
    });

    sqliteStore.saveIncident(active);
    return { incident: active, isNew: false, requiresReassessment };
  }

  public createIncident(
    serviceId: string,
    ruleTriggered: string,
    category: Incident['category'],
    evidence: IncidentEvidence,
    severity: Incident['severity'] = 'CRITICAL',
  ): Incident {
    const active = this.getActiveIncident(serviceId);
    if (active) {
      if (evidence.recentLogs && evidence.recentLogs.length > 0) {
        active.evidence.recentLogs = [...active.evidence.recentLogs, ...evidence.recentLogs].slice(-30);
      }
      if (evidence.stackTrace && !active.evidence.stackTrace) {
        active.evidence.stackTrace = evidence.stackTrace;
      }
      if (evidence.topFrame && !active.evidence.topFrame) {
        active.evidence.topFrame = evidence.topFrame;
      }
      active.actionsTaken.push({
        id: `act-${Date.now()}`,
        action: `Repeated alarm suppressed: ${ruleTriggered}`,
        tier: active.diagnosis?.safetyTier || 'AUTO_FIX',
        executedBy: 'AI_AGENT',
        timestamp: new Date().toISOString(),
        result: 'Appended telemetry to existing active incident to prevent alarm flood',
      });
      sqliteStore.saveIncident(active);
      return active;
    }

    const id = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.incidents.size + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id,
      serviceId,
      title: `${serviceId.toUpperCase()}: ${ruleTriggered}`,
      ruleTriggered,
      category,
      status: 'DIAGNOSING',
      severity,
      fixPrUrl: null,
      fixPrNumber: null,
      timestamps: {
        faultStartedAt: new Date(Date.now() - 15000).toISOString(),
        alarmRaisedAt: now,
      },
      evidence,
      actionsTaken: [],
    };

    this.incidents.set(id, incident);
    sqliteStore.saveIncident(incident);
    return incident;
  }

  public setDiagnosis(id: string, diagnosis: IncidentDiagnosis): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    const now = new Date();
    const alarmTime = new Date(incident.timestamps.alarmRaisedAt);
    const diagnosisTimeSeconds = Math.max(1, Math.round((now.getTime() - alarmTime.getTime()) / 1000));

    incident.diagnosis = diagnosis;
    incident.timestamps.causeNamedAt = now.toISOString();
    incident.timestamps.timeToDiagnosisSeconds = diagnosisTimeSeconds;

    if (diagnosis.safetyTier === 'ASK_FIRST') {
      incident.status = 'WAITING_APPROVAL';
    } else {
      incident.status = 'RESOLVING';
    }

    sqliteStore.saveIncident(incident);
    return incident;
  }

  public setFixPr(id: string, prUrl: string, prNumber: number): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    incident.fixPrUrl = prUrl;
    incident.fixPrNumber = prNumber;
    sqliteStore.saveIncident(incident);
    return incident;
  }

  public setPurgeReceipt(id: string, receipt: PurgeReceipt): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    incident.purgeReceipt = receipt;
    sqliteStore.saveIncident(incident);
    return incident;
  }

  public setSietchSelfGate(
    id: string,
    gate: NonNullable<Incident['sietchSelfGate']>,
  ): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    incident.sietchSelfGate = gate;
    sqliteStore.saveIncident(incident);
    return incident;
  }

  public setRcaReport(id: string, markdown: string): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    incident.rcaReportMarkdown = markdown;
    sqliteStore.saveIncident(incident);
    return incident;
  }

  public rejectIncident(id: string, operator: string, reason?: string): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    incident.status = 'FAILED';
    incident.actionsTaken.push({
      id: `act-${Date.now()}`,
      action: `Operator rejected remediation proposal${reason ? `: ${reason}` : ''}`,
      tier: incident.diagnosis?.safetyTier || 'ASK_FIRST',
      executedBy: 'HUMAN_OPERATOR',
      timestamp: new Date().toISOString(),
      result: `Rejected by ${operator}`,
    });

    this.recordAudit({
      actor: operator,
      tier: 'ASK_FIRST',
      action: incident.diagnosis?.suggestedFix?.actionType || 'REMEDIATION_PROPOSAL',
      target: incident.serviceId,
      outcome: 'REJECTED',
      incidentId: id,
    });

    sqliteStore.saveIncident(incident);
    return incident;
  }

  public recordAction(id: string, action: Omit<IncidentAction, 'id' | 'timestamp'>): IncidentAction | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    const entry: IncidentAction = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...action,
    };

    incident.actionsTaken.push(entry);
    sqliteStore.saveIncident(incident);
    return entry;
  }

  public resolveIncident(id: string, postmortemMarkdown?: string): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    const now = new Date();
    const alarmTime = new Date(incident.timestamps.alarmRaisedAt);
    const recoverySeconds = Math.max(1, Math.round((now.getTime() - alarmTime.getTime()) / 1000));

    incident.status = 'RESOLVED';
    incident.timestamps.resolvedAt = now.toISOString();
    incident.timestamps.timeToRecoverySeconds = recoverySeconds;
    if (postmortemMarkdown) {
      incident.postmortem = postmortemMarkdown;
    }

    sqliteStore.saveIncident(incident);
    return incident;
  }

  public updateStatus(id: string, status: IncidentStatus): void {
    const incident = this.incidents.get(id);
    if (incident) {
      incident.status = status;
      sqliteStore.saveIncident(incident);
    }
  }

  public getById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public getAll(): Incident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.timestamps.alarmRaisedAt).getTime() - new Date(a.timestamps.alarmRaisedAt).getTime(),
    );
  }

  public recordDeployMarker(marker: Omit<DeployMarker, 'id'>): DeployMarker {
    const newMarker: DeployMarker = {
      id: `dep-${Date.now()}`,
      ...marker,
    };
    this.deployMarkers.unshift(newMarker);
    if (this.deployMarkers.length > 50) {
      this.deployMarkers.pop();
    }
    return newMarker;
  }

  public getRecentDeployMarkers(serviceId?: string, windowMinutes: number = 15): DeployMarker[] {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return this.deployMarkers.filter((m) => {
      const matchService = serviceId ? m.serviceId === serviceId : true;
      const withinTime = new Date(m.timestamp).getTime() >= cutoff;
      return matchService && withinTime;
    });
  }

  public recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const record: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLog.unshift(record);
    if (this.auditLog.length > 200) {
      this.auditLog.pop();
    }
    sqliteStore.saveAuditEntry(record);
    return record;
  }

  public getAuditLog(limit: number = 100): AuditLogEntry[] {
    return this.auditLog.slice(0, limit);
  }

  public incrementBlockedThreats(): void {
    this.threatsBlockedCount++;
  }

  public getScorecard(): Scorecard {
    const all = Array.from(this.incidents.values());
    const diagnosed = all.filter((i) => i.timestamps.timeToDiagnosisSeconds !== undefined);
    const fixed = all.filter((i) => i.status === 'RESOLVED');
    const fixPrsOpened = all.filter((i) => Boolean(i.fixPrUrl)).length;
    const pendingApprovals = all.filter((i) => i.status === 'WAITING_APPROVAL').length;

    const totalDiagnosisSec = diagnosed.reduce((acc, curr) => acc + (curr.timestamps.timeToDiagnosisSeconds || 0), 0);
    const avgMttd = diagnosed.length > 0 ? Math.round(totalDiagnosisSec / diagnosed.length) : 0;

    const manualSec = CONFIG.MANUAL_DIAGNOSIS_BASELINE_SEC;
    const timeSaved = diagnosed.reduce((acc, curr) => {
      const saved = manualSec - (curr.timestamps.timeToDiagnosisSeconds || 0);
      return acc + Math.max(0, saved);
    }, 0);

    return {
      totalIncidents: all.length,
      autoDiagnosed: diagnosed.length,
      autoFixed: fixed.length,
      fixPrsOpened,
      pendingApprovals,
      avgTimeToDiagnosisSeconds: avgMttd,
      manualBaselineSeconds: manualSec,
      timeSavedSeconds: timeSaved,
      threatsBlockedBySietch: this.threatsBlockedCount,
    };
  }
}

export const incidentManager = new IncidentManager();
