/**
 * @file engine.ts
 * Main DetectionEngine implementation orchestrating feature extraction, risk scoring,
 * application graph checking, policy enforcement, and telemetry emission.
 */

import type {
  AnalysisResult,
  BrowserSignalPayload,
  ChallengeProvider,
  DetectionEngine,
  EventBus,
  FeatureExtractor,
  NormalizedRequest,
  PolicyEngine,
  RiskLevel,
  RiskModel,
  SecurityLogEntry,
  SessionState,
  ShieldAction,
  ShieldConfig,
  ShieldMode,
} from '@motiramshinde/agentshield-shared';
import { InMemoryStore } from './store/memory.js';
import { TypedEventBus } from './events/event-bus.js';
import { DefaultFeatureExtractor } from './features/extractor.js';
import { RuleBasedRiskModel } from './models/rules-model.js';
import { DefaultPolicyEngine } from './policy/policy-engine.js';
import { ApplicationBehaviorGraph } from './graph/behavior-graph.js';
import { LocalChallengeProvider } from './challenge/local-challenge.js';

export class AgentShieldEngine implements DetectionEngine {
  readonly config: Readonly<ShieldConfig>;

  private readonly store: import('@motiramshinde/agentshield-shared').AgentShieldStore;
  private readonly events: EventBus;
  private readonly extractor: FeatureExtractor;
  private readonly model: RiskModel;
  private readonly policyEngine: PolicyEngine;
  private readonly graph: ApplicationBehaviorGraph;
  private readonly challengeProvider: ChallengeProvider;
  private readonly mode: ShieldMode;

  constructor(config: ShieldConfig = {}) {
    this.config = Object.freeze({ ...config });
    this.mode = config.mode ?? 'protect';

    this.store = (config.store as import('@motiramshinde/agentshield-shared').AgentShieldStore) ?? new InMemoryStore();
    this.events = new TypedEventBus();
    this.extractor = new DefaultFeatureExtractor();
    this.model = new RuleBasedRiskModel({ sensitivity: config.sensitivity });
    this.policyEngine = new DefaultPolicyEngine({
      rules: config.policies,
      thresholds: config.scoreThresholds,
    });
    this.graph = new ApplicationBehaviorGraph();
    this.challengeProvider = new LocalChallengeProvider();
  }

  getStore(): import('@motiramshinde/agentshield-shared').AgentShieldStore {
    return this.store;
  }

  getEvents(): EventBus {
    return this.events;
  }

  getGraph(): ApplicationBehaviorGraph {
    return this.graph;
  }

  getChallengeProvider(): ChallengeProvider {
    return this.challengeProvider;
  }

  async analyze(request: NormalizedRequest): Promise<AnalysisResult> {
    const timestamp = request.timestamp || Date.now();

    // 1. If mode is disabled, fast-path bypass
    if (this.mode === 'disabled') {
      return {
        requestId: request.id,
        sessionId: request.sessionId || 'disabled',
        timestamp,
        mode: 'disabled',
        riskScore: { score: 0, level: 'NORMAL', reasons: [] },
        intent: { intent: 'NORMAL_BROWSING', confidence: 1.0 },
        action: 'ALLOW',
        explanation: ['AgentShield is disabled.'],
      };
    }

    // 2. Resolve or initialize SessionState
    const sessionId = request.sessionId || request.ipHash || `sess_${Math.random().toString(36).slice(2, 10)}`;
    let session = await this.store.getSession(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        createdAt: timestamp,
        lastSeenAt: timestamp,
        requestCount: 0,
        recentRequests: [],
        riskScore: 0,
        riskLevel: 'NORMAL',
        detectedIntent: 'NORMAL_BROWSING',
        action: 'ALLOW',
        flowHistory: [],
        metadata: {},
      };
    }

    // 3. Application Behavior Graph transition check
    const lastRoute = session.flowHistory[session.flowHistory.length - 1];
    const flowAnomaly = this.graph.evaluateTransition(lastRoute, request.pathname, request.isAuthenticated);

