import { Incident, RecoveryStrategy, CounterfactualEvaluation, SafetyTier, RecoveryActionType } from '../types/index.js';
import { serviceRegistry } from './serviceRegistry.js';
import { CONFIG } from '../config/index.js';

export class CounterfactualEvaluator {
  /**
   * Performs counterfactual evaluation across proposed recovery strategies.
   * Compares projected outcomes, evaluates cascading failure risks, verifies execution feasibility,
   * identifies missing evidence, and recommends the lowest-risk viable action.
   */
  public evaluate(
    incident: Incident,
    strategies: RecoveryStrategy[]
  ): {
    evaluations: CounterfactualEvaluation[];
    recommendedIndex: number;
    recommendedStrategy: RecoveryStrategy;
    rationale: string;
    missingEvidence: string[];
    isCascadingFailure: boolean;
  } {
    const topology = serviceRegistry.getTopology(incident.serviceId);
    const cascadingCheck = serviceRegistry.detectCascadingFailure(incident.serviceId);

    // 1. Identify missing evidence
    const missingEvidence: string[] = [];
    const metricSnapshot = incident.evidence.metricSnapshots || {};

    if (metricSnapshot.metricsAvailable === false) {
      missingEvidence.push('Prometheus telemetry unreachable; error rate and latency measurements are unavailable.');
    }
    if (!incident.evidence.containerState) {
      missingEvidence.push('Container exit code and restart count are unverified at host level.');
    }
    if (topology.dependents.length > 0 && cascadingCheck.upstreamSpikes.length === 0 && !metricSnapshot.throughputRpm) {
      missingEvidence.push(`Health telemetry of upstream callers [${topology.dependents.join(', ')}] has not completed a synchronized scrape.`);
    }

    // 2. Detect cascading failure / retry storm indicators from logs & metrics
    const logs = (incident.evidence.recentLogs || []).join(' ').toLowerCase();
    const rule = (incident.ruleTriggered || '').toLowerCase();
    const hasRetryStormEvidence =
      logs.includes('retry storm') ||
      logs.includes('too many retries') ||
      logs.includes('connection pool exhausted') ||
      logs.includes('pool timeout') ||
      logs.includes('thundering herd') ||
      logs.includes('timeout waiting for connection') ||
      rule.includes('retry storm') ||
      rule.includes('connection pool');

    const isCascading = cascadingCheck.isCascading || hasRetryStormEvidence;

    // 3. Evaluate each candidate strategy counterfactually
    const evaluations: CounterfactualEvaluation[] = [];

    for (const strat of strategies) {
      const evalResult = this.evaluateSingleStrategy(strat, incident, topology, isCascading, missingEvidence);
      evaluations.push(evalResult);
    }

    // Sort by risk-adjusted heuristic score descending
    let bestIndex = 0;
    let highestScore = -Infinity;

    for (let i = 0; i < evaluations.length; i++) {
      if (evaluations[i].executionFeasibility && evaluations[i].heuristicScore > highestScore) {
        highestScore = evaluations[i].heuristicScore;
        bestIndex = i;
      }
    }

    // Fallback if no strategy is feasible
    if (highestScore === -Infinity && evaluations.length > 0) {
      bestIndex = 0;
    }

    const recommended = strategies[bestIndex] || {
      name: 'Human Operator Escalation',
      description: 'Escalate to on-call engineer due to lack of safe automated recovery options.',
      actionType: 'ESCALATE_TO_HUMAN' as RecoveryActionType,
      tier: 'ASK_FIRST' as SafetyTier,
      risks: 'Manual intervention latency.',
    };

    const bestEval = evaluations[bestIndex];
    let rationale = `Selected strategy '${recommended.name}' (${recommended.actionType}). Score: ${bestEval?.heuristicScore ?? 50}/100. `;
    if (isCascading) {
      rationale += `Cascading overload/retry storm detected. Container restart was deprioritized due to thundering-herd risk on boot. `;
    }
    if (missingEvidence.length > 0) {
      rationale += `Missing evidence (${missingEvidence.length} items) enforced conservative safety clamping. `;
    }
    rationale += `Counterfactual projection: ${bestEval?.counterfactualReasoning || 'Lowest risk path to stabilization.'}`;

    return {
      evaluations,
      recommendedIndex: bestIndex,
      recommendedStrategy: recommended,
      rationale,
      missingEvidence,
      isCascadingFailure: isCascading,
    };
  }

