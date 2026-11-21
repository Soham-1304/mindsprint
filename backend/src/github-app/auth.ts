import crypto from 'node:crypto';
import { CONFIG } from '../config/index.js';
import { sqliteStore } from '../db/sqliteStore.js';
import type { GitHubInstallation } from '../types/index.js';

export interface AccessibleRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  installationId?: number;
}

export interface RepoTokenResult {
  token: string | null;
  source: 'github-app' | 'pat' | 'none';
  installationId?: number;
}

interface CachedInstallationToken {
  token: string;
  expiresAtMs: number;
}

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes (GitHub tokens expire in 60m)

export class GitHubAppAuth {
  private tokenCache = new Map<number, CachedInstallationToken>();

  public isConfigured(): boolean {
    return Boolean(
      CONFIG.GITHUB_APP_ID &&
        CONFIG.GITHUB_APP_ID.trim().length > 0 &&
        CONFIG.GITHUB_APP_PRIVATE_KEY &&
        CONFIG.GITHUB_APP_PRIVATE_KEY.trim().length > 0
    );
  }

  public getInstallUrl(state?: string): string {
    const base = `https://github.com/apps/${CONFIG.GITHUB_APP_SLUG}/installations/new`;
    return state ? `${base}?state=${encodeURIComponent(state)}` : base;
  }

  public createAppJwt(): string {
    if (!this.isConfigured()) {
      throw new Error('GitHub App is not configured (missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY)');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iat: now - 60,
        exp: now + 540,
        iss: CONFIG.GITHUB_APP_ID.trim(),
      })
    ).toString('base64url');

    const signingInput = `${header}.${payload}`;
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), CONFIG.GITHUB_APP_PRIVATE_KEY)
      .toString('base64url');

    return `${signingInput}.${signature}`;
  }

  private githubHeaders(bearerToken: string): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${bearerToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Patch-Up-Sietch-SRE/1.0',
    };
  }

  public async getInstallationToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.token;
    }

    const jwt = this.createAppJwt();
    const res = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: this.githubHeaders(jwt),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to mint installation token for ${installationId} (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { token: string; expires_at?: string };
    this.tokenCache.set(installationId, {
      token: data.token,
      expiresAtMs: Date.now() + TOKEN_CACHE_TTL_MS,
    });
    return data.token;
  }

  public async registerInstallation(installationId: number): Promise<GitHubInstallation> {
    let record: GitHubInstallation = {
      installationId,
      accountLogin: CONFIG.GITHUB_OWNER,
      accountType: 'User',
      repositorySelection: 'selected',
      createdAt: new Date().toISOString(),
    };

    if (this.isConfigured()) {
      try {
        const jwt = this.createAppJwt();
        const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
          headers: this.githubHeaders(jwt),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            id: number;
            account?: { login?: string; type?: string };
            repository_selection?: 'all' | 'selected';
            created_at?: string;
          };
          record = {
            installationId: data.id || installationId,
            accountLogin: data.account?.login || CONFIG.GITHUB_OWNER,
            accountType: data.account?.type || 'User',
            repositorySelection: data.repository_selection === 'all' ? 'all' : 'selected',
            createdAt: data.created_at || new Date().toISOString(),
          };
        }
      } catch (err: any) {
        console.warn(
          `[GitHubAppAuth] Could not fetch installation ${installationId} metadata from GitHub:`,
          err?.message || err
        );
      }
    }

    sqliteStore.saveInstallation(record);
    return record;
  }

  public async listAccessibleRepos(installationId?: number): Promise<AccessibleRepo[]> {
    const repos: AccessibleRepo[] = [];
    const seen = new Set<string>();

    const pushRepo = (r: any, instId?: number) => {
      const fullName = r.full_name || `${r.owner?.login || CONFIG.GITHUB_OWNER}/${r.name}`;
      if (seen.has(fullName.toLowerCase())) return;
      seen.add(fullName.toLowerCase());
      repos.push({
        id: Number(r.id || 0),
        owner: r.owner?.login || fullName.split('/')[0] || CONFIG.GITHUB_OWNER,
        name: r.name || fullName.split('/')[1] || CONFIG.GITHUB_REPO,
        fullName,
        defaultBranch: r.default_branch || 'main',
        private: Boolean(r.private),
        htmlUrl: r.html_url || `https://github.com/${fullName}`,
        ...(instId != null ? { installationId: instId } : {}),
      });
    };

    // 1. GitHub App installation(s)
    if (this.isConfigured()) {
      const targetInstallations =
        installationId != null
          ? [installationId]
          : sqliteStore.getInstallations().map((i) => i.installationId);

      for (const instId of targetInstallations) {
        try {
          const token = await this.getInstallationToken(instId);
          const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
            headers: this.githubHeaders(token),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = (await res.json()) as { repositories?: any[] };
            for (const r of data.repositories || []) {
              pushRepo(r, instId);
            }
          }
        } catch (err: any) {
          console.warn(
            `[GitHubAppAuth] Failed listing repos for installation ${instId}:`,
            err?.message || err
          );
        }
      }
    }

    // 2. Fallback to PAT (/user/repos) if configured
    if (repos.length === 0 && CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_TOKEN.trim().length > 0) {
      try {
        const res = await fetch(
          'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
          {
            headers: this.githubHeaders(CONFIG.GITHUB_TOKEN.trim()),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as any[];
          for (const r of data) {
            pushRepo(r);
          }
        }
      } catch (err: any) {
        console.warn('[GitHubAppAuth] Failed listing /user/repos via PAT:', err?.message || err);
      }
    }

    // 3. Graceful offline/unconfigured fallback including Soham-1304/pulseshop
    if (repos.length === 0) {
      const fallbackOwner = CONFIG.GITHUB_OWNER || 'Soham-1304';
      const fallbackRepo = CONFIG.GITHUB_REPO || 'pulseshop';
      repos.push({
        id: 1,
        owner: fallbackOwner,
        name: fallbackRepo,
        fullName: `${fallbackOwner}/${fallbackRepo}`,
        defaultBranch: 'main',
        private: false,
        htmlUrl: `https://github.com/${fallbackOwner}/${fallbackRepo}`,
      });
    }

    return repos;
  }

  public async getTokenForRepo(owner: string, repo: string): Promise<RepoTokenResult> {
    const fullName = `${owner}/${repo}`;
    const project = sqliteStore.getProjectByRepo(fullName);

    let candidateInstallationId = project?.installationId;
    if (candidateInstallationId == null) {
      const installations = sqliteStore.getInstallations();
      if (installations.length > 0) {
        candidateInstallationId = installations[0].installationId;
      }
    }

    if (this.isConfigured() && candidateInstallationId != null) {
      try {
        const token = await this.getInstallationToken(candidateInstallationId);
        return {
          token,
          source: 'github-app',
          installationId: candidateInstallationId,
        };
      } catch (err: any) {
        console.warn(
          `[GitHubAppAuth] Installation token fallback to PAT for ${fullName}:`,
          err?.message || err
        );
      }
    }

    if (CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_TOKEN.trim().length > 0) {
      return {
        token: CONFIG.GITHUB_TOKEN.trim(),
        source: 'pat',
      };
    }

    return {
      token: null,
      source: 'none',
    };
  }
}

export const githubAppAuth = new GitHubAppAuth();
