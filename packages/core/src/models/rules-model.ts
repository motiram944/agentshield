/**
 * @file rules-model.ts
 * Deterministic rule-based and statistical risk model for AgentShield.
 */

import type {
  FeatureVector,
  IntentPrediction,
  NormalizedRequest,
  RiskModel,
  RiskReason,
  SessionState,
} from '../shared/index.js';

export interface RuleModelOptions {
  sensitivity?: 'lenient' | 'balanced' | 'strict';
}

export class RuleBasedRiskModel implements RiskModel {
  readonly id = 'agentshield-rule-based-v1';
  readonly version = '1.0.0';

  private readonly sensitivityMultiplier: number;

  constructor(options: RuleModelOptions = {}) {
    switch (options.sensitivity) {
      case 'lenient':
        this.sensitivityMultiplier = 0.8;
        break;
      case 'strict':
        this.sensitivityMultiplier = 1.25;
        break;
      case 'balanced':
      default:
        this.sensitivityMultiplier = 1.0;
        break;
    }
  }

  predict(
    features: FeatureVector,
    context?: { request: NormalizedRequest; session: SessionState }
  ): {
    score: number;
    reasons: RiskReason[];
    intent: IntentPrediction;
  } {
    const reasons: RiskReason[] = [];

    // 1. AUTOMATION DETECTION
    if (features.hasStealthAutomation) {
      reasons.push({
        code: 'STEALTH_AUTOMATION_EVASION',
        weight: 60,
        description: 'Prototype tampering on navigator.webdriver or CDP automation bindings detected',
      });
    }

    if (features.isTeleportedClick) {
      reasons.push({
        code: 'TELEPORTED_CLICK',
        weight: 45,
        description: 'Synthetic click executed without natural cursor trajectory or sub-human dwell time',
      });
    }

    if (features.biometricAnomaly) {
      reasons.push({
        code: 'BIOMETRIC_ANOMALY',
        weight: 35,
        description: 'Interaction biometrics deviate significantly from human physical patterns',
      });
    }

    if (features.isHeadlessBrowser) {
      reasons.push({
        code: 'HEADLESS_BROWSER',
        weight: 35,
        description: 'Headless browser environment indicators detected',
      });
    }

    if (features.hasAutomationIndicators) {
      reasons.push({
        code: 'AUTOMATION_INDICATORS',
        weight: 30,
        description: 'Navigator automation globals or driver signatures present',
      });
    }

    // 2. RATE & BURST ANALYSIS
    if (features.burstRatePer10Sec >= 20) {
      reasons.push({
        code: 'BURST_REQUESTS',
        weight: 25,
        description: `Extreme request burst detected (${features.burstRatePer10Sec} requests in 10s)`,
        metadata: { burstCount: features.burstRatePer10Sec },
      });
    } else if (features.burstRatePer10Sec >= 10) {
      reasons.push({
        code: 'BURST_REQUESTS',
        weight: 15,
        description: `Moderate request burst detected (${features.burstRatePer10Sec} requests in 10s)`,
        metadata: { burstCount: features.burstRatePer10Sec },
      });
    }

    if (features.requestRatePerMinute >= 80) {
      reasons.push({
        code: 'HIGH_REQUEST_RATE',
        weight: 25,
        description: `High request volume (${features.requestRatePerMinute} requests/min)`,
        metadata: { ratePerMin: features.requestRatePerMinute },
      });
    } else if (features.requestRatePerMinute >= 45) {
      reasons.push({
        code: 'HIGH_REQUEST_RATE',
        weight: 15,
        description: `Elevated request frequency (${features.requestRatePerMinute} requests/min)`,
        metadata: { ratePerMin: features.requestRatePerMinute },
      });
    }

    // 3. RECONNAISSANCE & PROBING
    if (features.debugEndpointAccessCount > 0) {
      reasons.push({
        code: 'DEBUG_ENDPOINT_PROBING',
        weight: 40,
        description: 'Access attempt to internal debug or environment endpoints',
      });
    }

    if (features.adminEndpointAccessCount > 0 && !context?.request.isAuthenticated) {
      reasons.push({
        code: 'ADMIN_ENDPOINT_PROBING',
        weight: 35,
        description: 'Unauthenticated probing of administrative endpoints',
      });
    }

    if (features.error404Ratio >= 0.4 && features.uniqueEndpointCount >= 5) {
      reasons.push({
        code: 'HIGH_404_RATIO',
        weight: 25,
        description: `Elevated 404 Not Found error ratio (${Math.round(features.error404Ratio * 100)}%) indicating endpoint scanning`,
        metadata: { errorRatio: features.error404Ratio },
      });
    }

    // 4. RESOURCE ENUMERATION
    if (features.sequentialResourceIdCount >= 5) {
      reasons.push({
        code: 'SEQUENTIAL_ID_ENUMERATION',
        weight: 30,
        description: `Systematic sequential resource ID traversal detected (${features.sequentialResourceIdCount} sequential items)`,
        metadata: { sequentialCount: features.sequentialResourceIdCount },
      });
    } else if (features.sequentialResourceIdCount >= 2) {
      reasons.push({
        code: 'SEQUENTIAL_ID_ENUMERATION',
        weight: 15,
        description: 'Sequential resource ID increments observed',
        metadata: { sequentialCount: features.sequentialResourceIdCount },
      });
    }

    // 5. AUTH ABUSE / BRUTE-FORCE
    if (features.authFailureCount >= 4) {
      reasons.push({
        code: 'AUTH_BRUTE_FORCE',
        weight: 35,
        description: `Repeated unauthenticated attempts on auth endpoints (${features.authFailureCount} attempts)`,
      });
    }

    // 6. BEHAVIOR & TIMING
    if (features.meanNavigationIntervalMs > 0 && features.meanNavigationIntervalMs < 120 && features.burstRatePer10Sec > 5) {
      reasons.push({
        code: 'ABNORMAL_NAVIGATION_SPEED',
        weight: 20,
        description: `Navigation velocity (${Math.round(features.meanNavigationIntervalMs)}ms) exceeds typical human physical latency`,
        metadata: { meanIntervalMs: features.meanNavigationIntervalMs },
      });
    }

    // 7. ABNORMAL APPLICATION GRAPH FLOW
    if (features.graphTransitionAnomaly) {
      reasons.push({
        code: 'ABNORMAL_APPLICATION_FLOW',
        weight: 30,
        description: 'Sequence deviates substantially from typical application workflow graph',
      });
    }

    // Aggregate score bounded between 0 and 100
    const rawTotalWeight = reasons.reduce((sum, r) => sum + r.weight, 0);
    const adjustedScore = Math.min(100, Math.max(0, Math.round(rawTotalWeight * this.sensitivityMultiplier)));

    // Classify intent based on dominant behavioral signals
    const intent = this.classifyIntent(features, reasons);

    return {
      score: adjustedScore,
      reasons,
      intent,
    };
  }

