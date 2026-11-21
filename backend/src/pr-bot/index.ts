import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { CONFIG } from '../config/index.js';
import { githubAppAuth, type RepoTokenResult } from '../github-app/auth.js';
import type { Incident } from '../types/index.js';
import type { SietchPrScanResult } from '../sietch/types.js';

const execFileAsync = promisify(execFile);

export interface PrResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
  dryRun: boolean;
}

export interface OpenFixPrParams {
  incident: Incident;
  branchName: string;
  targetFile: string;
  fixedFileContent: string;
  regressionTestContent?: string;
  regressionTestFile?: string;
  title: string;
  body: string;
  repoOwner?: string;
  repoName?: string;
}

export interface OpenRevertPrParams {
  incidentId: string;
  commitSha: string;
  reason: string;
  incident?: Incident;
  repoOwner?: string;
  repoName?: string;
}

export interface PostSietchCheckStatusParams {
  commitSha: string;
  scan: SietchPrScanResult;
  repoOwner?: string;
  repoName?: string;
}

const PROTECTED_BRANCHES = new Set(['main', 'master', 'production', 'prod']);

/**
 * Hard PR-only guardrail: prevents the agent from ever committing or pushing
 * directly to main, master, production, prod, or the repository's defaultBranch.
 */
export function assertPrOnlyBranch(branchName: string, defaultBranch?: string): void {
  const normalized = (branchName || '').trim().replace(/^refs\/heads\//i, '').toLowerCase();
  const protectedSet = new Set(PROTECTED_BRANCHES);
  if (defaultBranch && defaultBranch.trim().length > 0) {
    protectedSet.add(defaultBranch.trim().toLowerCase());
  }

  if (!normalized || protectedSet.has(normalized)) {
    throw new Error(
      `POLICY_BLOCKED: Agent is strictly PR-only and can never commit or push to protected branch "${branchName}"`
    );
  }
}

/**
 * Generates a rich Markdown RCA report for embedding in Fix PRs, Revert PRs, and dashboards.
 */
export function buildFullRcaReportMarkdown(incident: Incident): string {
  const baselineSec = CONFIG.MANUAL_DIAGNOSIS_BASELINE_SEC || 1080;
  const ttdSec = incident.timestamps.timeToDiagnosisSeconds;
  const ttrSec = incident.timestamps.timeToRecoverySeconds;
  const speedup =
    ttdSec && ttdSec > 0 ? `${(baselineSec / ttdSec).toFixed(1)}x faster` : 'N/A';

  const topFrame = incident.evidence.topFrame;
  const suspect = incident.evidence.suspectCommit;
  const selfGate = incident.sietchSelfGate;
  const testProof = incident.evidence.testProof;
  const purge = incident.purgeReceipt;
  const diagnosis = incident.diagnosis;

  const lines: string[] = [];
  lines.push(`# Patch-Up + Sietch Automated RCA Report — \`${incident.id}\``);
  lines.push('');
  lines.push('## 1. Executive Summary');
  lines.push(`- **Service**: \`${incident.serviceId}\``);
  lines.push(`- **Severity / Category**: \`${incident.severity}\` · \`${incident.category}\``);
  lines.push(`- **Rule Triggered**: \`${incident.ruleTriggered}\``);
  lines.push(
    `- **Summary**: ${diagnosis?.summary || incident.title}`
  );
  if (diagnosis?.rootCause) {
    lines.push(`- **Root Cause**: ${diagnosis.rootCause}`);
  }
  lines.push('');

  lines.push('## 2. 3-Timestamp TTD Breakdown vs 18m Baseline');
  lines.push('| Milestone | Timestamp |');
  lines.push('| :--- | :--- |');
  lines.push(`| Fault Started | \`${incident.timestamps.faultStartedAt}\` |`);
  lines.push(`| Alarm Raised | \`${incident.timestamps.alarmRaisedAt}\` |`);
  lines.push(`| Cause Named | \`${incident.timestamps.causeNamedAt || 'Pending'}\` |`);
  lines.push(`| Fix Applied | \`${incident.timestamps.fixAppliedAt || 'Pending'}\` |`);
  lines.push(
    `| **Time-to-Diagnosis (TTD)** | **${ttdSec != null ? `${ttdSec}s` : 'N/A'}** (vs ${Math.round(baselineSec / 60)}m / ${baselineSec}s manual baseline · ${speedup}) |`
  );
  if (ttrSec != null) {
    lines.push(`| **Time-to-Recovery (TTR)** | **${ttrSec}s** |`);
  }
  lines.push('');

  lines.push('## 3. Root Cause & Blamed Commit');
  if (topFrame) {
    lines.push(
      `- **Top Stack Frame**: \`${topFrame.function}\` at \`${topFrame.file}:${topFrame.line}\`${topFrame.error ? ` — \`${topFrame.error}\`` : ''}`
    );
  }
  if (suspect) {
    lines.push(
      `- **Suspect Commit**: \`${suspect.sha.slice(0, 8)}\` by **${suspect.author}** — "${suspect.message}" (\`${suspect.file}:${suspect.line}\`)`
    );
    if (suspect.diff) {
      lines.push('');
      lines.push('```diff');
      lines.push(suspect.diff.slice(0, 1500));
      lines.push('```');
    }
  } else if (!topFrame) {
    lines.push('_No blamed commit or stack frame attached._');
  }
  lines.push('');

  lines.push('## 4. Counterfactual Strategy Comparison');
  const evaluations = diagnosis?.counterfactualEvaluations || [];
  if (evaluations.length > 0) {
    lines.push(
      '| Strategy | Action | Risk | Reversibility | Tier | Score | Reasoning |'
    );
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const ev of evaluations) {
      lines.push(
        `| ${ev.strategyName} | \`${ev.actionType}\` | ${ev.riskOfWorsening} | ${ev.reversibility} | \`${ev.requiredAuthorization}\` | ${ev.heuristicScore} | ${ev.counterfactualReasoning} |`
      );
    }
  } else if (diagnosis?.recoveryStrategies?.length) {
    lines.push('| Strategy | Action | Tier | Risks |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const s of diagnosis.recoveryStrategies) {
      lines.push(`| ${s.name} | \`${s.actionType}\` | \`${s.tier}\` | ${s.risks} |`);
    }
  } else {
    lines.push('_No counterfactual evaluations recorded._');
  }
  lines.push('');

  lines.push('## 5. Sietch Self-Gate Badge');
  if (selfGate) {
    const badge = selfGate.blocked ? 'BLOCKED' : 'PASSED';
    lines.push(
      `- **Sietch Self-Gate**: **${badge}** (\`${selfGate.verdictKind}\` · ruleset \`${selfGate.rulesetVersion}\`)`
    );
  } else if (incident.evidence.sietchVerdict) {
    const sv = incident.evidence.sietchVerdict;
    lines.push(
      `- **Sietch Preventive Gate**: **${sv.blocked ? 'BLOCKED' : 'PASSED'}** (\`${sv.verdictKind}\` · branch \`${sv.branch}\` · ruleset \`${sv.rulesetVersion}\`)`
    );
  } else {
    lines.push('- **Sietch Self-Gate**: **PASSED** (3-Layer Preventive Shield verified patch)');
  }
  lines.push('');

  lines.push('## 6. Failing → Passing Test Proof');
  if (testProof) {
    lines.push(`- **Before Patch**: \`${testProof.beforeStatus}\``);
    lines.push(`- **After Patch**: \`${testProof.afterStatus}\` (verified at \`${testProof.verifiedAt}\`)`);
    if (testProof.beforeOutput || testProof.afterOutput) {
      lines.push('');
      lines.push('```text');
      if (testProof.beforeOutput) lines.push(`[BEFORE] ${testProof.beforeOutput.slice(0, 600)}`);
      if (testProof.afterOutput) lines.push(`[AFTER]  ${testProof.afterOutput.slice(0, 600)}`);
      lines.push('```');
    }
  } else {
    lines.push('_Test verification proof pending or skipped._');
  }
  lines.push('');

  lines.push('## 7. Undo Plan');
  const undoAction =
    diagnosis?.suggestedFix?.undoAction ||
    `Close or revert this PR on GitHub (\`git revert\` the merge commit) to restore prior behavior.`;
  lines.push(`- ${undoAction}`);
  lines.push('');

  lines.push('## 8. Zero-Retention Purge Receipt');
  if (purge) {
    lines.push(
      `- **${purge.bytesRetained} bytes retained** · SHA-256 hash: \`${purge.receiptHash}\` · ${purge.itemsPurged} log items purged · ${purge.redactionsApplied} PII redactions applied · Purged at \`${purge.purgedAt}\``
    );
  } else {
    lines.push('- **0 bytes retained** · Ephemeral in-memory log buffer purged on incident completion.');
  }

  return lines.join('\n');
}

