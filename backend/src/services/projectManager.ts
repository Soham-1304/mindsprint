import crypto from 'node:crypto';
import { CONFIG } from '../config/index.js';
import { sqliteStore } from '../db/sqliteStore.js';
import { githubAppAuth } from '../github-app/auth.js';
import type { LinkedProject, ProjectCapabilities } from '../types/index.js';

export interface ImportProjectParams {
  repoOwner: string;
  repoName: string;
  defaultBranch?: string;
  installationId?: number;
  deployedUrl?: string;
  healthEndpoint?: string;
  metricsEndpoint?: string;
  telemetryEndpoint?: string;
  prometheusUrl?: string;
}

const PROBE_TIMEOUT_MS = 2500;

function joinUrl(base: string, endpoint: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

function computeCapabilitiesSummary(
  signals: Pick<
    ProjectCapabilities,
    | 'githubApp'
    | 'healthEndpoint'
    | 'prometheusMetrics'
    | 'jsonTelemetry'
    | 'pushLogsActive'
    | 'sietchGate'
  >,
  hasDeployedUrl: boolean
): ProjectCapabilities {
  const booleans = [
    signals.githubApp,
    signals.healthEndpoint,
    signals.prometheusMetrics,
    signals.jsonTelemetry,
    signals.pushLogsActive,
    signals.sietchGate,
  ];
  const activeSignalsCount = booleans.filter(Boolean).length;
  const totalSignalsCount = 6;
  const accuracyLevel: ProjectCapabilities['accuracyLevel'] =
    activeSignalsCount >= 5 ? 'HIGH' : activeSignalsCount >= 3 ? 'MEDIUM' : 'LOW';

  const warnings: string[] = [];
  if (!signals.githubApp) {
    warnings.push(
      'GitHub App or token not connected — install the Patch-Up GitHub App so it can read commit diffs and open Fix PRs.'
    );
  }
  if (!hasDeployedUrl) {
    warnings.push(
      'No deployedUrl configured — live /api/health, /metrics, and /api/telemetry probes are disabled.'
    );
  } else {
    if (!signals.healthEndpoint) {
      warnings.push(
        'Health endpoint (/api/health or /health) did not return HTTP 200 — uptime checks will rely on Push Webhooks.'
      );
    }
    if (!signals.prometheusMetrics) {
      warnings.push(
        'Prometheus /metrics endpoint not detected — link /metrics or configure Push Webhook for full latency & error-rate fidelity.'
      );
    }
    if (!signals.jsonTelemetry) {
      warnings.push(
        'JSON telemetry endpoint (/api/telemetry) not detected — structured service stats will use fallback signals.'
      );
    }
  }
  if (!signals.pushLogsActive) {
    warnings.push(
      'No Push Webhook logs received yet — send error/incident bundles to /api/ingest/logs for instant Zero-Retention RCA.'
    );
  }

  return {
    ...signals,
    activeSignalsCount,
    totalSignalsCount,
    accuracyLevel,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

export class ProjectManager {
  constructor() {
    this.seedDefaultProject();
  }

  private seedDefaultProject(): void {
    const existing = sqliteStore.getProjects();
    if (existing.length > 0) return;

    const now = new Date().toISOString();
    const owner = CONFIG.GITHUB_OWNER || 'Soham-1304';
    const repo = CONFIG.GITHUB_REPO || 'pulseshop';
    const deployedUrl = CONFIG.DEFAULT_SERVICE_URLS.gateway;
    const hasGithub =
      githubAppAuth.isConfigured() ||
      Boolean(CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_TOKEN.trim().length > 0);

    const capabilities = computeCapabilitiesSummary(
      {
        githubApp: hasGithub,
        healthEndpoint: false,
        prometheusMetrics: false,
        jsonTelemetry: false,
        pushLogsActive: false,
        sietchGate: true,
      },
      Boolean(deployedUrl)
    );

    const defaultProject: LinkedProject = {
      id: 'pulseshop',
      name: repo.toLowerCase() === 'pulseshop' ? 'PulseShop' : repo,
      repoOwner: owner,
      repoName: repo,
      fullName: `${owner}/${repo}`,
      defaultBranch: 'main',
      deployedUrl,
      healthEndpoint: '/api/health',
      metricsEndpoint: '/metrics',
      telemetryEndpoint: '/api/telemetry',
      capabilities,
      createdAt: now,
      updatedAt: now,
    };

    sqliteStore.saveProject(defaultProject);
  }

  public listProjects(): LinkedProject[] {
    return sqliteStore.getProjects();
  }

  public getProject(id: string): LinkedProject | undefined {
    return sqliteStore.getProjectById(id);
  }

  public getProjectByRepo(fullName: string): LinkedProject | undefined {
    return sqliteStore.getProjectByRepo(fullName);
  }

  public async importProject(params: ImportProjectParams): Promise<LinkedProject> {
    const fullName = `${params.repoOwner}/${params.repoName}`;
    const existing = sqliteStore.getProjectByRepo(fullName);
    const now = new Date().toISOString();

    const slug = params.repoName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'project';
    const id = existing?.id || `${slug}-${crypto.randomUUID().slice(0, 6)}`;

    const hasGithub =
      params.installationId != null ||
      githubAppAuth.isConfigured() ||
      Boolean(CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_TOKEN.trim().length > 0);

    const initialCaps =
      existing?.capabilities ??
      computeCapabilitiesSummary(
        {
          githubApp: hasGithub,
          healthEndpoint: false,
          prometheusMetrics: false,
          jsonTelemetry: false,
          pushLogsActive: false,
          sietchGate: true,
        },
        Boolean(params.deployedUrl)
      );

    const project: LinkedProject = {
      id,
      name: params.repoName,
      repoOwner: params.repoOwner,
      repoName: params.repoName,
      fullName,
      defaultBranch: params.defaultBranch || existing?.defaultBranch || 'main',
      ...(params.installationId != null
        ? { installationId: params.installationId }
        : existing?.installationId != null
          ? { installationId: existing.installationId }
          : {}),
      ...(params.deployedUrl !== undefined
        ? { deployedUrl: params.deployedUrl }
        : existing?.deployedUrl !== undefined
          ? { deployedUrl: existing.deployedUrl }
          : {}),
      healthEndpoint: params.healthEndpoint || existing?.healthEndpoint || '/api/health',
      metricsEndpoint: params.metricsEndpoint || existing?.metricsEndpoint || '/metrics',
      telemetryEndpoint: params.telemetryEndpoint || existing?.telemetryEndpoint || '/api/telemetry',
      ...(params.prometheusUrl !== undefined
        ? { prometheusUrl: params.prometheusUrl }
        : existing?.prometheusUrl !== undefined
          ? { prometheusUrl: existing.prometheusUrl }
          : {}),
      capabilities: initialCaps,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    sqliteStore.saveProject(project);
    const discovered = await this.discoverCapabilities(project.id);
    return {
      ...project,
      capabilities: discovered,
      updatedAt: new Date().toISOString(),
    };
  }

  public markPushLogsActive(projectIdOrRepo: string): void {
    const project =
      sqliteStore.getProjectById(projectIdOrRepo) ||
      sqliteStore.getProjectByRepo(projectIdOrRepo);
    if (!project) return;

    const updatedCaps = computeCapabilitiesSummary(
      {
        ...project.capabilities,
        pushLogsActive: true,
        sietchGate: true,
      },
      Boolean(project.deployedUrl)
    );

    sqliteStore.saveProject({
      ...project,
      capabilities: updatedCaps,
      updatedAt: new Date().toISOString(),
    });
  }

  private async probeHttpOk(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  private async probePrometheus(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) return false;
      const text = await res.text();
      return text.includes('# HELP') || text.includes('# TYPE');
    } catch {
      return false;
    }
  }

  private async probeJsonTelemetry(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (res.status !== 200) return false;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        await res.json();
        return true;
      }
      const text = await res.text();
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  public async discoverCapabilities(projectId: string): Promise<ProjectCapabilities> {
    const project = sqliteStore.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const githubApp =
      project.installationId != null ||
      githubAppAuth.isConfigured() ||
      Boolean(CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_TOKEN.trim().length > 0);

    let healthEndpoint = false;
    let prometheusMetrics = false;
    let jsonTelemetry = false;

    const deployedUrl = project.deployedUrl?.trim();
    if (deployedUrl) {
      const primaryHealthUrl = joinUrl(deployedUrl, project.healthEndpoint || '/api/health');
      const fallbackHealthUrl = joinUrl(deployedUrl, '/health');
      const metricsTargetUrl =
        project.prometheusUrl?.trim() ||
        joinUrl(deployedUrl, project.metricsEndpoint || '/metrics');
      const telemetryTargetUrl = joinUrl(
        deployedUrl,
        project.telemetryEndpoint || '/api/telemetry'
      );

      const [healthPrimaryOk, promOk, telemetryOk] = await Promise.all([
        this.probeHttpOk(primaryHealthUrl),
        this.probePrometheus(metricsTargetUrl),
        this.probeJsonTelemetry(telemetryTargetUrl),
      ]);

      healthEndpoint = healthPrimaryOk;
      if (!healthEndpoint && primaryHealthUrl !== fallbackHealthUrl) {
        healthEndpoint = await this.probeHttpOk(fallbackHealthUrl);
      }
      prometheusMetrics = promOk;
      jsonTelemetry = telemetryOk;
    } else if (project.prometheusUrl?.trim()) {
      prometheusMetrics = await this.probePrometheus(project.prometheusUrl.trim());
    }

    const capabilities = computeCapabilitiesSummary(
      {
        githubApp,
        healthEndpoint,
        prometheusMetrics,
        jsonTelemetry,
        pushLogsActive: Boolean(project.capabilities?.pushLogsActive),
        sietchGate: true,
      },
      Boolean(deployedUrl)
    );

    sqliteStore.saveProject({
      ...project,
      capabilities,
      updatedAt: new Date().toISOString(),
    });

    return capabilities;
  }
}

export const projectManager = new ProjectManager();
