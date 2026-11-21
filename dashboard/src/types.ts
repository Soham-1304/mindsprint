export type ActiveTab = "projects" | "incidents" | "sietch" | "approvals" | "applications";

export type DiagnosisSource = "AI_GEMINI" | "AI_GROQ" | "DETERMINISTIC_HEURISTIC";

export type MonitoringMode = "push-ephemeral" | "hybrid" | "pull";

export interface ProjectCapabilities {
  githubApp: boolean;
  healthEndpoint: boolean;
  prometheusMetrics: boolean;
  jsonTelemetry: boolean;
  pushLogsActive: boolean;
  sietchGate: boolean;
  activeSignalsCount: number;
  totalSignalsCount: number;
  accuracyLevel: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
  checkedAt: string;
}

export interface LinkedProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  fullName: string;
  defaultBranch: string;
  installationId?: number;
  deployedUrl?: string;
  healthEndpoint?: string;
  metricsEndpoint?: string;
  telemetryEndpoint?: string;
  prometheusUrl?: string;
  capabilities: ProjectCapabilities;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubRepoOption {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  installationId?: number;
}

export interface GitHubAppStatus {
  configured: boolean;
  installUrl: string;
  installations: Array<{
    installationId: number;
    accountLogin: string;
    accountType: string;
    repositorySelection: "all" | "selected";
    createdAt: string;
  }>;
}

export interface PurgeReceipt {
  incidentId: string;
  purgedAt: string;
  bytesRetained: 0;
  itemsPurged: number;
  redactionsApplied: number;
  receiptHash: string;
}

export interface SietchSelfGate {
  verdictKind: string;
  blocked: boolean;
  rulesetVersion: string;
}

export interface CounterfactualEvaluation {
  strategyName: string;
  actionType: string;
  expectedBenefit: string;
  riskOfWorsening: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cascadingRisk: string;
  reversibility: "IMMEDIATE" | "MODERATE" | "IRREVERSIBLE";
  requiredAuthorization: "AUTO_FIX" | "ASK_FIRST" | "NEVER_DO" | "AUTO" | "NEVER";
  executionFeasibility: boolean;
  counterfactualReasoning: string;
  heuristicScore: number;
  targetService?: string;
}

export interface ConnectedApplication {
  id: string;
  name: string;
  type: "frontend" | "backend" | "fullstack" | "microservice";
  deployedUrl: string;
  healthEndpoint: string;
  metricsEndpoint?: string;
  repoUrl?: string;
  webhookUrl: string;
  webhookToken: string;
  status: "HEALTHY" | "WARNING" | "DEGRADED" | "DOWN";
  uptimePercent: number;
  lastProbe: {
    timestamp: string;
    statusCode: number;
    latencyMs: number;
    message: string;
  };
  createdAt: string;
}

export interface ServiceStatus {
  name: string;
  port: number;
  status: "healthy" | "degraded";
}

export interface TargetOverview {
  name: string;
  activeRelease: string;
  canarySplit: {
    stable: number;
    canary: number;
    stableLabel: string;
    canaryLabel: string;
  };
  services: ServiceStatus[];
}

export interface ScorecardMetrics {
  meanTtdMs: number;
  manualBaselineMs: number;
  incidentsTotal: number;
  fixPrsOpened: number;
  sietchPackagesBlocked: number;
  pendingApprovals: number;
}

export interface TimelineStep {
  id: string;
  offsetLabel: string;
  timestamp: string;
  stage: "WATCHER" | "CULPRIT" | "BRAIN" | "PR_BOT" | "VERIFIER" | "HANDS" | "SIETCH";
  title: string;
  detail: string;
  status: "done" | "active" | "alert";
}

export interface IncidentRecord {
  id: string;
  projectId?: string;
  title: string;
  ruleId: "ERR_5XX_SPIKE" | "LATENCY_P95_DOUBLE" | "BIZ_ORDERS_DROP" | "SERVICE_DOWN";
  severity: "Critical" | "High";
  status: "RESOLVED" | "MITIGATING" | "OPEN";
  service: "gateway" | "orders" | "payments";
  faultCategory: "CODE_BUG" | "RUNTIME_INSTANCE" | "DEPENDENCY_FAULT";
  faultStartAt: string;
  alarmRaisedAt: string;
  causeNamedAt: string;
  resolvedAt: string | null;
  timeToDiagnosisMs: number;
  culpritCommitSha: string | null;
  culpritAuthor: string | null;
  culpritFile: string | null;
  culpritLine: number | null;
  topFrame?: {
    function: string;
    file: string;
    line: number;
    column: number;
    error: string;
  };
  gitBlameDiff?: string;
  containerState?: {
    container: string;
    status: string;
    exitCode: number;
    oomKilled: boolean;
    restartCount: number;
  };
  diagnosisSummary: string;
  diagnosisSource?: DiagnosisSource;
  modelUsed?: string;
  confidence: number;
  safetyTier: "AUTO" | "ASK_FIRST" | "NEVER";
  counterfactualEvaluations?: CounterfactualEvaluation[];
  recommendedStrategyIndex?: number;
  selectedStrategyRationale?: string;
  testProof?: {
    beforeStatus: "FAIL";
    beforeOutput: string;
    afterStatus: "PASS";
    afterOutput: string;
  };
  fixPrUrl: string | null;
  fixPrNumber: number | null;
  sietchSelfGate?: SietchSelfGate;
  purgeReceipt?: PurgeReceipt;
  rcaReportMarkdown?: string;
  metricSeries: { label: string; value: number; baseline: number }[];
  metricUnit: string;
  timeline: TimelineStep[];
}

