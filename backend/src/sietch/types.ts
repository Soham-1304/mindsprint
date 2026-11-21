import type {
  Event,
  Finding,
  HoneytokenKind,
  RuleId,
  Severity,
  Verdict,
  VerdictKind,
} from "./kiroween-bridge.js";

export type SietchExecutionMode = "gvisor" | "fast-docker" | "local-sandbox";

export interface EcosystemAdapterInfo {
  readonly id: "npm" | "pypi" | "go";
  readonly label: string;
  readonly status: "active" | "adapter-spec";
  readonly manifestFiles: readonly string[];
  readonly notes: string;
}

export const ECOSYSTEM_ADAPTERS: readonly EcosystemAdapterInfo[] = [
  {
    id: "npm",
    label: "npm",
    status: "active",
    manifestFiles: ["package.json", "package-lock.json"],
    notes: "Active behavioral detonation with @sietch/sandbox CI honeytokens & @sietch/core judge().",
  },
  {
    id: "pypi",
    label: "PyPI",
    status: "adapter-spec",
    manifestFiles: ["pyproject.toml", "requirements.txt"],
    notes: "Adapter spec: emits normalized exec/file/dns/http ScanInput for setup.py & wheel hooks.",
  },
  {
    id: "go",
    label: "Go",
    status: "adapter-spec",
    manifestFiles: ["go.mod", "go.sum"],
    notes: "Adapter spec: emits normalized ScanInput for go generate / init() detonation.",
  },
] as const;

export interface TripwireEntry {
  readonly id: string;
  readonly label: string;
  readonly location: string;
  readonly kind: HoneytokenKind | "workflow";
  readonly status: "UNTOUCHED" | "READ" | "EXFILTRATED" | "TAMPERED";
  readonly ruleIds: readonly RuleId[];
  readonly evidenceSeqs: readonly number[];
  readonly detail: string;
}

export interface Layer1DetonationResult {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly integrity: string;
  readonly cacheKey: string;
  readonly cacheHit: boolean;
  readonly mode: SietchExecutionMode;
  readonly requestedMode: SietchExecutionMode;
  readonly fallbackNote?: string;
  readonly rulesetVersion: string;
  readonly verdict: Verdict;
  readonly allowsInstall: boolean;
  readonly durationMs: number;
  readonly honeytokensPlanted: number;
  readonly tripwires: readonly TripwireEntry[];
  readonly events: readonly Event[];
  readonly findings: readonly Finding[];
}

export type TyposquatRuleCode =
  | "TYPO_EDIT_DIST_1"
  | "SLOP_SUFFIX_LOOKALIKE"
  | "SLOP_HALLUCINATED"
  | "FRESH_PACKAGE_48H";

export interface TyposquatFinding {
  readonly code: TyposquatRuleCode;
  readonly severity: Severity;
  readonly packageName: string;
  readonly version?: string;
  readonly closestPopularPackage?: string;
  readonly editDistance?: number;
  readonly publishedAgeHours?: number;
  readonly title: string;
  readonly explanation: string;
}

export interface TyposquatReport {
  readonly layer: "LAYER_2_TYPOSQUAT";
  readonly checkedPackages: number;
  readonly status: "PASS" | "WARN" | "BLOCK";
  readonly findings: readonly TyposquatFinding[];
}

export type DiffGuardCategory = "SECRET_LEAK" | "INFRA_REGRESSION";

export type DiffGuardRuleCode =
  | "DIFF_AWS_KEY"
  | "DIFF_GITHUB_TOKEN"
  | "DIFF_NPM_TOKEN"
  | "DIFF_PRIVATE_KEY"
  | "DIFF_ENV_SECRET"
  | "DIFF_HONEYTOKEN_MATCH"
  | "INFRA_LOW_MEMORY_LIMIT"
  | "INFRA_HEALTHCHECK_REMOVED"
  | "INFRA_PRIVILEGED_CONTAINER"
  | "INFRA_HOST_NETWORK"
  | "INFRA_ZERO_REPLICAS"
  | "INFRA_ROOT_USER";

export interface DiffGuardFinding {
  readonly code: DiffGuardRuleCode;
  readonly category: DiffGuardCategory;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number | null;
  readonly title: string;
  readonly explanation: string;
  readonly snippet: string;
}

export interface DiffGuardReport {
  readonly layer: "LAYER_3_DIFF_GUARD";
  readonly filesScanned: number;
  readonly linesScanned: number;
  readonly status: "PASS" | "WARN" | "BLOCK";
  readonly findings: readonly DiffGuardFinding[];
}

export interface GitHubCheckRunPayload {
  readonly name: string;
  readonly status: "completed";
  readonly conclusion: "success" | "failure" | "action_required";
  readonly title: string;
  readonly summary: string;
  readonly markdownReport: string;
}

export interface PackageMetadataHint {
  readonly exists?: boolean;
  readonly publishedAt?: string;
  readonly weeklyDownloads?: number;
}

export interface SietchPrScanInput {
  readonly scanId?: string;
  readonly repo?: string;
  readonly branch: string;
  readonly prNumber?: number;
  readonly commitSha?: string;
  readonly author?: string;
  readonly diffText: string;
  readonly mode?: SietchExecutionMode;
  readonly packageMetadata?: Readonly<Record<string, PackageMetadataHint>>;
  readonly localPackageOverrides?: Readonly<Record<string, string>>;
  readonly knownTokens?: readonly { id: string; value: string }[];
}

export interface SietchPrScanResult {
  readonly id: string;
  readonly createdAt: string;
  readonly repo: string;
  readonly branch: string;
  readonly prNumber?: number;
  readonly commitSha?: string;
  readonly author?: string;
  readonly verdictKind: VerdictKind;
  readonly blocked: boolean;
  readonly rulesetVersion: string;
  readonly durationMs: number;
  readonly ecosystemAdapters: readonly EcosystemAdapterInfo[];
  readonly dependencyChanges: readonly {
    readonly name: string;
    readonly version: string;
    readonly file: string;
    readonly action: "added" | "bumped";
  }[];
  readonly layer1Detonations: readonly Layer1DetonationResult[];
  readonly layer2Typosquat: TyposquatReport;
  readonly layer3DiffGuard: DiffGuardReport;
  readonly githubCheckRun: GitHubCheckRunPayload;
}
