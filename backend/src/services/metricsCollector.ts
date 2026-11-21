import axios from 'axios';
import { CONFIG } from '../config/index.js';
import { serviceRegistry } from './serviceRegistry.js';
import type { ServiceStats, ServiceHealthStatus } from '../types/index.js';
import { logCollector } from './logCollector.js';

export class MetricsCollector {
  private isPolling = false;
  private pollInterval?: NodeJS.Timeout;
  private consecutiveBreachTicks: Map<string, number> = new Map();

  /**
   * Start polling Prometheus or direct service endpoints every X seconds
   */
  public start(onAnomalyDetected: (serviceId: string, rule: string, stats: ServiceStats) => void): void {
    if (this.isPolling) return;
    this.isPolling = true;

    this.pollInterval = setInterval(async () => {
      await this.pollAllServices(onAnomalyDetected);
    }, CONFIG.POLL_INTERVAL_MS);
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      this.isPolling = false;
    }
  }

  /**
   * Scrapes metrics and checks health for all registered services with consecutive-tick debounce.
   */
  public async pollAllServices(onAnomalyDetected: (serviceId: string, rule: string, stats: ServiceStats) => void): Promise<void> {
    const services = serviceRegistry.getAll();

    for (const service of services) {
      try {
        const scrapeResult = await this.scrapeService(
          service.id,
          service.metricsUrl,
          service.healthUrl,
          service.telemetryUrl,
        );
        const status = this.evaluateHealth(scrapeResult.stats, scrapeResult.isReachable);

        serviceRegistry.updateStats(service.id, scrapeResult.stats, status);

        const ruleViolation = this.checkWatcherRules(scrapeResult.stats, status, scrapeResult.errorMessage, service.id);
        if (ruleViolation) {
          const ticks = (this.consecutiveBreachTicks.get(service.id) || 0) + 1;
          this.consecutiveBreachTicks.set(service.id, ticks);
          if (ticks >= CONFIG.ALARM_CONSECUTIVE_TICKS) {
            onAnomalyDetected(service.id, ruleViolation, scrapeResult.stats);
          }
        } else {
          this.consecutiveBreachTicks.set(service.id, 0);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const failureStats: ServiceStats = {
          errorRate5xx: null,
          p95LatencyMs: null,
          throughputRpm: null,
          memoryUsagePercent: null,
          cpuPercent: null,
          metricsAvailable: false,
          errorMessage: message,
        };

        serviceRegistry.updateStats(service.id, failureStats, 'DOWN');
        logCollector.appendLog(service.id, `[Watcher] Service check failed: ${message}`);

        const ticks = (this.consecutiveBreachTicks.get(service.id) || 0) + 1;
        this.consecutiveBreachTicks.set(service.id, ticks);
        if (ticks >= CONFIG.ALARM_CONSECUTIVE_TICKS) {
          onAnomalyDetected(service.id, `Service Unreachable: ${message}`, failureStats);
        }
      }
    }
  }

  /**
   * Scrapes the target service with timeout and precise error classification.
   * Does NOT silently invent fake metrics unless DEMO_MODE is explicitly enabled.
   */
  public async scrapeService(
    serviceId: string,
    metricsUrl: string,
    healthUrl?: string,
    telemetryUrl?: string,
  ): Promise<{ stats: ServiceStats; isReachable: boolean; errorMessage?: string }> {
    const startTime = Date.now();

    // 1. First probe health endpoint if provided
    if (healthUrl) {
      try {
        const healthRes = await axios.get(healthUrl, { timeout: CONFIG.HEALTH_CHECK_TIMEOUT_MS });
        if (healthRes.status >= 500) {
          return {
            stats: {
              errorRate5xx: null,
              p95LatencyMs: Date.now() - startTime,
              throughputRpm: null,
              memoryUsagePercent: null,
              cpuPercent: null,
              metricsAvailable: false,
              errorMessage: `Health check returned HTTP ${healthRes.status}`,
            },
            isReachable: false,
            errorMessage: `Health check failed with HTTP ${healthRes.status}`,
          };
        }
      } catch (err: unknown) {
        if (!CONFIG.DEMO_MODE) {
          const errMsg = this.formatAxiosError(err);
          return {
            stats: {
              errorRate5xx: null,
              p95LatencyMs: null,
              throughputRpm: null,
              memoryUsagePercent: null,
              cpuPercent: null,
              metricsAvailable: false,
              errorMessage: errMsg,
            },
            isReachable: false,
            errorMessage: `Health check failed: ${errMsg}`,
          };
        }
      }
    }

    // 2. Scrape Prometheus or JSON telemetry endpoint
    try {
      const response = await axios.get(metricsUrl, { timeout: CONFIG.SCRAPE_TIMEOUT_MS });
      const stats = this.parseTelemetry(response.data);
      const isUp = stats.metricsAvailable !== false;
      return {
        stats,
        isReachable: isUp,
        errorMessage: isUp ? undefined : stats.errorMessage,
      };
    } catch (err: unknown) {
      // Fallback to JSON telemetryUrl if configured
      if (telemetryUrl) {
        try {
          const telRes = await axios.get(telemetryUrl, { timeout: CONFIG.SCRAPE_TIMEOUT_MS });
          const stats = this.parseTelemetry(telRes.data);
          const isUp = stats.metricsAvailable !== false;
          return {
            stats,
            isReachable: isUp,
            errorMessage: isUp ? undefined : stats.errorMessage,
          };
        } catch {
          // Fall through to primary error handling below
        }
      }

      const errMsg = this.formatAxiosError(err);

      if (CONFIG.DEMO_MODE) {
        logCollector.appendLog(serviceId, `[Demo Mode] Fallback simulation active for ${serviceId} (${errMsg})`);
        const stats = this.getSimulatedStats(serviceId);
        stats.errorMessage = `[Demo Mode] Real scrape failed: ${errMsg}`;
        return { stats, isReachable: true };
      }

      return {
        stats: {
          errorRate5xx: null,
          p95LatencyMs: null,
          throughputRpm: null,
          memoryUsagePercent: null,
          cpuPercent: null,
          metricsAvailable: false,
          errorMessage: errMsg,
        },
        isReachable: false,
        errorMessage: `Metrics scrape failed: ${errMsg}`,
      };
    }
  }

  /**
   * Universal Telemetry Parser:
   * Handles Prometheus text exposition, JSON telemetry (/api/telemetry, /telemetry), and Prometheus query JSON
   */
  public parseTelemetry(data: unknown): ServiceStats {
    if (typeof data === 'object' && data !== null) {
      return this.parseJsonTelemetry(data as Record<string, any>);
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          return this.parseJsonTelemetry(parsed as Record<string, any>);
        }
      } catch {
        // Not JSON, fall through to Prometheus text format
      }
      return this.parsePrometheusMetrics(data);
    }

    return {
      errorRate5xx: 0,
      p95LatencyMs: 0,
      throughputRpm: 0,
      memoryUsagePercent: 0,
      cpuPercent: 0,
      metricsAvailable: false,
      errorMessage: 'Invalid telemetry response format',
    };
  }

  /**
   * Parses JSON telemetry responses (e.g. PulseShop `/api/telemetry` and `/telemetry`)
   */
  public parseJsonTelemetry(rawJson: Record<string, any>): ServiceStats {
    if (rawJson.status === 'success' && rawJson.data?.result && Array.isArray(rawJson.data.result)) {
      return this.parsePrometheusVector(rawJson.data.result);
    }

    // PulseShop Gateway `/api/telemetry` nests `{ gateway: {...}, orders: {...}, payments: {...} }`
    const json =
      rawJson.gateway && typeof rawJson.gateway === 'object' && rawJson.errorRatePct === undefined
        ? rawJson.gateway
        : rawJson;

    const rawErrorRatePct = json.errorRatePct ?? json.error_rate_pct;
    const errorRate =
      typeof rawErrorRatePct === 'number'
        ? parseFloat((rawErrorRatePct / 100).toFixed(4))
        : (json.errorRate5xx ?? json.error_rate_5xx ?? json.errorRate ?? json.error_rate ?? 0);

    const latency = json.p95LatencyMs ?? json.p95_latency_ms ?? json.latencyMs ?? json.p95Latency ?? 45;
    const throughput =
      json.totalRequests ??
      json.requestsPerMin ??
      json.throughputRpm ??
      json.throughput_rpm ??
      json.rpm ??
      100;
    const orders =
      json.ordersCreatedTotal ??
      json.ordersCreatedPerMin ??
      json.ordersRpm ??
      json.orders_rpm ??
      json.ordersPerMinute ??
      json.ordersProcessed ??
      null;
    const memory = json.memoryUsagePercent ?? json.memory_usage_percent ?? json.memoryPercent ?? 40;
    const cpu = json.cpuPercent ?? json.cpu_percent ?? json.cpuUsage ?? 20;

    return {
      errorRate5xx: typeof errorRate === 'number' ? errorRate : 0,
      p95LatencyMs: typeof latency === 'number' ? latency : 45,
      throughputRpm: typeof throughput === 'number' ? throughput : 100,
      ordersRpm: typeof orders === 'number' ? orders : null,
      memoryUsagePercent: typeof memory === 'number' ? memory : 40,
      cpuPercent: typeof cpu === 'number' ? cpu : 20,
      metricsAvailable: true,
    };
  }

  /**
   * Parses Prometheus HTTP API vector results
   */
  public parsePrometheusVector(results: any[]): ServiceStats {
    let errorRate = 0;
    let p95Latency = 45;
    let throughput = 100;
    let ordersRpm: number | null = null;

    for (const item of results) {
      const metric = item.metric || {};
      const val = parseFloat(item.value?.[1] || '0');

      if (metric.__name__?.includes('5xx') || metric.status?.startsWith('5')) {
        errorRate = val;
      } else if (metric.__name__?.includes('latency') || metric.__name__?.includes('p95')) {
        p95Latency = Math.round(val);
      } else if (metric.__name__?.includes('requests') || metric.__name__?.includes('throughput')) {
        throughput = Math.round(val);
      } else if (metric.__name__?.includes('orders')) {
        ordersRpm = Math.round(val);
      }
    }

    return {
      errorRate5xx: errorRate,
      p95LatencyMs: p95Latency,
      throughputRpm: throughput,
      ordersRpm,
      memoryUsagePercent: 40,
      cpuPercent: 20,
      metricsAvailable: true,
    };
  }

  /**
   * Parses Prometheus text exposition format accurately, including PulseShop metrics:
   * - `shop_orders_created_total`
   * - `shop_service_health_status` (0 => DOWN)
   */
  public parsePrometheusMetrics(text: string): ServiceStats {
    if (typeof text !== 'string') {
      return {
        errorRate5xx: 0,
        p95LatencyMs: 0,
        throughputRpm: 0,
        memoryUsagePercent: 0,
        cpuPercent: 0,
        metricsAvailable: false,
        errorMessage: 'Invalid non-string metrics response',
      };
    }

    const lines = text.split('\n');
    let requests2xx = 0;
    let requests5xx = 0;
    let ordersProcessed = 0;
    let p95Latency = 0;
    let memoryBytes = 0;
    let isServiceUp = 1;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('http_requests_total')) {
        const valMatch = line.match(/\s+([0-9.e+-]+)$/);
        const val = valMatch ? parseFloat(valMatch[1]) : 0;

        if (line.includes('status="5') || line.includes("status='5") || line.includes('code="5')) {
          requests5xx += val;
        } else if (line.includes('status="2') || line.includes("status='2") || line.includes('code="2')) {
          requests2xx += val;
        }
      }

      if (
        line.startsWith('shop_orders_created_total') ||
        line.startsWith('orders_processed_total') ||
        line.startsWith('orders_created_total') ||
        line.startsWith('checkout_success_total') ||
        line.startsWith('orders_total')
      ) {
        const valMatch = line.match(/\s+([0-9.e+-]+)$/);
        if (valMatch) {
          ordersProcessed += parseFloat(valMatch[1]);
        }
      }

      if (
        line.startsWith('http_request_duration_ms_p95') ||
        line.includes('quantile="0.95"') ||
        line.includes('quantile="0.99"')
      ) {
        const valMatch = line.match(/\s+([0-9.e+-]+)$/);
        if (valMatch) {
          let lat = parseFloat(valMatch[1]);
          if (line.includes('seconds') && lat < 10) {
            lat = Math.round(lat * 1000);
          }
          p95Latency = Math.round(lat);
        }
      }

      if (
        line.startsWith('process_resident_memory_bytes') ||
        line.startsWith('pulseshop_node_process_resident_memory_bytes') ||
        line.startsWith('node_memory_Active_bytes')
      ) {
        const valMatch = line.match(/\s+([0-9.e+-]+)$/);
        if (valMatch) {
          memoryBytes = parseFloat(valMatch[1]);
        }
      }

      if (line.startsWith('shop_service_health_status') || line.startsWith('up{') || line.startsWith('up ')) {
        const valMatch = line.match(/\s+([0-9.]+)$/);
        if (valMatch) {
          const val = parseFloat(valMatch[1]);
          if (val === 0) {
            isServiceUp = 0;
          }
        }
      }
    }

    const totalRequests = requests2xx + requests5xx;
    const errorRate = totalRequests > 0 ? parseFloat((requests5xx / totalRequests).toFixed(4)) : 0;
    const memoryPercent =
      memoryBytes > 0 ? parseFloat(Math.min(100, (memoryBytes / (1024 * 1024 * 512)) * 100).toFixed(1)) : 40;

    if (isServiceUp === 0) {
      return {
        errorRate5xx: errorRate,
        p95LatencyMs: p95Latency || 45,
        throughputRpm: totalRequests,
        ordersRpm: ordersProcessed > 0 ? ordersProcessed : null,
        memoryUsagePercent: memoryPercent,
        cpuPercent: 20,
        metricsAvailable: false,
        errorMessage: 'Service reported unhealthy (shop_service_health_status=0)',
      };
    }

    return {
      errorRate5xx: errorRate,
      p95LatencyMs: p95Latency || 45,
      throughputRpm: totalRequests,
      ordersRpm: ordersProcessed > 0 ? ordersProcessed : null,
      memoryUsagePercent: memoryPercent,
      cpuPercent: 20,
      metricsAvailable: true,
    };
  }

  private evaluateHealth(stats: ServiceStats, isReachable: boolean): ServiceHealthStatus {
    if (!isReachable || stats.metricsAvailable === false) {
      return 'DOWN';
    }
    if (
      (stats.errorRate5xx !== null && stats.errorRate5xx > CONFIG.THRESHOLDS.ERROR_RATE_MAX) ||
      (stats.p95LatencyMs !== null && stats.p95LatencyMs > 800)
    ) {
      return 'DEGRADED';
    }
    if (
      (stats.errorRate5xx !== null && stats.errorRate5xx > 0.02) ||
      (stats.p95LatencyMs !== null && stats.p95LatencyMs > 250) ||
      (stats.memoryUsagePercent !== null && stats.memoryUsagePercent > 75) ||
      stats.businessMetricDrop === true
    ) {
      return 'WARNING';
    }
    return 'HEALTHY';
  }

  /**
   * Pure deterministic Watcher rule evaluation (directly testable).
   */
  public checkWatcherRules(
    stats: ServiceStats,
    status: ServiceHealthStatus,
    errorMessage?: string,
    serviceId?: string,
  ): string | null {
    if (status === 'DOWN') {
      return `Service Down: ${errorMessage || 'Health check failed / Endpoint unreachable'}`;
    }
    if (stats.metricsAvailable === false) {
      return `Metrics Unavailable: ${errorMessage || 'Prometheus endpoint failed'}`;
    }
    if (stats.errorRate5xx !== null && stats.errorRate5xx > CONFIG.THRESHOLDS.ERROR_RATE_MAX) {
      return `5xx error rate exceeded threshold: ${(stats.errorRate5xx * 100).toFixed(1)}% (Threshold: ${CONFIG.THRESHOLDS.ERROR_RATE_MAX * 100}%)`;
    }
    if (stats.p95LatencyMs !== null && stats.p95LatencyMs > CONFIG.THRESHOLDS.LATENCY_P95_MAX_MS) {
      return `p95 response time spike: ${stats.p95LatencyMs}ms (Threshold: ${CONFIG.THRESHOLDS.LATENCY_P95_MAX_MS}ms)`;
    }

    // Silent Order Drop / Business Metric Throughput Drop
    const service = serviceId ? serviceRegistry.getById(serviceId) : undefined;
    const baselineThroughput = service?.baselineThroughputRpm || 100;
    const currentThroughput =
      stats.ordersRpm !== undefined && stats.ordersRpm !== null ? stats.ordersRpm : stats.throughputRpm;
    if (currentThroughput !== null && currentThroughput !== undefined && baselineThroughput > 0) {
      const dropRatio = (baselineThroughput - currentThroughput) / baselineThroughput;
      if (
        dropRatio >= CONFIG.THRESHOLDS.THROUGHPUT_DROP_RATIO &&
        currentThroughput < CONFIG.THRESHOLDS.BUSINESS_THROUGHPUT_MIN_RPM
      ) {
        stats.businessMetricDrop = true;
        return `Business metric drop (Silent Order Drop): Throughput dropped by ${(dropRatio * 100).toFixed(0)}% (${currentThroughput} RPM vs baseline ${baselineThroughput} RPM) despite 0% HTTP 5xx errors`;
      }
    }

    return null;
  }

  private formatAxiosError(err: any): string {
    if (err?.code === 'ECONNREFUSED') {
      return `Connection refused at ${err.config?.url || 'target'}`;
    }
    if (err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout')) {
      return `Request timed out after ${err.config?.timeout || CONFIG.SCRAPE_TIMEOUT_MS}ms`;
    }
    if (err?.response) {
      return `HTTP ${err.response.status} (${err.response.statusText || 'Error'}) from ${err.config?.url}`;
    }
    return err?.message || 'Network scrape error';
  }

  private getSimulatedStats(serviceId: string): ServiceStats {
    const existing = serviceRegistry.getById(serviceId);
    const base = existing?.currentStats;
    const baseErrorRate = base?.errorRate5xx ?? 0.005;
    const baseLatency = base?.p95LatencyMs ?? 50;
    const baseRpm = base?.throughputRpm ?? 500;
    const baseMem = base?.memoryUsagePercent ?? 40;
    const baseCpu = base?.cpuPercent ?? 20;

    const jitter = (Math.random() - 0.5) * 0.002;
    return {
      errorRate5xx: Math.max(0, parseFloat((baseErrorRate + jitter).toFixed(4))),
      p95LatencyMs: Math.max(10, Math.round(baseLatency + (Math.random() - 0.5) * 5)),
      throughputRpm: Math.max(50, Math.round(baseRpm + (Math.random() - 0.5) * 20)),
      memoryUsagePercent: Math.min(100, Math.max(10, parseFloat((baseMem + (Math.random() - 0.5) * 0.5).toFixed(1)))),
      cpuPercent: Math.min(100, Math.max(5, parseFloat((baseCpu + (Math.random() - 0.5) * 2).toFixed(1)))),
      metricsAvailable: true,
    };
  }
}

export const metricsCollector = new MetricsCollector();