export interface ApprovalRequest {
  id: string;
  incidentId: string;
  createdAt: string;
  tier: "AUTO" | "ASK_FIRST" | "NEVER";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";
  actionTitle: string;
  target: string;
  rationale: string;
  evidenceCitations: string[];
  undoPlan: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  tier: "AUTO" | "ASK_FIRST" | "NEVER";
  action: string;
  target: string;
  outcome: "EXECUTED" | "APPROVED" | "REJECTED" | "BLOCKED_POLICY";
  incidentId?: string;
}

export interface SietchEvent {
  type: "exec" | "file_read" | "file_write" | "connect" | "exit" | "dns" | "http";
  seq: number;
  t: number;
  phase: "install" | "load" | "linger";
  pid?: number;
  ppid?: number;
  path?: string;
  op?: string;
  target?: string;
  argv?: string[];
  name?: string;
  qtype?: string;
  method?: string;
  scheme?: string;
  host?: string;
  headers?: [string, string][];
  body?: string;
  code?: number | null;
  signal?: string | null;
  address?: string | null;
  port?: number;
}

export interface SietchFinding {
  ruleId: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  title: string;
  explanation: string;
  evidence: number[];
}

export interface TripwireEntry {
  id: string;
  label: string;
  location: string;
  kind: string;
  status: "UNTOUCHED" | "READ" | "EXFILTRATED" | "TAMPERED";
  ruleIds: string[];
  evidenceSeqs: number[];
  detail: string;
}

export interface Layer1DetonationResult {
  packageName: string;
  packageVersion: string;
  integrity: string;
  cacheKey: string;
  cacheHit: boolean;
  mode: string;
  requestedMode: string;
  fallbackNote?: string;
  rulesetVersion: string;
  verdict: {
    kind: "SAFE" | "SUSPICIOUS" | "MALICIOUS" | "ERROR";
    rulesetVersion: string;
    findings: SietchFinding[];
    reason?: string;
  };
  allowsInstall: boolean;
  durationMs: number;
  honeytokensPlanted: number;
  tripwires: TripwireEntry[];
  events: SietchEvent[];
  findings: SietchFinding[];
}

export interface TyposquatFinding {
  code: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  packageName: string;
  version?: string;
  closestPopularPackage?: string;
  editDistance?: number;
  publishedAgeHours?: number;
  title: string;
  explanation: string;
}

export interface DiffGuardFinding {
  code: string;
  category: "SECRET_LEAK" | "INFRA_REGRESSION";
  severity: "Low" | "Medium" | "High" | "Critical";
  file: string;
  line: number | null;
  title: string;
  explanation: string;
  snippet: string;
}

export interface EcosystemAdapterInfo {
  id: "npm" | "pypi" | "go";
  label: string;
  status: "active" | "adapter-spec";
  manifestFiles: string[];
  notes: string;
}

export interface SietchPrScanResult {
  id: string;
  createdAt: string;
  repo: string;
  branch: string;
  prNumber?: number;
  commitSha?: string;
  author?: string;
  verdictKind: "SAFE" | "SUSPICIOUS" | "MALICIOUS" | "ERROR";
  blocked: boolean;
  rulesetVersion: string;
  durationMs: number;
  ecosystemAdapters: EcosystemAdapterInfo[];
  dependencyChanges: {
    name: string;
    version: string;
    file: string;
    action: "added" | "bumped";
  }[];
  layer1Detonations: Layer1DetonationResult[];
  layer2Typosquat: {
    layer: string;
    checkedPackages: number;
    status: "PASS" | "WARN" | "BLOCK";
    findings: TyposquatFinding[];
  };
  layer3DiffGuard: {
    layer: string;
    filesScanned: number;
    linesScanned: number;
    status: "PASS" | "WARN" | "BLOCK";
    findings: DiffGuardFinding[];
  };
  githubCheckRun: {
    name: string;
    status: string;
    conclusion: string;
    title: string;
    summary: string;
    markdownReport: string;
  };
}

export interface PostmortemRecord {
  id: string;
  incidentId: string;
  title: string;
  generatedAt: string;
  service: string;
  severity: "Critical" | "High";
  faultStartAt: string;
  alarmRaisedAt: string;
  causeNamedAt: string;
  resolvedAt: string;
  detectionLagMs: number;
  diagnosisDurationMs: number;
  totalTtdMs: number;
  manualBaselineMs: number;
  fixPrUrl: string | null;
  markdown: string;
}

export interface DashboardOverview {
  target: TargetOverview;
  scorecard: ScorecardMetrics;
  incidents: IncidentRecord[];
  approvals: ApprovalRequest[];
  auditLog: AuditLogEntry[];
  sietchScans: SietchPrScanResult[];
  postmortems: PostmortemRecord[];
  applications?: ConnectedApplication[];
  projects?: LinkedProject[];
  activeProjectId?: string;
  monitoringMode?: MonitoringMode;
  githubApp?: GitHubAppStatus;
  ephemeralStats?: { activeBundles: number; totalPurged: number };
}