  private classifyIntent(features: FeatureVector, reasons: RiskReason[]): IntentPrediction {
    const reasonCodes = new Set(reasons.map((r) => r.code));

    if (reasonCodes.has('AUTH_BRUTE_FORCE')) {
      return { intent: 'AUTH_PROBING', confidence: 0.92 };
    }

    if (reasonCodes.has('SEQUENTIAL_ID_ENUMERATION') || (features.uniqueEndpointCount > 15 && features.apiEndpointRatio > 0.8)) {
      return { intent: 'RESOURCE_ENUMERATION', confidence: 0.88 };
    }

    if (reasonCodes.has('DEBUG_ENDPOINT_PROBING') || reasonCodes.has('ADMIN_ENDPOINT_PROBING') || reasonCodes.has('HIGH_404_RATIO')) {
      return { intent: 'RECONNAISSANCE', confidence: 0.85 };
    }

    if (reasonCodes.has('STEALTH_AUTOMATION_EVASION') || reasonCodes.has('TELEPORTED_CLICK')) {
      return { intent: 'STEALTH_AUTOMATION', confidence: 0.94 };
    }

    if (reasonCodes.has('HEADLESS_BROWSER') || reasonCodes.has('AUTOMATION_INDICATORS')) {
      return { intent: 'AUTOMATION', confidence: 0.95 };
    }

    if (features.burstRatePer10Sec > 25 || features.requestRatePerMinute > 100) {
      return { intent: 'RESOURCE_ABUSE', confidence: 0.89 };
    }

    if (features.apiEndpointRatio > 0.85) {
      return { intent: 'API_USAGE', confidence: 0.8 };
    }

    if (reasons.length === 0) {
      return { intent: 'NORMAL_BROWSING', confidence: 0.96 };
    }

    return { intent: 'UNKNOWN', confidence: 0.5 };
  }
}
