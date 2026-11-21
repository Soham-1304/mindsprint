import type { MonitoredService, ServiceHealthStatus, ServiceStats } from '../types/index.js';
import { CONFIG } from '../config/index.js';

class ServiceRegistry {
  private services: Map<string, MonitoredService> = new Map();

  constructor() {
    this.seedDefaultServices();
  }

  public seedDefaultServices(): void {
    this.services.clear();

    // Check if custom services are provided via environment JSON
    if (CONFIG.MONITORED_SERVICES) {
      try {
        const custom = JSON.parse(CONFIG.MONITORED_SERVICES);
        if (Array.isArray(custom)) {
          for (const s of custom) {
            this.register({
              id: s.id,
              name: s.name || s.id,
              repo: s.repo || `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`,
              metricsUrl: s.metricsUrl || `${s.url}/metrics`,
              telemetryUrl: s.telemetryUrl || (s.url ? `${s.url}/telemetry` : undefined),
              logsUrl: s.logsUrl || (s.url ? `${s.url}/logs` : undefined),
              healthUrl: s.healthUrl || `${s.url}/health`,
              containerName: s.containerName || s.id,
              grafanaUrl: s.grafanaUrl,
              dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
              baselineThroughputRpm: s.baselineThroughputRpm,
              status: 'HEALTHY',
              currentVersion: s.version || 'v1.0.0',
              currentStats: {
                errorRate5xx: 0,
                p95LatencyMs: 0,
                throughputRpm: 0,
                memoryUsagePercent: 0,
                cpuPercent: 0,
                metricsAvailable: true,
              },
            });
          }
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[ServiceRegistry] Failed to parse MONITORED_SERVICES env: ${message}. Using default PulseShop URLs.`);
      }
    }

    // Default live PulseShop microservices on Vercel
    const defaultServices: MonitoredService[] = [
      {
        id: 'gateway-service',
        name: 'PulseShop API Gateway',
        repo: 'Soham-1304/pulseshop',
        metricsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.gateway}/metrics`,
        telemetryUrl: `${CONFIG.DEFAULT_SERVICE_URLS.gateway}/api/telemetry`,
        logsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.gateway}/api/logs`,
        grafanaUrl: `${CONFIG.GRAFANA_URL}/d/gateway/api-gateway-dashboard`,
        healthUrl: `${CONFIG.DEFAULT_SERVICE_URLS.gateway}/api/health`,
        containerName: 'pulseshop-gateway',
        dependencies: ['orders-service', 'payments-service'],
        baselineThroughputRpm: 120,
        status: 'HEALTHY',
        lastCheck: new Date().toISOString(),
        currentVersion: 'v1.4.2 (sha: a9f831b)',
        currentStats: {
          errorRate5xx: 0.002,
          p95LatencyMs: 42,
          throughputRpm: 120,
          memoryUsagePercent: 38,
          cpuPercent: 16,
          metricsAvailable: true,
        },
        history: [],
      },
      {
        id: 'orders-service',
        name: 'PulseShop Orders Service',
        repo: 'Soham-1304/pulseshop',
        metricsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.orders}/metrics`,
        telemetryUrl: `${CONFIG.DEFAULT_SERVICE_URLS.orders}/telemetry`,
        logsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.orders}/logs`,
        grafanaUrl: `${CONFIG.GRAFANA_URL}/d/orders/orders-service-dashboard`,
        healthUrl: `${CONFIG.DEFAULT_SERVICE_URLS.orders}/health`,
        containerName: 'pulseshop-orders',
        dependencies: ['payments-service'],
        baselineThroughputRpm: 100,
        status: 'HEALTHY',
        lastCheck: new Date().toISOString(),
        currentVersion: 'v2.1.0 (sha: b5de597)',
        currentStats: {
          errorRate5xx: 0.004,
          p95LatencyMs: 78,
          throughputRpm: 100,
          memoryUsagePercent: 48,
          cpuPercent: 22,
          metricsAvailable: true,
        },
        history: [],
      },
      {
        id: 'payments-service',
        name: 'PulseShop Payments Service',
        repo: 'Soham-1304/pulseshop',
        metricsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.payments}/metrics`,
        telemetryUrl: `${CONFIG.DEFAULT_SERVICE_URLS.payments}/telemetry`,
        logsUrl: `${CONFIG.DEFAULT_SERVICE_URLS.payments}/logs`,
        grafanaUrl: `${CONFIG.GRAFANA_URL}/d/payments/payments-dashboard`,
        healthUrl: `${CONFIG.DEFAULT_SERVICE_URLS.payments}/health`,
        containerName: 'pulseshop-payments',
        dependencies: [],
        baselineThroughputRpm: 80,
        status: 'HEALTHY',
        lastCheck: new Date().toISOString(),
        currentVersion: 'v1.1.8 (sha: c7810aa)',
        currentStats: {
          errorRate5xx: 0.001,
          p95LatencyMs: 95,
          throughputRpm: 80,
          memoryUsagePercent: 35,
          cpuPercent: 12,
          metricsAvailable: true,
        },
        history: [],
      },
    ];

