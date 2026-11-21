import axios from 'axios';
import type { Incident, VerificationCheck } from '../types/index.js';
import { incidentManager } from './incidentManager.js';
import { serviceRegistry } from './serviceRegistry.js';
import { brainService } from './brainService.js';
import { metricsCollector } from './metricsCollector.js';
import { logCollector } from './logCollector.js';
import { handsService } from './handsService.js';
import { CONFIG } from '../config/index.js';
import { wsBroadcaster } from '../api/websocket.js';

export class VerifierService {
  /**
   * Watches service recovery via genuine polling of the real health and metrics endpoints.
   * On timeout/failure, triggers handsService.executeUndo(incident) and records undoExecuted = true.
   */
  public async watchRecovery(
    incident: Incident,
    pollIntervalMs = 1500,
    maxWaitMs = CONFIG.VERIFICATION_WINDOW_SEC * 1000
  ): Promise<boolean> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const service = serviceRegistry.getById(incident.serviceId);

    if (!service) {
      logCollector.appendLog(incident.serviceId, `[Verifier] ERROR: Service '${incident.serviceId}' not found in registry.`);
      const undoRes = await handsService.executeUndo(incident);
      incident.evidence.verificationEvidence = {
        startedAt,
        completedAt: new Date().toISOString(),
        undoExecuted: undoRes.undone,
        undoDetail: undoRes.detail,
        checks: [],
      };
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
      return false;
    }

    logCollector.appendLog(
      incident.serviceId,
      `[Verifier] Starting recovery verification for ${service.id} (polling ${service.healthUrl} up to ${Math.round(maxWaitMs / 1000)}s)...`
    );

    const checks: VerificationCheck[] = [];