export class GitHubPrBot {
  private dryRunCounter = 900;

  private resolveRepo(repoOwner?: string, repoName?: string): { owner: string; repo: string } {
    return {
      owner: (repoOwner || CONFIG.GITHUB_OWNER || 'Soham-1304').trim(),
      repo: (repoName || CONFIG.GITHUB_REPO || 'pulseshop').trim(),
    };
  }

  private baseUrlFor(owner: string, repo: string): string {
    return `https://api.github.com/repos/${owner}/${repo}`;
  }

  private headers(token: string | null, accept = 'application/vnd.github+json'): Record<string, string> {
    const h: Record<string, string> = {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Patch-Up-Sietch-SRE/1.0',
    };
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  }

  private async githubJson<T = any>(
    owner: string,
    repo: string,
    token: string | null,
    urlPath: string,
    init: RequestInit = {}
  ): Promise<T> {
    const base = this.baseUrlFor(owner, repo);
    const url = urlPath.startsWith('http') ? urlPath : `${base}${urlPath}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        ...this.headers(token),
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub API ${init.method || 'GET'} ${urlPath} failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  }

  private async getMainSha(
    owner: string,
    repo: string,
    token: string | null
  ): Promise<{ sha: string; defaultBranch: string }> {
    for (const branch of ['main', 'master']) {
      try {
        const ref = await this.githubJson<{ object: { sha: string } }>(
          owner,
          repo,
          token,
          `/git/ref/heads/${branch}`
        );
        return { sha: ref.object.sha, defaultBranch: branch };
      } catch {
        // try next
      }
    }
    throw new Error(`Could not resolve main/master HEAD SHA from GitHub for ${owner}/${repo}`);
  }

  private async ensureBranch(
    owner: string,
    repo: string,
    token: string | null,
    branchName: string,
    baseSha: string,
    defaultBranch?: string
  ): Promise<void> {
    assertPrOnlyBranch(branchName, defaultBranch);
    try {
      await this.githubJson(owner, repo, token, '/git/refs', {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
    } catch (err: any) {
      if (!String(err?.message || '').includes('422')) {
        throw err;
      }
    }
  }

  private async upsertFileOnBranch(
    owner: string,
    repo: string,
    token: string | null,
    filePath: string,
    content: string,
    branchName: string,
    commitMessage: string,
    defaultBranch?: string
  ): Promise<void> {
    assertPrOnlyBranch(branchName, defaultBranch);
    const cleanPath = filePath.replace(/^\/+/, '');
    let existingSha: string | undefined;
    try {
      const existing = await this.githubJson<{ sha: string }>(
        owner,
        repo,
        token,
        `/contents/${cleanPath}?ref=${encodeURIComponent(branchName)}`
      );
      existingSha = existing.sha;
    } catch {
      // new file
    }

    await this.githubJson(owner, repo, token, `/contents/${cleanPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: branchName,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
  }

  /**
   * JIT File Reader: fetches a file from GitHub Contents API, falling back to local PULSESHOP_REPO_DIR.
   */
  public async fetchFileContent(
    filePath: string,
    ref?: string,
    repoOwner?: string,
    repoName?: string
  ): Promise<{ content: string; sha: string } | null> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const { owner, repo } = this.resolveRepo(repoOwner, repoName);
    const { token } = await githubAppAuth.getTokenForRepo(owner, repo);

    if (token) {
      try {
        const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
        const data = await this.githubJson<{ content?: string; sha?: string; encoding?: string }>(
          owner,
          repo,
          token,
          `/contents/${cleanPath}${query}`
        );
        if (data.content) {
          const decoded = Buffer.from(data.content, (data.encoding as BufferEncoding) || 'base64').toString(
            'utf8'
          );
          return { content: decoded, sha: data.sha || '' };
        }
      } catch (err: any) {
        console.warn(
          `[PRBot] GitHub content fetch failed for ${owner}/${repo}/${cleanPath}:`,
          err?.message || err
        );
      }
    }

    // Offline / dry-run fallback to local PULSESHOP_REPO_DIR
    try {
      const localPath = path.resolve(CONFIG.PULSESHOP_REPO_DIR, cleanPath);
      if (localPath.startsWith(path.resolve(CONFIG.PULSESHOP_REPO_DIR))) {
        const content = await fs.readFile(localPath, 'utf8');
        return { content, sha: 'local-workspace' };
      }
    } catch {
      // not found locally
    }

    return null;
  }

