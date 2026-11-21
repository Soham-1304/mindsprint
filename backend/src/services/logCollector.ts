import axios from 'axios';
import type { TopFrame } from '../types/index.js';
import { serviceRegistry } from './serviceRegistry.js';

interface PulseShopLogEntry {
  timestamp?: string;
  level?: string;
  service?: string;
  version?: string;
  commit?: string;
  message?: string;
  errorName?: string;
  stack?: string;
  topFrame?: TopFrame | null;
}

export class LogCollector {
  private logBuffers: Map<string, string[]> = new Map();

  constructor() {
    this.seedDefaultLogs();
  }

  private seedDefaultLogs(): void {
    this.logBuffers.set('gateway-service', [
      `[${new Date(Date.now() - 60000).toISOString()}] INFO [gateway] Routing GET /api/products -> orders-service (status=200, 18ms)`,
      `[${new Date(Date.now() - 45000).toISOString()}] INFO [gateway] Routing POST /api/orders -> orders-service (status=201, 45ms)`,
      `[${new Date(Date.now() - 30000).toISOString()}] INFO [gateway] Healthcheck OK - /api/health 200`,
      `[${new Date(Date.now() - 15000).toISOString()}] INFO [gateway] Routing GET /api/orders -> orders-service (status=200, 32ms)`,
    ]);

    this.logBuffers.set('orders-service', [
      `[${new Date(Date.now() - 60000).toISOString()}] INFO [orders] MongoDB/In-memory store healthy`,
      `[${new Date(Date.now() - 40000).toISOString()}] INFO [orders] Order #ORD-1042 created successfully. Total: $49.99`,
      `[${new Date(Date.now() - 20000).toISOString()}] INFO [orders] Health check /health 200 OK`,
    ]);

    this.logBuffers.set('payments-service', [
      `[${new Date(Date.now() - 60000).toISOString()}] INFO [payments] Payment authorized for tx_88412`,
      `[${new Date(Date.now() - 40000).toISOString()}] INFO [payments] Charge captured: $49.99`,
      `[${new Date(Date.now() - 20000).toISOString()}] INFO [payments] Health check /health 200 OK`,
    ]);
  }

  public getRecentLogs(serviceId: string, limit: number = 30): string[] {
    const logs = this.logBuffers.get(serviceId) || [];
    return logs.slice(-limit);
  }

  public appendLog(serviceId: string, logLine: string): void {
    const logs = this.logBuffers.get(serviceId) || [];
    logs.push(`[${new Date().toISOString()}] ${logLine}`);
    if (logs.length > 200) {
      logs.shift();
    }
    this.logBuffers.set(serviceId, logs);
  }

  /**
   * Fetches live structured JSON error logs from PulseShop's `/logs?level=error` (or `/api/logs?level=error`)
   * with a 2500ms timeout, extracting `topFrame: { function, file, line, column }` when present.
   */
  public async fetchLiveErrorLogs(serviceId: string): Promise<{ logs: string[]; topFrame?: TopFrame }> {
    const service = serviceRegistry.getById(serviceId);
    if (!service?.logsUrl) {
      return { logs: this.getRecentLogs(serviceId, 20) };
    }

    const separator = service.logsUrl.includes('?') ? '&' : '?';
    const url = `${service.logsUrl}${separator}level=error`;

    try {
      const response = await axios.get<{ logs?: PulseShopLogEntry[] } | PulseShopLogEntry[]>(url, {
        timeout: 2500,
      });
      const rawEntries: PulseShopLogEntry[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.logs)
          ? response.data.logs
          : [];

      let topFrame: TopFrame | undefined;
      const formattedLogs: string[] = [];

      for (const entry of rawEntries) {
        if (!topFrame && entry.topFrame && entry.topFrame.file && typeof entry.topFrame.line === 'number') {
          topFrame = {
            function: entry.topFrame.function || 'anonymous',
            file: entry.topFrame.file,
            line: entry.topFrame.line,
            column: entry.topFrame.column,
            error: entry.message || entry.errorName,
          };
        }

        const ts = entry.timestamp || new Date().toISOString();
        const lvl = (entry.level || 'error').toUpperCase();
        const svc = entry.service || serviceId;
        const msg = entry.message || 'Unknown error';
        const line = `[${ts}] ${lvl} [${svc}] ${entry.errorName ? `${entry.errorName}: ` : ''}${msg}${entry.stack ? `\n${entry.stack}` : ''}`;
        formattedLogs.push(line);
      }

      if (formattedLogs.length > 0) {
        return { logs: formattedLogs, topFrame };
      }

      return { logs: this.getRecentLogs(serviceId, 20), topFrame };
    } catch {
      return { logs: this.getRecentLogs(serviceId, 20) };
    }
  }

  public injectFaultLogs(
    serviceId: string,
    scenario: 'bug_checkout' | 'slow_query' | 'killed_service' | 'bad_package' | 'memory_leak',
  ): string {
    let errorStackTrace = '';

    if (scenario === 'bug_checkout') {
      errorStackTrace = `TypeError: Cannot read properties of undefined (reading 'percentage')
    at calculatePromoDiscount (services/orders/src/routes/orders.js:51:28)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)`;

      this.appendLog(serviceId, `ERROR [orders] Uncaught Exception in POST /orders: ${errorStackTrace}`);
      this.appendLog(serviceId, `ERROR [orders] 500 Internal Server Error returned to client`);
    } else if (scenario === 'slow_query') {
      errorStackTrace = `MongooseError: Operation \`orders.find()\` buffering timed out after 4280ms. Missing index causing sequential scan under load.
    at listOrders (services/orders/src/routes/orders.js:52:14)`;

      this.appendLog(serviceId, `WARN [orders] DB Query duration exceeded threshold: 4280ms > 200ms`);
      this.appendLog(serviceId, `ERROR [orders] ${errorStackTrace}`);
    } else if (scenario === 'killed_service') {
      errorStackTrace = `ContainerExitError: container pulseshop-orders exited with code 137 (SIGKILL / OOM Killed by kernel).
Docker daemon event: "die" container=pulseshop-orders exitCode=137`;

      this.appendLog(serviceId, `FATAL [docker] ${errorStackTrace}`);
      this.appendLog(serviceId, `ERROR [gateway] Upstream connection refused: http://pulseshop-orders/health`);
    } else if (scenario === 'memory_leak') {
      errorStackTrace = `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
1: 0xb09c30 node::Abort() [/usr/local/bin/node]
2: 0xa1b205 node::FatalError(char const*, char const*) [/usr/local/bin/node]`;

      this.appendLog(serviceId, `WARN [orders] Heap used 492MB / 512MB limit (96.1%)`);
      this.appendLog(serviceId, `ERROR [orders] ${errorStackTrace}`);
    } else if (scenario === 'bad_package') {
      errorStackTrace = `[SIETCH SECURITY SHIELD] Malicious npm package execution detected in 'currency-format-lite@1.0.1':
- Attempted read: ~/.npmrc [INTERCEPTED]
- Attempted read: ~/.aws/credentials [INTERCEPTED]
- Socket connection: http://evil-exfil.invalid:80 [DENIED - Sandbox Network Disabled]`;

      this.appendLog(serviceId, errorStackTrace);
    }

    return errorStackTrace;
  }
}

export const logCollector = new LogCollector();