    while (Date.now() - startTime < maxWaitMs) {
      const now = new Date().toISOString();
      try {
        const healthRes = await axios.get(service.healthUrl, {
          timeout: CONFIG.HEALTH_CHECK_TIMEOUT_MS,
          validateStatus: () => true,
        });

        if (healthRes.status === 200) {
          checks.push({
            check: 'HTTP /health Probe',
            status: 'PASSED',
            detail: `Endpoint ${service.healthUrl} returned HTTP 200 OK`,
            timestamp: now,
            targetServiceId: service.id,
          });

          const scrape = await metricsCollector.scrapeService(service.id, service.metricsUrl, service.healthUrl);
          const errorRate = scrape.stats.errorRate5xx;
          const isErrorRateAcceptable = errorRate === null || errorRate <= CONFIG.THRESHOLDS.ERROR_RATE_MAX;

          if (isErrorRateAcceptable) {
            checks.push({
              check: 'Prometheus Telemetry Verification',
              status: 'PASSED',
              detail: `Telemetry stabilized: errorRate5xx=${errorRate !== null ? (errorRate * 100).toFixed(1) + '%' : 'N/A'}, p95LatencyMs=${scrape.stats.p95LatencyMs ?? 'N/A'}ms`,
              timestamp: now,
              targetServiceId: service.id,
            });

            const isCascading = incident.diagnosis?.isCascadingFailure === true;
            const dependents = serviceRegistry.getDependents(service.id);
            const impactedDependents = dependents.filter((d) => isCascading || d.status !== 'HEALTHY');
            let allDependentsHealthy = true;

            for (const dep of impactedDependents) {
              try {
                const depRes = await axios.get(dep.healthUrl, {
                  timeout: CONFIG.HEALTH_CHECK_TIMEOUT_MS,
                  validateStatus: () => true,
                });

                if (depRes.status === 200) {
                  const depScrape = await metricsCollector.scrapeService(dep.id, dep.metricsUrl, dep.healthUrl);
                  const depErr = depScrape.stats.errorRate5xx;
                  const isDepHealthy = depErr === null || depErr <= CONFIG.THRESHOLDS.ERROR_RATE_MAX;

                  if (isDepHealthy) {
                    checks.push({
                      check: `Dependent Upstream Health (${dep.id})`,
                      status: 'PASSED',
                      detail: `Dependent '${dep.id}' responded HTTP 200 and telemetry stabilized.`,
                      timestamp: now,
                      targetServiceId: dep.id,
                    });
                    serviceRegistry.updateStats(dep.id, depScrape.stats, 'HEALTHY');
                  } else {
                    allDependentsHealthy = false;
                    checks.push({
                      check: `Dependent Upstream Health (${dep.id})`,
                      status: 'FAILED',
                      detail: `Dependent '${dep.id}' error rate still elevated (${(depErr! * 100).toFixed(1)}%).`,
                      timestamp: now,
                      targetServiceId: dep.id,
                    });
                  }
                } else {
                  allDependentsHealthy = false;
                  checks.push({
                    check: `Dependent Upstream Health (${dep.id})`,
                    status: 'FAILED',
                    detail: `Dependent '${dep.id}' health probe returned HTTP ${depRes.status}.`,
                    timestamp: now,
                    targetServiceId: dep.id,
                  });
                }
              } catch (err: any) {
                allDependentsHealthy = false;
                checks.push({
                  check: `Dependent Upstream Health (${dep.id})`,
                  status: 'FAILED',
                  detail: `Dependent '${dep.id}' health probe failed: ${err.message}`,
                  timestamp: now,
                  targetServiceId: dep.id,
                });
              }
            }

            if (allDependentsHealthy) {
              serviceRegistry.updateStats(service.id, scrape.stats, 'HEALTHY');

              incident.evidence.verificationEvidence = {
                startedAt,
                completedAt: now,
                undoExecuted: false,
                checks,
              };

              logCollector.appendLog(
                incident.serviceId,
                `[Verifier] Service ${service.id} and dependent callers recovery CONFIRMED via real health probes & metrics!`
              );

              incident.status = 'RESOLVED';
              incident.timestamps.resolvedAt = now;
              const postmortem = brainService.generatePostmortem(incident);
              incidentManager.resolveIncident(incident.id, postmortem);

              incidentManager.recordAction(incident.id, {
                action: 'Verifier Confirmation',
                tier: incident.diagnosis?.safetyTier || 'AUTO_FIX',
                executedBy: 'AI_AGENT',
                result: `Recovery verified: /health responded HTTP 200, dependent services stabilized. Postmortem generated.`,
              });

              wsBroadcaster.broadcast('INCIDENT_RESOLVED', incidentManager.getById(incident.id));
              wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
              return true;
            }
          } else {
            checks.push({
              check: 'Prometheus Telemetry Verification',
              status: 'FAILED',
              detail: `Health check passed but error rate still elevated (${(errorRate! * 100).toFixed(1)}% > ${CONFIG.THRESHOLDS.ERROR_RATE_MAX * 100}%)`,
              timestamp: now,
              targetServiceId: service.id,
            });
          }
        } else {
          checks.push({
            check: 'HTTP /health Probe',
            status: 'FAILED',
            detail: `Health check returned HTTP ${healthRes.status} (expected 200)`,
            timestamp: now,
            targetServiceId: service.id,
          });
        }
      } catch (err: any) {
        checks.push({
          check: 'HTTP /health Probe',
          status: 'FAILED',
          detail: `Health check failed: ${err.message}`,
          timestamp: now,
          targetServiceId: service.id,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Verification window expired -> trigger Auto-Undo
    const completedAt = new Date().toISOString();
    logCollector.appendLog(
      incident.serviceId,
      `[Verifier] TIMEOUT: Recovery verification failed within ${Math.round(maxWaitMs / 1000)}s. Triggering Auto-Undo.`
    );

    const undoResult = await handsService.executeUndo(incident);

    incident.evidence.verificationEvidence = {
      startedAt,
      completedAt,
      undoExecuted: undoResult.undone,
      undoDetail: undoResult.detail,
      checks,
    };

    incidentManager.recordAction(incident.id, {
      action: 'Verifier Check Failed -> Auto-Undo',
      tier: incident.diagnosis?.safetyTier || 'AUTO_FIX',
      executedBy: 'AI_AGENT',
      result: `Verification timed out after ${Math.round(maxWaitMs / 1000)}s. ${undoResult.detail}`,
    });

    wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
    return false;
  }

  /**
   * Performs an immediate single-probe recovery check
   */
  public async verifyOnce(
    incident: Incident
  ): Promise<{ recovered: boolean; detail: string; checks: VerificationCheck[] }> {
    const service = serviceRegistry.getById(incident.serviceId);
    if (!service) {
      return { recovered: false, detail: `Service '${incident.serviceId}' not found`, checks: [] };
    }

    const now = new Date().toISOString();
    try {
      const res = await axios.get(service.healthUrl, {
        timeout: CONFIG.HEALTH_CHECK_TIMEOUT_MS,
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const check: VerificationCheck = {
          check: 'HTTP /health Probe',
          status: 'PASSED',
          detail: `Endpoint returned HTTP 200 OK`,
          timestamp: now,
          targetServiceId: service.id,
        };
        return { recovered: true, detail: 'Health check returned HTTP 200', checks: [check] };
      }
      const check: VerificationCheck = {
        check: 'HTTP /health Probe',
        status: 'FAILED',
        detail: `Endpoint returned HTTP ${res.status}`,
        timestamp: now,
        targetServiceId: service.id,
      };
      return { recovered: false, detail: `Health check returned HTTP ${res.status}`, checks: [check] };
    } catch (err: any) {
      const check: VerificationCheck = {
        check: 'HTTP /health Probe',
        status: 'FAILED',
        detail: err.message,
        timestamp: now,
        targetServiceId: service.id,
      };
      return { recovered: false, detail: `Connection error: ${err.message}`, checks: [check] };
    }
  }
}

export const verifierService = new VerifierService();