  /**
   * Evaluates an individual candidate strategy against observed incident state
   */
  private evaluateSingleStrategy(
    strategy: RecoveryStrategy,
    incident: Incident,
    topology: { dependencies: string[]; dependents: string[] },
    isCascading: boolean,
    missingEvidence: string[]
  ): CounterfactualEvaluation {
    const actionType = strategy.actionType;
    let expectedBenefit = '';
    let riskOfWorsening: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let cascadingRisk = '';
    let reversibility: 'IMMEDIATE' | 'MODERATE' | 'IRREVERSIBLE' = 'MODERATE';
    let requiredAuthorization: SafetyTier = strategy.tier || 'ASK_FIRST';
    let executionFeasibility = true;
    let counterfactualReasoning = '';
    let heuristicScore = 70;

    switch (actionType) {
      case 'DOCKER_RESTART':
        reversibility = 'MODERATE';
        executionFeasibility = CONFIG.ENABLE_DOCKER_REMEDIATION;

        if (isCascading) {
          expectedBenefit = 'Reboots process memory and resets local thread pools.';
          riskOfWorsening = 'CRITICAL';
          cascadingRisk = `HIGH: Upstream callers [${topology.dependents.join(', ') || 'callers'}] queuing with retries will deliver a thundering herd upon boot, causing immediate secondary collapse.`;
          counterfactualReasoning =
            'If restarted while callers are actively executing retries, a thundering herd of queued connection attempts will immediately re-overwhelm the service upon boot, deepening the cascading outage.';
          requiredAuthorization = 'ASK_FIRST';
          heuristicScore = 32;
        } else {
          expectedBenefit = `Restores process execution for stateless container '${incident.serviceId}'.`;
          riskOfWorsening = 'LOW';
          cascadingRisk = 'Minimal: Upstream callers will reconnect once HTTP probe passes 200.';
          counterfactualReasoning =
            'Target service has stopped or exited cleanly without caller retry saturation. Process restart expected to restore 200 OK within 5-10 seconds.';
          requiredAuthorization = 'AUTO_FIX';
          heuristicScore = 91;
        }
        break;

      case 'CIRCUIT_BREAKER_TRIP':
        reversibility = 'IMMEDIATE';
        executionFeasibility = CONFIG.ENABLE_CIRCUIT_BREAKER;
        expectedBenefit = `Immediately sheds all upstream traffic to '${incident.serviceId}', allowing worker queues and downstream DB connections to drain.`;
        riskOfWorsening = 'LOW';
        cascadingRisk =
          'Positive containment: Upstream callers fail fast with 503 fallback instead of hanging indefinitely and exhausting worker threads.';
        counterfactualReasoning =
          'If tripped, upstream callers receive instant cached or graceful fallbacks. The overloaded downstream service is shielded from incoming retries and can stabilize.';
        requiredAuthorization = 'AUTO_FIX';
        heuristicScore = isCascading ? 95 : 68;
        break;

      case 'CIRCUIT_BREAKER_RESET':
        reversibility = 'IMMEDIATE';
        executionFeasibility = CONFIG.ENABLE_CIRCUIT_BREAKER;
        expectedBenefit = 'Restores full caller traffic routing through previously tripped circuit breaker.';
        riskOfWorsening = 'MEDIUM';
        cascadingRisk = 'Premature reset may re-introduce traffic before service has fully recovered.';
        counterfactualReasoning =
          'If executed prematurely while downstream is still warming up, load spike may re-trip breaker.';
        requiredAuthorization = 'ASK_FIRST';
        heuristicScore = 65;
        break;

      case 'REDUCE_RETRIES':
        reversibility = 'IMMEDIATE';
        executionFeasibility = CONFIG.ENABLE_RETRY_CONTROLS;
        expectedBenefit =
          'Decreases caller retry amplification from 3x-5x down to 1x, shedding 60-80% of spurious retry requests.';
        riskOfWorsening = 'LOW';
        cascadingRisk = 'Low risk: Upstream caller returns error faster to user rather than compounding queue depth.';
        counterfactualReasoning =
          'If retries are reduced, exponential traffic multiplier is eliminated, relieving downstream pressure without completely dropping all initial requests.';
        requiredAuthorization = 'AUTO_FIX';
        heuristicScore = isCascading ? 89 : 72;
        break;

      case 'FIX_PR':
        reversibility = 'MODERATE';
        executionFeasibility = true;
        expectedBenefit = 'Applies permanent code patch eliminating bug or null dereference.';
        riskOfWorsening = 'LOW';
        cascadingRisk = 'Isolated: Regression-tested code patch.';
        counterfactualReasoning =
          'Directly addresses code flaw identified by stack trace. Does not risk runtime topology instability.';
        requiredAuthorization = 'AUTO_FIX';
        heuristicScore = 94;
        break;

      case 'REVERT_PR':
        reversibility = 'MODERATE';
        executionFeasibility = true;
        expectedBenefit = 'Reverts suspect commit introducing regression or malicious dependency.';
        riskOfWorsening = 'LOW';
        cascadingRisk = 'Low: Restores known-good baseline revision.';
        counterfactualReasoning = 'Cleanly rolls back the offending commit via Pull Request.';
        requiredAuthorization = 'ASK_FIRST';
        heuristicScore = 88;
        break;

      case 'SCALE_SERVICE':
        reversibility = 'MODERATE';
        executionFeasibility = true;
        expectedBenefit = 'Increases RAM/CPU limits to absorb traffic or memory growth.';
        riskOfWorsening = 'MEDIUM';
        cascadingRisk = 'Moderate: Higher resource allocation on shared host node.';
        counterfactualReasoning =
          'Provides temporary headroom, but does not fix underlying memory leak or algorithmic bottleneck.';
        requiredAuthorization = 'ASK_FIRST';
        heuristicScore = 68;
        break;

      case 'ESCALATE_TO_HUMAN':
        reversibility = 'IMMEDIATE';
        executionFeasibility = true;
        expectedBenefit = 'Avoids autonomous misconfiguration when evidence is ambiguous or contradictory.';
        riskOfWorsening = 'LOW';
        cascadingRisk = 'Dependent on human on-call response time.';
        counterfactualReasoning = 'Telemetry is incomplete or contradictory; safest course is operator intervention.';
        requiredAuthorization = 'ASK_FIRST';
        heuristicScore = missingEvidence.length >= 2 ? 88 : 55;
        break;

      default:
        reversibility = 'MODERATE';
        executionFeasibility = true;
        expectedBenefit = 'Manual operational inspection.';
        riskOfWorsening = 'LOW';
        cascadingRisk = 'Unknown';
        counterfactualReasoning = 'Manual operator analysis required.';
        requiredAuthorization = 'ASK_FIRST';
        heuristicScore = 50;
    }

    // Missing evidence penalty
    if (
      missingEvidence.length > 0 &&
      requiredAuthorization === 'AUTO_FIX' &&
      actionType !== 'CIRCUIT_BREAKER_TRIP'
    ) {
      heuristicScore -= missingEvidence.length * 10;
      requiredAuthorization = 'ASK_FIRST';
    }

    // Feasibility penalty
    if (!executionFeasibility) {
      heuristicScore = -100;
      counterfactualReasoning += ' [CANNOT EXECUTE: Backend adapter is disabled or unavailable]';
    }

    return {
      strategyName: strategy.name,
      actionType,
      expectedBenefit,
      riskOfWorsening,
      cascadingRisk,
      reversibility,
      requiredAuthorization,
      executionFeasibility,
      counterfactualReasoning,
      heuristicScore: Math.max(0, heuristicScore),
      targetService: strategy.targetService || incident.serviceId,
      parameters: strategy.parameters,
    };
  }
}

export const counterfactualEvaluator = new CounterfactualEvaluator();