    for (const service of defaultServices) {
      this.services.set(service.id, service);
    }
  }

  public getAll(): MonitoredService[] {
    return Array.from(this.services.values());
  }

  public getById(id: string): MonitoredService | undefined {
    return this.services.get(id);
  }

  /**
   * Returns all services that the given service calls directly (downstream dependencies)
   */
  public getDependencies(serviceId: string): MonitoredService[] {
    const service = this.services.get(serviceId);
    if (!service || !service.dependencies) return [];
    return service.dependencies
      .map((depId) => this.services.get(depId))
      .filter((s): s is MonitoredService => Boolean(s));
  }

  /**
   * Returns all services that call the given service (upstream callers / dependents)
   */
  public getDependents(serviceId: string): MonitoredService[] {
    const callers: MonitoredService[] = [];
    for (const service of this.services.values()) {
      if (service.dependencies && service.dependencies.includes(serviceId)) {
        callers.push(service);
      }
    }
    return callers;
  }

  /**
   * Returns complete topology neighborhood (direct dependencies and direct dependents)
   */
  public getTopology(serviceId: string): { dependencies: string[]; dependents: string[] } {
    const dependencies = this.getDependencies(serviceId).map((s) => s.id);
    const dependents = this.getDependents(serviceId).map((s) => s.id);
    return { dependencies, dependents };
  }

  /**
   * Detects cascading failure patterns across upstream and downstream services.
   */
  public detectCascadingFailure(serviceId: string): {
    isCascading: boolean;
    upstreamSpikes: string[];
    downstreamBottleneck?: string;
    details: string;
  } {
    const service = this.services.get(serviceId);
    if (!service) {
      return { isCascading: false, upstreamSpikes: [], details: 'Service not found in registry' };
    }

    const dependents = this.getDependents(serviceId);
    const dependencies = this.getDependencies(serviceId);
    const upstreamSpikes: string[] = [];
    let downstreamBottleneck: string | undefined;

    for (const caller of dependents) {
      const stats = caller.currentStats;
      const hasHighErrors = stats.errorRate5xx !== null && stats.errorRate5xx > 0.05;
      const hasHighLatency = stats.p95LatencyMs !== null && stats.p95LatencyMs > 300;
      if (hasHighErrors || hasHighLatency || caller.status === 'DEGRADED' || caller.status === 'WARNING') {
        upstreamSpikes.push(caller.id);
      }
    }

    for (const dep of dependencies) {
      const stats = dep.currentStats;
      const isSlow = stats.p95LatencyMs !== null && stats.p95LatencyMs > 400;
      const isFailing = stats.errorRate5xx !== null && stats.errorRate5xx > 0.1;
      if (isSlow || isFailing || dep.status === 'DOWN' || dep.status === 'DEGRADED') {
        downstreamBottleneck = dep.id;
        break;
      }
    }

    const currentStats = service.currentStats;
    const isCurrentChoked = currentStats.p95LatencyMs !== null && currentStats.p95LatencyMs > 300;
    const isCurrentFailing = currentStats.errorRate5xx !== null && currentStats.errorRate5xx > 0.05;

    const isCascading =
      (upstreamSpikes.length > 0 && (isCurrentChoked || isCurrentFailing)) ||
      (downstreamBottleneck !== undefined && (isCurrentChoked || isCurrentFailing));

    let details = 'No cascading failure detected. Incident is isolated.';
    if (isCascading) {
      if (downstreamBottleneck) {
        details = `Cascading failure detected: Downstream bottleneck at '${downstreamBottleneck}' is propagating latency and 5xx to '${serviceId}'. Upstream callers: [${upstreamSpikes.join(', ')}]`;
      } else {
        details = `Cascading retry/latency propagation: '${serviceId}' degradation is causing failures in upstream callers [${upstreamSpikes.join(', ')}]`;
      }
    }

    return {
      isCascading,
      upstreamSpikes,
      downstreamBottleneck,
      details,
    };
  }

  public register(service: Omit<MonitoredService, 'lastCheck' | 'history'>): MonitoredService {
    const newService: MonitoredService = {
      ...service,
      lastCheck: new Date().toISOString(),
      history: [],
    };
    this.services.set(newService.id, newService);
    return newService;
  }

  public registerOrUpdate(service: Omit<MonitoredService, 'lastCheck' | 'history'>): MonitoredService {
    const existing = this.services.get(service.id);
    if (existing) {
      existing.name = service.name;
      existing.metricsUrl = service.metricsUrl;
      existing.healthUrl = service.healthUrl;
      existing.repo = service.repo;
      existing.containerName = service.containerName;
      if (service.telemetryUrl) existing.telemetryUrl = service.telemetryUrl;
      if (service.logsUrl) existing.logsUrl = service.logsUrl;
      if (service.dependencies) existing.dependencies = service.dependencies;
      if (service.status) existing.status = service.status;
      if (service.baselineThroughputRpm !== undefined) existing.baselineThroughputRpm = service.baselineThroughputRpm;
      if (service.grafanaUrl) existing.grafanaUrl = service.grafanaUrl;
      return existing;
    }
    return this.register(service);
  }

  public updateStats(id: string, stats: ServiceStats, status: ServiceHealthStatus): MonitoredService | undefined {
    const service = this.services.get(id);
    if (!service) return undefined;

    stats.preCrashWarning = this.detectPreCrashTrend(service, stats);

    service.currentStats = stats;
    service.status = status;
    service.lastCheck = new Date().toISOString();

    service.history.push({
      timestamp: service.lastCheck,
      stats: { ...stats },
      status,
    });
    if (service.history.length > 60) {
      service.history.shift();
    }

    return service;
  }

  public updateVersion(id: string, version: string): void {
    const service = this.services.get(id);
    if (service) {
      service.currentVersion = version;
    }
  }

  public clearAll(): void {
    this.services.clear();
  }

  private detectPreCrashTrend(service: MonitoredService, newStats: ServiceStats): string | undefined {
    if (newStats.memoryUsagePercent !== null && service.history.length >= 6) {
      const recent = service.history.slice(-6);
      const firstMem = recent[0].stats.memoryUsagePercent;
      if (firstMem !== null) {
        const memDelta = newStats.memoryUsagePercent - firstMem;

        if (newStats.memoryUsagePercent > 80) {
          return `CRITICAL: Memory at ${Math.round(newStats.memoryUsagePercent)}%. Fatal OOM Crash imminent within ~3 minutes!`;
        }
        if (memDelta > 15 && newStats.memoryUsagePercent > 65) {
          return `PRE-CRASH WARNING: Rapid memory growth (+${Math.round(memDelta)}% in 30s). Potential memory leak in ${service.name}.`;
        }
      }
    }

    if (
      newStats.p95LatencyMs !== null &&
      newStats.errorRate5xx !== null &&
      newStats.p95LatencyMs > 600 &&
      newStats.errorRate5xx > 0.03
    ) {
      return `PRE-CRASH WARNING: High p95 latency (${newStats.p95LatencyMs}ms) & creeping 5xx errors. Thread pool exhaustion risk.`;
    }

    return undefined;
  }
}

export const serviceRegistry = new ServiceRegistry();