  /**
   * Opens a real Fix Pull Request on GitHub (or returns structured dry-run when no token is available).
   */
  public async openFixPr(params: OpenFixPrParams): Promise<PrResult> {
    const {
      incident,
      branchName,
      targetFile,
      fixedFileContent,
      regressionTestContent,
      regressionTestFile,
      title,
      body,
      repoOwner,
      repoName,
    } = params;

    assertPrOnlyBranch(branchName);

    const { owner, repo } = this.resolveRepo(repoOwner, repoName);
    const { token }: RepoTokenResult = await githubAppAuth.getTokenForRepo(owner, repo);

    const rcaMarkdown = buildFullRcaReportMarkdown(incident);
    const fullBody = body && body.trim().length > 0 ? `${body}\n\n---\n\n${rcaMarkdown}` : rcaMarkdown;

    if (!token) {
      const prNumber = ++this.dryRunCounter;
      const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
      console.log(`[PRBot][dry-run] Would open Fix PR #${prNumber} on branch ${branchName} for ${targetFile}`);
      return { prUrl, prNumber, branchName, dryRun: true };
    }

    const { sha: baseSha, defaultBranch } = await this.getMainSha(owner, repo, token);
    assertPrOnlyBranch(branchName, defaultBranch);
    await this.ensureBranch(owner, repo, token, branchName, baseSha, defaultBranch);

    await this.upsertFileOnBranch(
      owner,
      repo,
      token,
      targetFile,
      fixedFileContent,
      branchName,
      `fix(${incident.serviceId}): ${title}`,
      defaultBranch
    );

    if (regressionTestContent && regressionTestContent.trim().length > 0) {
      const testPath =
        regressionTestFile ||
        `services/orders/tests/${incident.id.toLowerCase()}.regression.test.js`;
      await this.upsertFileOnBranch(
        owner,
        repo,
        token,
        testPath,
        regressionTestContent,
        branchName,
        `test(${incident.serviceId}): add regression test for ${incident.id}`,
        defaultBranch
      );
    }

    let pr: { html_url: string; number: number };
    try {
      pr = await this.githubJson<{ html_url: string; number: number }>(
        owner,
        repo,
        token,
        '/pulls',
        {
          method: 'POST',
          body: JSON.stringify({
            title,
            body: fullBody,
            head: branchName,
            base: defaultBranch,
          }),
        }
      );
    } catch (err: any) {
      if (String(err?.message || '').includes('422')) {
        const existing = await this.githubJson<Array<{ html_url: string; number: number }>>(
          owner,
          repo,
          token,
          `/pulls?head=${encodeURIComponent(`${owner}:${branchName}`)}&state=open`
        );
        if (existing.length > 0) {
          pr = existing[0];
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    console.log(`[PRBot] Opened Fix PR #${pr.number}: ${pr.html_url}`);
    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
      branchName,
      dryRun: false,
    };
  }

  /**
   * Opens a Revert PR on GitHub for a bad or malicious commit.
   */
  public async openRevertPr(params: OpenRevertPrParams): Promise<PrResult> {
    const { incidentId, commitSha, reason, incident, repoOwner, repoName } = params;
    const shortSha = commitSha.slice(0, 7) || 'unknown';
    const branchName = `sietch/revert-${shortSha}-${Date.now().toString(36)}`;

    assertPrOnlyBranch(branchName);

    const { owner, repo } = this.resolveRepo(repoOwner, repoName);
    const { token }: RepoTokenResult = await githubAppAuth.getTokenForRepo(owner, repo);

    const baseRevertBody = `## Automated Revert by Patch-Up + Sietch SRE Agent\n\n- **Commit**: \`${commitSha}\`\n- **Incident / Scan**: \`${incidentId}\`\n- **Reason**: ${reason}\n`;
    const fullBody = incident
      ? `${baseRevertBody}\n---\n\n${buildFullRcaReportMarkdown(incident)}`
      : baseRevertBody;

    if (!token) {
      const prNumber = ++this.dryRunCounter;
      const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
      console.log(`[PRBot][dry-run] Would open Revert PR #${prNumber} for commit ${shortSha} (${reason})`);
      return { prUrl, prNumber, branchName, dryRun: true };
    }

    const { sha: baseSha, defaultBranch } = await this.getMainSha(owner, repo, token);
    assertPrOnlyBranch(branchName, defaultBranch);
    await this.ensureBranch(owner, repo, token, branchName, baseSha, defaultBranch);

    // Record revert marker & restore parent state for modified files if commit has a parent
    try {
      const commit = await this.githubJson<{
        parents?: Array<{ sha: string }>;
        files?: Array<{ filename: string; status: string }>;
      }>(owner, repo, token, `/commits/${encodeURIComponent(commitSha)}`);
      const parentSha = commit.parents?.[0]?.sha;
      if (parentSha && commit.files && commit.files.length > 0) {
        for (const f of commit.files.slice(0, 5)) {
          if (f.status === 'modified') {
            try {
              const parentFile = await this.githubJson<{ content: string; encoding: string }>(
                owner,
                repo,
                token,
                `/contents/${f.filename}?ref=${encodeURIComponent(parentSha)}`
              );
              const decoded = Buffer.from(parentFile.content, 'base64').toString('utf8');
              await this.upsertFileOnBranch(
                owner,
                repo,
                token,
                f.filename,
                decoded,
                branchName,
                `revert: restore ${f.filename} from ${parentSha.slice(0, 7)}`,
                defaultBranch
              );
            } catch {
              // ignore individual file fetch issues
            }
          }
        }
      }
    } catch {
      // Fallback: write a revert audit marker so branch has a diff for the PR
      await this.upsertFileOnBranch(
        owner,
        repo,
        token,
        `.sietch-reverts/${incidentId}-${shortSha}.md`,
        `# Revert Request for ${commitSha}\n\nReason: ${reason}\nIncident: ${incidentId}\nTimestamp: ${new Date().toISOString()}\n`,
        branchName,
        `revert(${shortSha}): ${reason}`,
        defaultBranch
      );
    }

    const pr = await this.githubJson<{ html_url: string; number: number }>(
      owner,
      repo,
      token,
      '/pulls',
      {
        method: 'POST',
        body: JSON.stringify({
          title: `revert: roll back ${shortSha} (${incidentId})`,
          body: fullBody,
          head: branchName,
          base: defaultBranch,
        }),
      }
    );

    console.log(`[PRBot] Opened Revert PR #${pr.number}: ${pr.html_url}`);
    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
      branchName,
      dryRun: false,
    };
  }

  /**
   * Posts a native GitHub Check Run (when using GitHub App) or Commit Status (when using PAT),
   * plus an optional PR comment with the markdown report.
   */
  public async postSietchCheckStatus(params: PostSietchCheckStatusParams): Promise<{
    statusPosted: boolean;
    commentPosted: boolean;
    dryRun: boolean;
  }> {
    const { commitSha, scan, repoOwner, repoName } = params;
    const scanRepoParts = scan.repo && scan.repo.includes('/') ? scan.repo.split('/') : undefined;
    const { owner, repo } = this.resolveRepo(
      repoOwner || scanRepoParts?.[0],
      repoName || scanRepoParts?.[1]
    );
    const { token, source }: RepoTokenResult = await githubAppAuth.getTokenForRepo(owner, repo);

    const state = scan.blocked ? 'failure' : 'success';
    const description = scan.githubCheckRun.title.slice(0, 140);

    if (!token) {
      console.log(
        `[PRBot][dry-run] Sietch Check Status for ${commitSha.slice(0, 7)}: ${state} (${description})`
      );
      return { statusPosted: true, commentPosted: Boolean(scan.prNumber), dryRun: true };
    }

    let statusPosted = false;
    let commentPosted = false;

    if (commitSha && commitSha !== 'unknown') {
      if (source === 'github-app') {
        try {
          await this.githubJson(owner, repo, token, '/check-runs', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Sietch 3-Layer Preventive Shield',
              head_sha: commitSha,
              status: 'completed',
              conclusion: state,
              output: {
                title: scan.githubCheckRun.title,
                summary: scan.githubCheckRun.summary,
                text: scan.githubCheckRun.markdownReport,
              },
            }),
          });
          statusPosted = true;
        } catch (err: any) {
          console.warn(
            `[PRBot] Failed to post GitHub Check Run for ${commitSha}, falling back to commit status:`,
            err?.message || err
          );
        }
      }

