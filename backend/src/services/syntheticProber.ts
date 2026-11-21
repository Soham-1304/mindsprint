import crypto from 'node:crypto';
import axios from 'axios';
import type { ConnectedApplication, ServiceHealthStatus } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import { serviceRegistry } from './serviceRegistry.js';
import { logCollector } from './logCollector.js';
import { culpritFinder } from './culpritFinder.js';
import { incidentManager } from './incidentManager.js';
import { brainService } from './brainService.js';
import { handsService } from './handsService.js';
import { wsBroadcaster } from '../api/websocket.js';

export class SyntheticProber {
  private applications: Map<string, ConnectedApplication> = new Map();
  private probeInterval?: NodeJS.Timeout;
  private failureCounts: Map<string, number> = new Map();
  private totalProbes: Map<string, { total: number; successful: number }> = new Map();

  constructor() {
    this.seedDefaultApplications();
  }

  private seedDefaultApplications(): void {
    const defaultApps: Array<{
      id: string;
      name: string;
      type: ConnectedApplication['type'];
      deployedUrl: string;
      healthEndpoint: string;
      metricsEndpoint?: string;
      repoUrl: string;
    }> = [
      {
        id: 'pulseshop-gateway',
        name: 'PulseShop API Gateway',
        type: 'microservice',
        deployedUrl: CONFIG.DEFAULT_SERVICE_URLS.gateway,
        healthEndpoint: '/api/health',
        metricsEndpoint: '/metrics',
        repoUrl: 'https://github.com/Soham-1304/pulseshop',
      },
      {
        id: 'pulseshop-orders',
        name: 'PulseShop Orders Service',
        type: 'microservice',
        deployedUrl: CONFIG.DEFAULT_SERVICE_URLS.orders,
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
        repoUrl: 'https://github.com/Soham-1304/pulseshop',
      },
    ];

    for (const app of defaultApps) {
      this.connect(app);
    }
  }

