import type { SietchPrScanResult } from '../sietch/types.js';

export type MonitoringMode = 'push-ephemeral' | 'hybrid' | 'pull';

export interface ProjectCapabilities {
  githubApp: boolean;
  healthEndpoint: boolean;
  prometheusMetrics: boolean;
  jsonTelemetry: boolean;
  pushLogsActive: boolean;
  sietchGate: boolean;
  activeSignalsCount: number;
  totalSignalsCount: number;
  accuracyLevel: 'HIGH' | 'MEDIUM' | 'LOW';
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

export interface GitHubInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: 'all' | 'selected';
  createdAt: string;
}

export interface PurgeReceipt {
  incidentId: string;
  purgedAt: string;
  bytesRetained: 0;
  itemsPurged: number;
  redactionsApplied: number;
  receiptHash: string;
}

export interface SurgicalPatch {
  targetFile: string;
  originalBlock: string;
  replacementBlock: string;
  regressionTestContent?: string;
}

export type ServiceHealthStatus = 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'DOWN';

export interface ConnectedApplication {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'microservice';
  deployedUrl: string;
  healthEndpoint: string;
  metricsEndpoint?: string;
  repoUrl?: string;
  webhookUrl: string;
  webhookToken: string;
  status: ServiceHealthStatus;
  uptimePercent: number;
  lastProbe: {
    timestamp: string;
    statusCode: number;
    latencyMs: number;
    message: string;
  };
  createdAt: string;
}

export interface ServiceStats {
  errorRate5xx: number | null;
  p95LatencyMs: number | null;
  throughputRpm: number | null;
  ordersRpm?: number | null;
  memoryUsagePercent: number | null;
  cpuPercent: number | null;
  metricsAvailable?: boolean;
  errorMessage?: string;
  preCrashWarning?: string;
  businessMetricDrop?: boolean;
}

export interface MonitoredService {
  id: string;
  name: string;
  repo: string;
  metricsUrl: string;
  telemetryUrl?: string;
  logsUrl?: string;
  grafanaUrl?: string;
  healthUrl: string;
  containerName: string;
  dependencies?: string[];
  baselineThroughputRpm?: number;
  status: ServiceHealthStatus;
  lastCheck: string;
  currentVersion: string;
  currentStats: ServiceStats;
  history: Array<{
    timestamp: string;
    stats: ServiceStats;
    status: ServiceHealthStatus;
  }>;
}

export interface DeployMarker {
  id: string;
  serviceId: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  branch?: string;
  timestamp: string;
  environment: string;
  diffSummary?: string;
  changedFiles?: string[];
}

export type SafetyTier = 'AUTO_FIX' | 'ASK_FIRST' | 'NEVER_DO';

export type IncidentCategory = 'CODE_BUG' | 'RUNTIME_FAULT' | 'MEMORY_LEAK' | 'MALICIOUS_PACKAGE';

export type IncidentStatus =
  | 'DETECTED'
  | 'DIAGNOSING'
  | 'WAITING_APPROVAL'
  | 'EXECUTING'
  | 'RESOLVING'
  | 'VERIFYING'
  | 'RESOLVED'
  | 'FAILED';

export interface TopFrame {
  function: string;
  file: string;
  line: number;
  column?: number;
  error?: string;
}

export interface SuspectCommit {
  sha: string;
  message: string;
  author: string;
  file: string;
  line: number;
  diff?: string;
}

export interface TestVerificationProof {
  beforeStatus: 'FAIL' | 'SKIPPED';
  beforeOutput: string;
  afterStatus: 'PASS' | 'FAIL' | 'SKIPPED';
  afterOutput: string;
  verifiedAt: string;
}

export interface VerificationCheck {
  check: string;
  status: 'PASSED' | 'FAILED';
  detail: string;
  timestamp: string;
  targetServiceId?: string;
}

export interface IncidentEvidence {
  metricSnapshots: Record<string, any>;
  recentLogs: string[];
  stackTrace?: string;
  topFrame?: TopFrame;
  suspectCommit?: SuspectCommit;
  sietchVerdict?: Pick<SietchPrScanResult, 'id' | 'verdictKind' | 'blocked' | 'branch' | 'rulesetVersion'>;
  testProof?: TestVerificationProof;
  containerState?: {
    container?: string;
    restarts: number;
    exitCode?: number;
    oomKilled?: boolean;
    memoryLimitMb?: number;
    status: string;
  };
  dependencyTopology?: {
    serviceId: string;
    dependencies: string[];
    dependents: string[];
  };
  missingEvidence?: string[];
  verificationEvidence?: {
    startedAt: string;
    completedAt?: string;
    undoExecuted?: boolean;
    undoDetail?: string;
    checks: VerificationCheck[];
  };
}