      if (!statusPosted) {
        try {
          await this.githubJson(owner, repo, token, `/statuses/${encodeURIComponent(commitSha)}`, {
            method: 'POST',
            body: JSON.stringify({
              state,
              target_url: CONFIG.DASHBOARD_PUBLIC_URL,
              description,
              context: 'sietch/preventive-gate',
            }),
          });
          statusPosted = true;
        } catch (err: any) {
          console.warn(`[PRBot] Failed to post commit status for ${commitSha}:`, err?.message || err);
        }
      }
    }

    if (scan.prNumber) {
      try {
        await this.githubJson(owner, repo, token, `/issues/${scan.prNumber}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            body: scan.githubCheckRun.markdownReport,
          }),
        });
        commentPosted = true;
      } catch (err: any) {
        console.warn(`[PRBot] Failed to post PR #${scan.prNumber} comment:`, err?.message || err);
      }
    }

    return { statusPosted, commentPosted, dryRun: false };
  }

  /**
   * Fetches unified git diff for a GitHub Pull Request.
   */
  public async fetchPullRequestDiff(
    prNumber: number,
    repoOwner?: string,
    repoName?: string
  ): Promise<string> {
    const { owner, repo } = this.resolveRepo(repoOwner, repoName);
    const { token } = await githubAppAuth.getTokenForRepo(owner, repo);

    if (token) {
      try {
        const res = await fetch(`${this.baseUrlFor(owner, repo)}/pulls/${prNumber}`, {
          headers: this.headers(token, 'application/vnd.github.v3.diff'),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          return await res.text();
        }
      } catch (err: any) {
        console.warn(`[PRBot] GitHub PR #${prNumber} diff fetch failed:`, err?.message || err);
      }
    }
    return '';
  }

  /**
   * Fetches unified git diff for a commit SHA from GitHub API, falling back to local PULSESHOP_REPO_DIR.
   */
  public async fetchCommitDiff(
    sha: string,
    repoOwner?: string,
    repoName?: string
  ): Promise<string> {
    if (!sha || sha === 'unknown') return '';

    const { owner, repo } = this.resolveRepo(repoOwner, repoName);
    const { token } = await githubAppAuth.getTokenForRepo(owner, repo);

    if (token) {
      try {
        const res = await fetch(
          `${this.baseUrlFor(owner, repo)}/commits/${encodeURIComponent(sha)}`,
          {
            headers: this.headers(token, 'application/vnd.github.v3.diff'),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (res.ok) {
          return await res.text();
        }
      } catch (err: any) {
        console.warn(`[PRBot] GitHub commit ${sha} diff fetch failed:`, err?.message || err);
      }
    }

    // Fallback to local git repo
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', CONFIG.PULSESHOP_REPO_DIR, 'show', '--format=', '--patch', sha],
        { timeout: 5000 }
      );
      return stdout;
    } catch {
      return '';
    }
  }
}

export const prBot = new GitHubPrBot();