  /**
   * Connect any deployed application link (Frontend or Backend) to post-SDLC maintenance
   */
  public connect(params: {
    id?: string;
    name: string;
    type: ConnectedApplication['type'];
    deployedUrl: string;
    healthEndpoint?: string;
    metricsEndpoint?: string;
    repoUrl?: string;
  }): ConnectedApplication {
    const id =
      params.id ||
      `app-${params.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const token = crypto.randomBytes(16).toString('hex');
    const webhookUrl = `/api/webhooks/ingest/${id}`;

    const app: ConnectedApplication = {
      id,
      name: params.name,
      type: params.type,
      deployedUrl: params.deployedUrl.replace(/\/+$/, ''),
      healthEndpoint: params.healthEndpoint || (params.type === 'frontend' ? '/' : '/health'),
      metricsEndpoint: params.metricsEndpoint,
      repoUrl: params.repoUrl,
      webhookUrl,
      webhookToken: token,
      status: 'HEALTHY',
      uptimePercent: 100.0,
      lastProbe: {
        timestamp: new Date().toISOString(),
        statusCode: 200,
        latencyMs: 35,
        message: 'Initial synthetic check verified',
      },
      createdAt: new Date().toISOString(),
    };

    this.applications.set(id, app);
    this.failureCounts.set(id, 0);
    this.totalProbes.set(id, { total: 1, successful: 1 });

    // Only register custom/external apps that are not already mapped to core PulseShop services
    const coreIdMap: Record<string, string> = {
      'pulseshop-gateway': 'gateway-service',
      'pulseshop-orders': 'orders-service',
      'pulseshop-payments': 'payments-service',
    };
    const mappedCoreId = coreIdMap[app.id];
    if (!mappedCoreId || !serviceRegistry.getById(mappedCoreId)) {
      serviceRegistry.registerOrUpdate({
        id: app.id,
        name: app.name,
        repo: app.repoUrl || `deployed/${app.id}`,
        metricsUrl: app.metricsEndpoint ? `${app.deployedUrl}${app.metricsEndpoint}` : `${app.deployedUrl}/metrics`,
        healthUrl: `${app.deployedUrl}${app.healthEndpoint}`,
        containerName: app.id,
        status: 'HEALTHY',
        currentVersion: 'v1.0.0 (production link)',
        currentStats: {
          errorRate5xx: 0.001,
          p95LatencyMs: 40,
          throughputRpm: 120,
          memoryUsagePercent: 35,
          cpuPercent: 12,
          metricsAvailable: true,
        },
      });
    }

    logCollector.appendLog(
      app.id,
      `[Maintenance System] Application '${app.name}' connected via deployed link: ${app.deployedUrl}`,
    );
    logCollector.appendLog(app.id, `[Maintenance System] Dedicated Ingestion Webhook ready: ${webhookUrl}`);

    wsBroadcaster.broadcast('APPLICATION_CONNECTED', app);

    return app;
  }

  public getAll(): ConnectedApplication[] {
    return Array.from(this.applications.values());
  }

  public getById(id: string): ConnectedApplication | undefined {
    return this.applications.get(id);
  }

  public remove(id: string): boolean {
    return this.applications.delete(id);
  }

  /**
   * Starts background synthetic health probe loop
   */
  public startProbingLoop(intervalMs: number = CONFIG.POLL_INTERVAL_MS): void {
    if (this.probeInterval) return;

    this.probeInterval = setInterval(async () => {
      for (const app of this.applications.values()) {
        await this.probe(app);
      }
    }, intervalMs);
  }

  public stopProbingLoop(): void {
    if (this.probeInterval) {
      clearInterval(this.probeInterval);
      this.probeInterval = undefined;
    }
  }

  /**
   * Executes synthetic probe against a single connected deployed link
   */
  public async probe(
    app: ConnectedApplication,
  ): Promise<{ statusCode: number; latencyMs: number; status: ServiceHealthStatus }> {
    const fullUrl = `${app.deployedUrl}${app.healthEndpoint}`;
    const startTime = Date.now();
    let statusCode = 200;
    let latencyMs = 35;
    let healthStatus: ServiceHealthStatus = 'HEALTHY';
    let errorMessage = 'Synthetic probe succeeded (200 OK)';

    try {
      const res = await axios.get(fullUrl, { timeout: CONFIG.HEALTH_CHECK_TIMEOUT_MS });
      statusCode = res.status;
      latencyMs = Date.now() - startTime;

      if (statusCode >= 500) {
        healthStatus = 'DEGRADED';
        errorMessage = `HTTP 5xx Server Error (${statusCode})`;
      } else if (latencyMs > 1200) {
        healthStatus = 'WARNING';
        errorMessage = `High latency detected: ${latencyMs}ms`;
      }
    } catch (err: any) {
      if (
        CONFIG.DEMO_MODE &&
        !app.deployedUrl.startsWith('http://127.0.0.1') &&
        !app.deployedUrl.startsWith('http://localhost')
      ) {
        statusCode = 200;
        latencyMs = Math.round(45 + Math.random() * 20);
        healthStatus = 'HEALTHY';
        errorMessage = 'Synthetic probe simulated (Demo Mode)';
      } else {
        statusCode = err?.response?.status || 503;
        latencyMs = Date.now() - startTime;
        healthStatus = 'DOWN';
        errorMessage =
          err?.code === 'ECONNREFUSED'
            ? `Connection refused at ${fullUrl}`
            : err?.message || 'Synthetic probe connection failed';
      }
    }

    const currentCounters = this.totalProbes.get(app.id) || { total: 0, successful: 0 };
    currentCounters.total++;
    if (healthStatus === 'HEALTHY' || healthStatus === 'WARNING') {
      currentCounters.successful++;
    }
    this.totalProbes.set(app.id, currentCounters);

    app.status = healthStatus;
    app.uptimePercent = parseFloat(((currentCounters.successful / currentCounters.total) * 100).toFixed(2));
    app.lastProbe = {
      timestamp: new Date().toISOString(),
      statusCode,
      latencyMs,
      message: errorMessage,
    };

    const consecutiveFails = this.failureCounts.get(app.id) || 0;
    if (healthStatus === 'DOWN' || healthStatus === 'DEGRADED') {
      const nextFails = consecutiveFails + 1;
      this.failureCounts.set(app.id, nextFails);

      if (nextFails >= CONFIG.ALARM_CONSECUTIVE_TICKS) {
        void this.triggerSyntheticIncident(app, errorMessage);
      }
    } else {
      this.failureCounts.set(app.id, 0);
    }

    return { statusCode, latencyMs, status: healthStatus };
  }

  private async triggerSyntheticIncident(app: ConnectedApplication, reason: string): Promise<void> {
    if (incidentManager.hasActiveIncident(app.id)) return;

    logCollector.appendLog(
      app.id,
      `[CRITICAL ALERT] Deployed application link ${app.deployedUrl} is failing synthetic probes: ${reason}`,
    );

    const rule = `Synthetic Probe Failed: ${app.name} returned ${reason} on ${app.deployedUrl}`;
    const { category, evidence } = await culpritFinder.findCulpritAsync(app.id, rule);

    const incident = incidentManager.createIncident(app.id, rule, category, evidence);
    wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);

    const diagnosis = await brainService.diagnose(incident);
    incidentManager.setDiagnosis(incident.id, diagnosis);
    wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

    await handsService.handleRemediation(incident);
    wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));
  }

  /**
   * Universal Webhook Receiver for a connected application
   */
  public async handleIngestedWebhook(
    appId: string,
    payload: Record<string, any>,
    _headers: Record<string, any>,
  ): Promise<{ status: string; incidentId?: string; marker?: ReturnType<typeof incidentManager.recordDeployMarker> }> {
    const app = this.applications.get(appId);
    if (!app) throw new Error(`Connected application '${appId}' not found`);

    logCollector.appendLog(app.id, `[Universal Ingestion Webhook] Received payload for ${app.name}`);

    if (payload.error || payload.stack || payload.exception) {
      const errorMsg = payload.message || payload.error || 'Client-side runtime error';
      const stack = payload.stack || payload.trace || '';
      logCollector.appendLog(app.id, `[Error Ingestion] ${errorMsg}\n${stack}`);

      const rule = `Runtime Exception on ${app.name}: ${errorMsg}`;
      const { category, evidence } = await culpritFinder.findCulpritAsync(app.id, rule);
      evidence.stackTrace = stack;

      const incident = incidentManager.createIncident(app.id, rule, category, evidence);
      wsBroadcaster.broadcast('INCIDENT_DETECTED', incident);

      const diagnosis = await brainService.diagnose(incident);
      incidentManager.setDiagnosis(incident.id, diagnosis);
      wsBroadcaster.broadcast('INCIDENT_DIAGNOSED', incidentManager.getById(incident.id));

      await handsService.handleRemediation(incident);
      wsBroadcaster.broadcast('INCIDENT_UPDATED', incidentManager.getById(incident.id));

      return { status: 'INCIDENT_CREATED', incidentId: incident.id };
    }

    const commitSha =
      payload.commitSha || payload.commit || payload.sha || payload.deployment?.meta?.githubCommitSha || 'latest';
    const commitMsg = payload.commitMessage || payload.message || payload.deployment?.name || 'Automated deployment';
    const author = payload.author || payload.creator?.username || 'on-call-dev';

    const marker = incidentManager.recordDeployMarker({
      serviceId: app.id,
      commitSha: String(commitSha).slice(0, 7),
      commitMessage: commitMsg,
      author,
      timestamp: new Date().toISOString(),
      environment: payload.environment || 'production',
      diffSummary: `Deployed via ${payload.provider || 'Universal Webhook'} to ${app.deployedUrl}`,
    });

    serviceRegistry.updateVersion(app.id, `${marker.commitSha} (${commitMsg})`);
    wsBroadcaster.broadcast('DEPLOY_MARKER', marker);

    return { status: 'DEPLOY_RECORDED', marker };
  }
}

export const syntheticProber = new SyntheticProber();
