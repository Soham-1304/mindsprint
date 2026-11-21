import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CONFIG } from '../config/index.js';
import type {
  AuditLogEntry,
  GitHubInstallation,
  Incident,
  LinkedProject,
  ProjectCapabilities,
} from '../types/index.js';
import type { SietchPrScanResult } from '../sietch/types.js';

function resolveDbPath(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return ':memory:';
  }
  const dbPath = CONFIG.SQLITE_DB_PATH;
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  return dbPath;
}

function sanitizeIncidentForStorage(incident: Incident): Incident {
  // Never persist raw customer PII logs in SQLite; only platform metadata & Purge Receipts.
  return {
    ...incident,
    evidence: {
      ...incident.evidence,
      recentLogs: [],
    },
  };
}

export class SqliteStore {
  private db: DatabaseSync;

  constructor(dbPath: string = resolveDbPath()) {
    this.db = new DatabaseSync(dbPath);
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS github_installations (
        installation_id INTEGER PRIMARY KEY,
        account_login TEXT NOT NULL,
        account_type TEXT NOT NULL,
        repository_selection TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        full_name TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL,
        installation_id INTEGER,
        deployed_url TEXT,
        health_endpoint TEXT,
        metrics_endpoint TEXT,
        telemetry_endpoint TEXT,
        prometheus_url TEXT,
        capabilities_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        rule_triggered TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        fix_pr_url TEXT,
        fix_pr_number INTEGER,
        fault_started_at TEXT NOT NULL,
        alarm_raised_at TEXT NOT NULL,
        resolved_at TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_alarm_raised
        ON incidents(alarm_raised_at DESC);

      CREATE TABLE IF NOT EXISTS sietch_scans (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        repo TEXT NOT NULL,
        branch TEXT NOT NULL,
        pr_number INTEGER,
        commit_sha TEXT,
        verdict_kind TEXT NOT NULL,
        blocked INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sietch_scans_created
        ON sietch_scans(created_at DESC);

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        tier TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        outcome TEXT NOT NULL,
        incident_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
        ON audit_log(timestamp DESC);
    `);
  }

  // ── GitHub Installations ────────────────────────────────────────────────────

  public saveInstallation(inst: GitHubInstallation): void {
    const stmt = this.db.prepare(`
      INSERT INTO github_installations (
        installation_id, account_login, account_type, repository_selection, created_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(installation_id) DO UPDATE SET
        account_login = excluded.account_login,
        account_type = excluded.account_type,
        repository_selection = excluded.repository_selection
    `);
    stmt.run(
      inst.installationId,
      inst.accountLogin,
      inst.accountType,
      inst.repositorySelection,
      inst.createdAt
    );
  }

  public getInstallations(): GitHubInstallation[] {
    const rows = this.db
      .prepare(
        `SELECT installation_id, account_login, account_type, repository_selection, created_at
         FROM github_installations
         ORDER BY created_at DESC`
      )
      .all() as Array<{
      installation_id: number;
      account_login: string;
      account_type: string;
      repository_selection: 'all' | 'selected';
      created_at: string;
    }>;

    return rows.map((r) => ({
      installationId: r.installation_id,
      accountLogin: r.account_login,
      accountType: r.account_type,
      repositorySelection: r.repository_selection,
      createdAt: r.created_at,
    }));
  }

  public getInstallationById(id: number): GitHubInstallation | undefined {
    const row = this.db
      .prepare(
        `SELECT installation_id, account_login, account_type, repository_selection, created_at
         FROM github_installations
         WHERE installation_id = ?`
      )
      .get(id) as
      | {
          installation_id: number;
          account_login: string;
          account_type: string;
          repository_selection: 'all' | 'selected';
          created_at: string;
        }
      | undefined;

    if (!row) return undefined;
    return {
      installationId: row.installation_id,
      accountLogin: row.account_login,
      accountType: row.account_type,
      repositorySelection: row.repository_selection,
      createdAt: row.created_at,
    };
  }

  // ── Projects ────────────────────────────────────────────────────────────────

  public saveProject(project: LinkedProject): void {
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, repo_owner, repo_name, full_name, default_branch,
        installation_id, deployed_url, health_endpoint, metrics_endpoint,
        telemetry_endpoint, prometheus_url, capabilities_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        repo_owner = excluded.repo_owner,
        repo_name = excluded.repo_name,
        full_name = excluded.full_name,
        default_branch = excluded.default_branch,
        installation_id = excluded.installation_id,
        deployed_url = excluded.deployed_url,
        health_endpoint = excluded.health_endpoint,
        metrics_endpoint = excluded.metrics_endpoint,
        telemetry_endpoint = excluded.telemetry_endpoint,
        prometheus_url = excluded.prometheus_url,
        capabilities_json = excluded.capabilities_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      project.id,
      project.name,
      project.repoOwner,
      project.repoName,
      project.fullName,
      project.defaultBranch,
      project.installationId ?? null,
      project.deployedUrl ?? null,
      project.healthEndpoint ?? null,
      project.metricsEndpoint ?? null,
      project.telemetryEndpoint ?? null,
      project.prometheusUrl ?? null,
      JSON.stringify(project.capabilities),
      project.createdAt,
      project.updatedAt
    );
  }

  private mapProjectRow(row: Record<string, any>): LinkedProject {
    return {
      id: row.id,
      name: row.name,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      fullName: row.full_name,
      defaultBranch: row.default_branch,
      ...(row.installation_id != null ? { installationId: row.installation_id } : {}),
      ...(row.deployed_url != null ? { deployedUrl: row.deployed_url } : {}),
      ...(row.health_endpoint != null ? { healthEndpoint: row.health_endpoint } : {}),
      ...(row.metrics_endpoint != null ? { metricsEndpoint: row.metrics_endpoint } : {}),
      ...(row.telemetry_endpoint != null ? { telemetryEndpoint: row.telemetry_endpoint } : {}),
      ...(row.prometheus_url != null ? { prometheusUrl: row.prometheus_url } : {}),
      capabilities: JSON.parse(row.capabilities_json) as ProjectCapabilities,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public getProjects(): LinkedProject[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY created_at ASC')
      .all() as Array<Record<string, any>>;
    return rows.map((r) => this.mapProjectRow(r));
  }

  public getProjectById(id: string): LinkedProject | undefined {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as Record<string, any> | undefined;
    return row ? this.mapProjectRow(row) : undefined;
  }

  public getProjectByRepo(fullName: string): LinkedProject | undefined {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE lower(full_name) = lower(?)')
      .get(fullName) as Record<string, any> | undefined;
    return row ? this.mapProjectRow(row) : undefined;
  }

  public deleteProject(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  // ── Incidents ───────────────────────────────────────────────────────────────

  public saveIncident(incident: Incident): void {
    const sanitized = sanitizeIncidentForStorage(incident);
    const stmt = this.db.prepare(`
      INSERT INTO incidents (
        id, project_id, service_id, title, rule_triggered, category,
        status, severity, fix_pr_url, fix_pr_number,
        fault_started_at, alarm_raised_at, resolved_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        service_id = excluded.service_id,
        title = excluded.title,
        rule_triggered = excluded.rule_triggered,
        category = excluded.category,
        status = excluded.status,
        severity = excluded.severity,
        fix_pr_url = excluded.fix_pr_url,
        fix_pr_number = excluded.fix_pr_number,
        fault_started_at = excluded.fault_started_at,
        alarm_raised_at = excluded.alarm_raised_at,
        resolved_at = excluded.resolved_at,
        payload_json = excluded.payload_json
    `);

    stmt.run(
      sanitized.id,
      sanitized.projectId ?? null,
      sanitized.serviceId,
      sanitized.title,
      sanitized.ruleTriggered,
      sanitized.category,
      sanitized.status,
      sanitized.severity,
      sanitized.fixPrUrl ?? null,
      sanitized.fixPrNumber ?? null,
      sanitized.timestamps.faultStartedAt,
      sanitized.timestamps.alarmRaisedAt,
      sanitized.timestamps.resolvedAt ?? null,
      JSON.stringify(sanitized)
    );
  }

  public getIncidents(): Incident[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM incidents ORDER BY alarm_raised_at DESC')
      .all() as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as Incident);
  }

  public getIncidentById(id: string): Incident | undefined {
    const row = this.db
      .prepare('SELECT payload_json FROM incidents WHERE id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as Incident) : undefined;
  }

  // ── Sietch Scans ────────────────────────────────────────────────────────────

  public saveSietchScan(scan: SietchPrScanResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO sietch_scans (
        id, created_at, repo, branch, pr_number, commit_sha, verdict_kind, blocked, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        verdict_kind = excluded.verdict_kind,
        blocked = excluded.blocked,
        payload_json = excluded.payload_json
    `);

    stmt.run(
      scan.id,
      scan.createdAt,
      scan.repo,
      scan.branch,
      scan.prNumber ?? null,
      scan.commitSha ?? null,
      scan.verdictKind,
      scan.blocked ? 1 : 0,
      JSON.stringify(scan)
    );
  }

  public getSietchScans(limit = 50): SietchPrScanResult[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM sietch_scans ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Array<{ payload_json: string }>;
    return rows.map((r) => JSON.parse(r.payload_json) as SietchPrScanResult);
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────

  public saveAuditEntry(entry: AuditLogEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (
        id, timestamp, actor, tier, action, target, outcome, incident_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        outcome = excluded.outcome
    `);

    stmt.run(
      entry.id,
      entry.timestamp,
      entry.actor,
      entry.tier,
      entry.action,
      entry.target,
      entry.outcome,
      entry.incidentId ?? null
    );
  }

  public getAuditEntries(limit = 100): AuditLogEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, timestamp, actor, tier, action, target, outcome, incident_id
         FROM audit_log
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      id: string;
      timestamp: string;
      actor: string;
      tier: 'AUTO' | 'ASK_FIRST' | 'NEVER';
      action: string;
      target: string;
      outcome: 'EXECUTED' | 'APPROVED' | 'REJECTED' | 'BLOCKED_POLICY';
      incident_id: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actor: r.actor,
      tier: r.tier,
      action: r.action,
      target: r.target,
      outcome: r.outcome,
      ...(r.incident_id != null ? { incidentId: r.incident_id } : {}),
    }));
  }

  public close(): void {
    this.db.close();
  }
}

export const sqliteStore = new SqliteStore();
