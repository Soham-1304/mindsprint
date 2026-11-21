import crypto from 'node:crypto';
import { CONFIG } from '../config/index.js';
import type { PurgeReceipt } from '../types/index.js';

export interface EphemeralBundleInput {
  logs?: string[];
  metrics?: Record<string, any>;
  sourceFiles?: Record<string, string>;
  windowHours?: number;
}

export interface EphemeralBundleContext {
  logs: string[];
  metrics?: Record<string, any>;
  sourceFiles: Record<string, string>;
  ingestedAt: string;
  windowHours: number;
}

interface InternalBundle extends EphemeralBundleContext {
  createdAtMs: number;
  redactionsApplied: number;
}

const REDACTION_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // DB password URIs (postgres://user:pass@host, mongodb+srv://user:pass@host, mysql://, redis://)
  {
    regex: /\b((?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis|amqp):\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi,
    replacement: '$1[REDACTED_DB_PASS]$3',
  },
  // AWS Access Key IDs
  {
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  // GitHub tokens (classic & fine-grained)
  {
    regex: /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9_]{16,}\b/g,
    replacement: '[REDACTED_GH_TOKEN]',
  },
  {
    regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    replacement: '[REDACTED_GH_PAT]',
  },
  // npm tokens
  {
    regex: /\bnpm_[A-Za-z0-9]{16,}\b/g,
    replacement: '[REDACTED_NPM_TOKEN]',
  },
  // Bearer authorization headers
  {
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  // JWTs (header.payload.signature)
  {
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  // Credit card numbers (13-19 digits, optionally separated by spaces or dashes)
  {
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[REDACTED_CARD]',
  },
  // Email addresses
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
];

/**
 * Deterministic PII & Secret Redactor.
 * Strips credentials, tokens, DB passwords, cards, and emails before RAM storage or LLM prompts.
 */
export function redactSensitiveText(text: string): { sanitized: string; redactions: number } {
  if (!text) return { sanitized: text, redactions: 0 };

  let sanitized = text;
  let redactions = 0;

  for (const { regex, replacement } of REDACTION_PATTERNS) {
    regex.lastIndex = 0;
    sanitized = sanitized.replace(regex, (...args) => {
      redactions += 1;
      // Support capture group replacements like $1, $3
      return replacement.replace(/\$(\d)/g, (_, idx) => args[Number(idx)] ?? '');
    });
  }

  return { sanitized, redactions };
}

function redactMetricsObject(
  metrics: Record<string, any>,
): { sanitized: Record<string, any>; redactions: number } {
  let redactions = 0;
  try {
    const raw = JSON.stringify(metrics);
    const res = redactSensitiveText(raw);
    redactions = res.redactions;
    if (res.redactions === 0) {
      return { sanitized: metrics, redactions: 0 };
    }
    return { sanitized: JSON.parse(res.sanitized), redactions };
  } catch {
    return { sanitized: metrics, redactions: 0 };
  }
}

/**
 * Volatile RAM-only 6-hour rolling window vault.
 * Zero disk or SQLite persistence of raw customer logs or JIT source code.
 */
export class EphemeralVault {
  private bundles: Map<string, InternalBundle> = new Map();
  private totalPurged = 0;

  private sweepExpired(): void {
    const now = Date.now();
    const ttlMs = CONFIG.EPHEMERAL_TTL_MS;
    for (const [incidentId, bundle] of this.bundles.entries()) {
      if (now - bundle.createdAtMs > ttlMs) {
        this.purgeIncidentData(incidentId);
      }
    }
  }

  public ingestBundle(
    incidentId: string,
    payload: EphemeralBundleInput,
  ): { storedItems: number; redactionsApplied: number } {
    this.sweepExpired();

    const existing = this.bundles.get(incidentId);
    let redactionsApplied = existing?.redactionsApplied ?? 0;

    const sanitizedLogs: string[] = existing ? [...existing.logs] : [];
    if (Array.isArray(payload.logs)) {
      for (const line of payload.logs) {
        const res = redactSensitiveText(String(line));
        sanitizedLogs.push(res.sanitized);
        redactionsApplied += res.redactions;
      }
    }

    const sanitizedSourceFiles: Record<string, string> = existing ? { ...existing.sourceFiles } : {};
    if (payload.sourceFiles) {
      for (const [filePath, content] of Object.entries(payload.sourceFiles)) {
        const res = redactSensitiveText(content);
        sanitizedSourceFiles[filePath] = res.sanitized;
        redactionsApplied += res.redactions;
      }
    }

    let sanitizedMetrics = existing?.metrics;
    if (payload.metrics) {
      const mRes = redactMetricsObject(payload.metrics);
      sanitizedMetrics = { ...(existing?.metrics || {}), ...mRes.sanitized };
      redactionsApplied += mRes.redactions;
    }

    const windowHours = payload.windowHours ?? existing?.windowHours ?? CONFIG.EPHEMERAL_WINDOW_HOURS;
    const bundle: InternalBundle = {
      logs: sanitizedLogs.slice(-500),
      metrics: sanitizedMetrics,
      sourceFiles: sanitizedSourceFiles,
      ingestedAt: new Date().toISOString(),
      windowHours,
      createdAtMs: Date.now(),
      redactionsApplied,
    };

    this.bundles.set(incidentId, bundle);

    const storedItems =
      bundle.logs.length +
      Object.keys(bundle.sourceFiles).length +
      (bundle.metrics ? Object.keys(bundle.metrics).length : 0);

    return { storedItems, redactionsApplied };
  }

  public getContext(incidentId: string): EphemeralBundleContext | undefined {
    this.sweepExpired();
    const bundle = this.bundles.get(incidentId);
    if (!bundle) return undefined;

    return {
      logs: [...bundle.logs],
      metrics: bundle.metrics ? { ...bundle.metrics } : undefined,
      sourceFiles: { ...bundle.sourceFiles },
      ingestedAt: bundle.ingestedAt,
      windowHours: bundle.windowHours,
    };
  }

  public purgeIncidentData(incidentId: string): PurgeReceipt {
    const bundle = this.bundles.get(incidentId);
    let itemsPurged = 0;
    let redactionsApplied = 0;

    if (bundle) {
      itemsPurged =
        bundle.logs.length +
        Object.keys(bundle.sourceFiles).length +
        (bundle.metrics ? Object.keys(bundle.metrics).length : 0);
      redactionsApplied = bundle.redactionsApplied;

      // Explicitly clear in-memory buffers
      bundle.logs.length = 0;
      for (const key of Object.keys(bundle.sourceFiles)) {
        delete bundle.sourceFiles[key];
      }
      if (bundle.metrics) {
        for (const key of Object.keys(bundle.metrics)) {
          delete bundle.metrics[key];
        }
      }
      this.bundles.delete(incidentId);
      this.totalPurged += 1;
    }

    const purgedAt = new Date().toISOString();
    const receiptPayload = JSON.stringify({
      incidentId,
      purgedAt,
      bytesRetained: 0,
      itemsPurged,
      redactionsApplied,
    });
    const receiptHash = crypto.createHash('sha256').update(receiptPayload).digest('hex');

    return {
      incidentId,
      purgedAt,
      bytesRetained: 0,
      itemsPurged,
      redactionsApplied,
      receiptHash,
    };
  }

  public getStats(): { activeBundles: number; totalPurged: number } {
    this.sweepExpired();
    return {
      activeBundles: this.bundles.size,
      totalPurged: this.totalPurged,
    };
  }
}

export const ephemeralVault = new EphemeralVault();