    // 4. Feature Extraction
    const features = this.extractor.extract(request, session);
    if (flowAnomaly.isAnomaly) {
      features.graphTransitionAnomaly = true;
    }

    // 5. Risk Model Inference
    const prediction = this.model.predict(features, { request, session });
    if (flowAnomaly.isAnomaly && flowAnomaly.reason) {
      prediction.reasons.push({
        code: 'ABNORMAL_APPLICATION_FLOW',
        weight: flowAnomaly.score,
        description: flowAnomaly.reason,
      });
      prediction.score = Math.min(100, prediction.score + flowAnomaly.score);
    }

    const riskLevel = this.calculateRiskLevel(prediction.score);
    const riskScore = {
      score: prediction.score,
      level: riskLevel,
      reasons: prediction.reasons,
    };

    // 6. Policy Engine Evaluation
    const policyResult = this.policyEngine.evaluate(request, riskScore, prediction.intent);
    let enforcedAction: ShieldAction = policyResult.action;

    // In 'observe' mode, do not enforce blocking, challenges, or restrictions
    if (this.mode === 'observe' && (enforcedAction === 'BLOCK' || enforcedAction === 'RESTRICT' || enforcedAction === 'CHALLENGE' || enforcedAction === 'THROTTLE')) {
      enforcedAction = 'OBSERVE';
    }

    // 7. Update Session State
    const previousRiskScore = session.riskScore;
    session.lastSeenAt = timestamp;
    session.requestCount += 1;
    session.riskScore = prediction.score;
    session.riskLevel = riskLevel;
    session.detectedIntent = prediction.intent.intent;
    session.action = enforcedAction;

    // Maintain a rolling history window of 50 requests
    session.recentRequests.push({
      id: request.id,
      timestamp,
      method: request.method,
      pathname: request.pathname,
      riskScore: prediction.score,
    });
    if (session.recentRequests.length > 50) {
      session.recentRequests.shift();
    }

    // Update flow history (capped to last 20 transitions)
    session.flowHistory.push(request.pathname);
    if (session.flowHistory.length > 20) {
      session.flowHistory.shift();
    }

    await this.store.saveSession(session);

    // 8. Generate Explainability Report
    const explanation = this.buildExplanation(riskScore, prediction.intent.intent, enforcedAction);

    // 9. Challenge generation if required
    let challengeToken: string | undefined;
    if (enforcedAction === 'CHALLENGE') {
      const chk = await this.challengeProvider.generateChallenge({
        sessionId,
        requestId: request.id,
        action: enforcedAction,
      });
      challengeToken = chk.challengeToken;
    }

    const result: AnalysisResult = {
      requestId: request.id,
      sessionId,
      timestamp,
      mode: this.mode,
      riskScore,
      intent: prediction.intent,
      action: enforcedAction,
      policyMatched: policyResult.matchedRule,
      throttleDelayMs: enforcedAction === 'THROTTLE' ? 500 : undefined,
      challengeRequired: enforcedAction === 'CHALLENGE',
      challengeToken,
      explanation,
    };

    // 10. Asynchronously emit typed events
    void this.emitEvents(request, session, result, previousRiskScore);

    // 11. Structured Logging if configured
    this.logResult(request, result);

