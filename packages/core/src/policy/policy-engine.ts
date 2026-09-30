/**
 * @file policy-engine.ts
 * Application-level policy engine mapping risk score, intent, and route patterns to progressive enforcement actions.
 */

import type {
  IntentPrediction,
  NormalizedRequest,
  PolicyEngine,
  PolicyRule,
  RiskScore,
  ScoreThresholds,
  ShieldAction,
} from '@motiramshinde/agentshield-shared';

export interface PolicyEngineOptions {
  rules?: PolicyRule[];
  thresholds?: ScoreThresholds;
}

export class DefaultPolicyEngine implements PolicyEngine {
  private rules: PolicyRule[] = [];
  private readonly thresholds: ScoreThresholds;

  constructor(options: PolicyEngineOptions = {}) {
    if (options.rules) {
      this.setRules(options.rules);
    }
    this.thresholds = options.thresholds ?? {
      challenge: 60,
      restrict: 75,
      block: 85,
    };
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.sortRules();
  }

  setRules(rules: PolicyRule[]): void {
    this.rules = [...rules];
    this.sortRules();
  }

  evaluate(
    request: NormalizedRequest,
    riskScore: RiskScore,
    intent: IntentPrediction
  ): {
    action: ShieldAction;
    matchedRule?: PolicyRule;
  } {
    // 1. Evaluate explicit custom policy rules first (in priority order)
    for (const rule of this.rules) {
      if (this.matchesRule(rule, request, riskScore, intent)) {
        return {
          action: rule.action,
          matchedRule: rule,
        };
      }
    }

    // 2. Default progressive mitigation based on risk score & thresholds
    const score = riskScore.score;
    if (score >= this.thresholds.block) {
      return { action: 'BLOCK' };
    }
    if (score >= this.thresholds.restrict) {
      return { action: 'RESTRICT' };
    }
    if (score >= this.thresholds.challenge) {
      return { action: 'CHALLENGE' };
    }
    if (score > 40) {
      return { action: 'THROTTLE' };
    }
    if (score > 20) {
      return { action: 'OBSERVE' };
    }

    return { action: 'ALLOW' };
  }

  private matchesRule(
    rule: PolicyRule,
    request: NormalizedRequest,
    riskScore: RiskScore,
    intent: IntentPrediction
  ): boolean {
    // Path match check
    if (typeof rule.match === 'string') {
      if (rule.match.endsWith('/*')) {
        const prefix = rule.match.slice(0, -2);
        if (!request.pathname.startsWith(prefix)) {
          return false;
        }
      } else if (rule.match !== '*' && request.pathname !== rule.match) {
        return false;
      }
    } else if (rule.match instanceof RegExp) {
      if (!rule.match.test(request.pathname)) {
        return false;
      }
    }

    // Method match check
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
      if (!methods.some((m) => m.toUpperCase() === request.method.toUpperCase())) {
        return false;
      }
    }

    // Minimum risk threshold check
    if (rule.minimumRisk !== undefined && riskScore.score < rule.minimumRisk) {
      return false;
    }

    // Intent checks
    if (rule.targetedIntents && rule.targetedIntents.length > 0) {
      if (!rule.targetedIntents.includes(intent.intent)) {
        return false;
      }
    }

    if (rule.excludedIntents && rule.excludedIntents.length > 0) {
      if (rule.excludedIntents.includes(intent.intent)) {
        return false;
      }
    }

    return true;
  }

  private sortRules(): void {
    // Sort descending by priority, rules without priority go last
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
}