export type DiagnosisSource = 'AI_GEMINI' | 'AI_GROQ' | 'DETERMINISTIC_HEURISTIC';

export type RecoveryActionType =
  | 'FIX_PR'
  | 'REVERT_PR'
  | 'DOCKER_RESTART'
  | 'SCALE_SERVICE'
  | 'CIRCUIT_BREAKER_TRIP'
  | 'CIRCUIT_BREAKER_RESET'
  | 'REDUCE_RETRIES'
  | 'ESCALATE_TO_HUMAN'
  | 'MANUAL_INSTRUCTION';

export interface CounterfactualEvaluation {
  strategyName: string;
  actionType: RecoveryActionType;
  expectedBenefit: string;
  riskOfWorsening: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cascadingRisk: string;
  reversibility: 'IMMEDIATE' | 'MODERATE' | 'IRREVERSIBLE';
  requiredAuthorization: SafetyTier;
  executionFeasibility: boolean;
  counterfactualReasoning: string;
  heuristicScore: number;
  targetService?: string;
  parameters?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  actionType: RecoveryActionType;
  tier: SafetyTier;
  risks: string;
  command?: string;
  codePatch?: string;
  targetFile?: string;
  fixedFileContent?: string;
  undoAction?: string;
  targetService?: string;
  parameters?: Record<string, any>;
}

export interface SuggestedFix {
  actionType: RecoveryActionType;
  description: string;
  codePatch?: string;
  targetFile?: string;
  fixedFileContent?: string;
  surgicalPatch?: SurgicalPatch;
  command?: string;
  undoAction?: string;
  risks?: string;
  targetService?: string;
  parameters?: Record<string, any>;
}

export interface IncidentDiagnosis {
  diagnosisSource: DiagnosisSource;
  modelUsed?: string;
  summary: string;
  rootCause: string;
  evidence: string[];
  confidence: number;
  uncertainty?: string;
  blastRadius: string;
  recoveryStrategies: RecoveryStrategy[];
  counterfactualEvaluations?: CounterfactualEvaluation[];
  recommendedStrategyIndex?: number;
  selectedStrategyRationale?: string;
  missingEvidenceNotes?: string[];
  isCascadingFailure?: boolean;
  explanation: string;
  safetyTier: SafetyTier;
  suggestedFix: SuggestedFix;
  regressionTestSnippet?: string;
}

export interface IncidentAction {
  id: string;
  action: string;
  tier: SafetyTier;
  executedBy: 'AI_AGENT' | 'HUMAN_OPERATOR';
  timestamp: string;
  result: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  tier: 'AUTO' | 'ASK_FIRST' | 'NEVER';
  action: string;
  target: string;
  outcome: 'EXECUTED' | 'APPROVED' | 'REJECTED' | 'BLOCKED_POLICY';
  incidentId?: string;
}

export interface CanaryGateResult {
  release: string;
  verdict: 'PASS' | 'FAIL' | 'HOLD';
  checkedAt: string;
  metricsComparison: {
    errorRate5xx: number | null;
    p95LatencyMs: number | null;
    ordersRpm: number | null;
    activeIncidents: number;
    sietchBlocked: boolean;
  };
  reasons: string[];
}

export interface Incident {
  id: string;
  projectId?: string;
  serviceId: string;
  title: string;
  ruleTriggered: string;
  category: IncidentCategory;
  status: IncidentStatus;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  fixPrUrl?: string | null;
  fixPrNumber?: number | null;
  sietchSelfGate?: {
    verdictKind: string;
    blocked: boolean;
    rulesetVersion: string;
  };
  purgeReceipt?: PurgeReceipt;
  rcaReportMarkdown?: string;
  timestamps: {
    faultStartedAt: string;
    alarmRaisedAt: string;
    causeNamedAt?: string;
    fixAppliedAt?: string;
    resolvedAt?: string;
    timeToDiagnosisSeconds?: number;
    timeToRecoverySeconds?: number;
  };
  evidence: IncidentEvidence;
  diagnosis?: IncidentDiagnosis;
  actionsTaken: IncidentAction[];
  postmortem?: string;
}

export interface Scorecard {
  totalIncidents: number;
  autoDiagnosed: number;
  autoFixed: number;
  fixPrsOpened: number;
  pendingApprovals: number;
  avgTimeToDiagnosisSeconds: number;
  manualBaselineSeconds: number;
  timeSavedSeconds: number;
  threatsBlockedBySietch: number;
}