    return result;
  }

  async correlateBrowserSignals(sessionId: string, signals: BrowserSignalPayload): Promise<SessionState> {
    let session = await this.store.getSession(sessionId);
    const now = Date.now();

    if (!session) {
      session = {
        id: sessionId,
        createdAt: now,
        lastSeenAt: now,
        requestCount: 0,
        recentRequests: [],
        riskScore: 0,
        riskLevel: 'NORMAL',
        detectedIntent: 'NORMAL_BROWSING',
        action: 'ALLOW',
        flowHistory: [],
        metadata: {},
      };
    }

    session.browserSignals = signals;
    session.lastSeenAt = now;

    // Recalculate automation risk if driver detected in browser
    if (signals.automationFlags?.hasWebDriver || signals.automationFlags?.hasAutomationGlobals) {
      session.riskScore = Math.max(session.riskScore, 65);
      session.riskLevel = this.calculateRiskLevel(session.riskScore);
      session.detectedIntent = 'AUTOMATION';
    }

    await this.store.saveSession(session);
    await this.events.emit('SESSION_UPDATED', {
      sessionId,
      session,
    });

    return session;
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 81) return 'CRITICAL';
    if (score >= 61) return 'HIGH_RISK';
    if (score >= 41) return 'SUSPICIOUS';
    if (score >= 21) return 'LOW_RISK';
    return 'NORMAL';
  }

  private buildExplanation(
    riskScore: { score: number; level: RiskLevel; reasons: import('@motiramshinde/agentshield-shared').RiskReason[] },
    intent: string,
    action: ShieldAction
  ): string[] {
    const list: string[] = [
      `Risk Assessment: ${riskScore.score}/100 (${riskScore.level})`,
      `Predicted Intent: ${intent}`,
      `Enforcement Action: ${action}`,
    ];

    if (riskScore.reasons.length > 0) {
      list.push('Contributing Factors:');
      for (const r of riskScore.reasons) {
        list.push(`- [${r.code}] (weight +${r.weight}): ${r.description}`);
      }
    } else {
      list.push('No anomalous or abusive behaviors detected.');
    }

    return list;
  }

  private async emitEvents(
    request: NormalizedRequest,
    session: SessionState,
    result: AnalysisResult,
    previousScore: number
  ): Promise<void> {
    await this.events.emit('REQUEST_ANALYZED', { request, result });
    await this.events.emit('SESSION_UPDATED', {
      sessionId: session.id,
      session,
      previousRiskScore: previousScore,
    });

    if (Math.abs(session.riskScore - previousScore) >= 15) {
      await this.events.emit('RISK_CHANGED', {
        sessionId: session.id,
        oldScore: previousScore,
        newScore: session.riskScore,
        delta: session.riskScore - previousScore,
        reasons: result.riskScore.reasons,
      });
    }

    if (result.riskScore.score >= 41) {
      await this.events.emit('THREAT_DETECTED', {
        sessionId: session.id,
        requestId: request.id,
        riskScore: result.riskScore,
        threats: result.riskScore.reasons,
        action: result.action,
      });
    }

    if (result.policyMatched) {
      await this.events.emit('POLICY_TRIGGERED', {
        sessionId: session.id,
        requestId: request.id,
        rule: result.policyMatched,
        action: result.action,
      });
    }

    if (result.action === 'CHALLENGE') {
      await this.events.emit('CHALLENGE_TRIGGERED', {
        sessionId: session.id,
        requestId: request.id,
        challengeToken: result.challengeToken,
      });
    }

    if (result.action === 'BLOCK') {
      await this.events.emit('BLOCK_TRIGGERED', {
        sessionId: session.id,
        requestId: request.id,
        riskScore: result.riskScore.score,
        reasons: result.riskScore.reasons,
      });
    }

    await this.events.emit('ACTION_EXECUTED', {
      sessionId: session.id,
      requestId: request.id,
      action: result.action,
    });
  }

  private logResult(request: NormalizedRequest, result: AnalysisResult): void {
    if (this.config.logger === false) {
      return;
    }

    const logEntry: SecurityLogEntry = {
      timestamp: new Date(result.timestamp).toISOString(),
      requestId: result.requestId,
      sessionId: result.sessionId,
      route: request.pathname,
      method: request.method,
      riskScore: result.riskScore.score,
      riskLevel: result.riskScore.level,
      intent: result.intent.intent,
      action: result.action,
      reasons: result.riskScore.reasons,
    };

    if (typeof this.config.logger === 'function') {
      this.config.logger(logEntry);
    } else if (result.riskScore.score >= 41) {
      // Default to logging suspicious & higher requests
      console.warn(`[AgentShield Alert] ${logEntry.action} ${logEntry.method} ${logEntry.route} (Score: ${logEntry.riskScore}, Intent: ${logEntry.intent})`);
    }
  }
}

/**
 * Factory for creating a configured DetectionEngine instance.
 */
export function createDetectionEngine(config?: ShieldConfig): AgentShieldEngine {
  return new AgentShieldEngine(config);
}
