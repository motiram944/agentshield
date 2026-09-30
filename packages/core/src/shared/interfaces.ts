/**
 * @file interfaces.ts
 * Core component interfaces and dependency contracts for AgentShield.
 */

import type {
  AnalysisResult,
  FeatureVector,
  IntentPrediction,
  NormalizedRequest,
  PolicyRule,
  RiskReason,
  RiskScore,
  SessionState,
  ShieldAction,
  ShieldConfig,
} from './types.js';
import type { AgentShieldEventMap, EventCallback } from './events.js';

/**
 * Feature Extractor interface responsible for extracting normalized metrics
 * and feature vectors from requests and session historical windows.
 */
export interface FeatureExtractor {
  /**
   * Extracts a standardized feature vector from the incoming request and current session state.
   */
  extract(request: NormalizedRequest, session: SessionState): FeatureVector;
}

/**
 * Risk Model abstraction for deterministic, statistical, or machine learning evaluation.
 */
export interface RiskModel {
  /** Model identifier */
  readonly id: string;
  /** Model version */
  readonly version: string;

  /**
   * Predicts risk score and intent given an extracted feature vector and contextual context.
   */
  predict(
    features: FeatureVector,
    context?: { request: NormalizedRequest; session: SessionState }
  ): {
    score: number;
    reasons: RiskReason[];
    intent: IntentPrediction;
  };
}

/**
 * Policy Engine interface responsible for evaluating application policies
 * against risk scores, intents, and route patterns.
 */
export interface PolicyEngine {
  /** Add a policy rule to the engine */
  addRule(rule: PolicyRule): void;
  /** Set multiple policy rules */
  setRules(rules: PolicyRule[]): void;
  /**
   * Evaluate which action to enforce for a given request, calculated risk, and intent.
   */
  evaluate(
    request: NormalizedRequest,
    riskScore: RiskScore,
    intent: IntentPrediction
  ): {
    action: ShieldAction;
    matchedRule?: PolicyRule;
  };
}

/**
 * Session storage abstraction supporting Memory, Redis, or custom distributed backends.
 */
export interface AgentShieldStore {
  /** Retrieve a session state by ID, or null if non-existent or expired */
  getSession(id: string): Promise<SessionState | null>;

  /** Persist or update a session state */
  saveSession(session: SessionState, ttlSeconds?: number): Promise<void>;

  /** Remove a session */
  deleteSession(id: string): Promise<void>;

  /** Optional cleanup / health check */
  clear?(): Promise<void>;
}

/**
 * Challenge provider abstraction for step-up verification.
 * Decoupled from any specific proprietary CAPTCHA or Turnstile provider.
 */
export interface ChallengeResult {
  verified: boolean;
  score?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ChallengeProvider {
  /** Unique name of the challenge provider */
  readonly name: string;

  /**
   * Generate challenge parameters/tokens to deliver to the client.
   */
  generateChallenge(context: {
    sessionId: string;
    requestId: string;
    action: ShieldAction;
  }): Promise<{
    challengeToken: string;
    payload?: Record<string, unknown>;
  }>;

  /**
   * Verify a submitted challenge solution.
   */
  verifyChallenge(
    challengeToken: string,
    solution: string | Record<string, unknown>
  ): Promise<ChallengeResult>;
}

/**
 * Typed Event Bus interface for observability, telemetry, and security event hooks.
 */
export interface EventBus {
  /** Register an event listener */
  on<K extends keyof AgentShieldEventMap>(
    event: K,
    listener: EventCallback<AgentShieldEventMap[K]>
  ): () => void;

  /** Register a one-time event listener */
  once<K extends keyof AgentShieldEventMap>(
    event: K,
    listener: EventCallback<AgentShieldEventMap[K]>
  ): () => void;

  /** Emit an event to all registered listeners asynchronously */
  emit<K extends keyof AgentShieldEventMap>(
    event: K,
    payload: AgentShieldEventMap[K]
  ): Promise<void>;

  /** Remove all listeners for an event or all events */
  removeAllListeners(event?: keyof AgentShieldEventMap): void;
}

/**
 * Core Detection Engine contract orchestrating request parsing, feature extraction,
 * model inference, policy evaluation, and event emission.
 */
export interface DetectionEngine {
  /** Active configuration */
  readonly config: Readonly<ShieldConfig>;

  /**
   * Analyze an incoming normalized request and return comprehensive decision & score.
   */
  analyze(request: NormalizedRequest): Promise<AnalysisResult>;

  /**
   * Correlate browser telemetry signals with an existing session.
   */
  correlateBrowserSignals(
    sessionId: string,
    signals: import('./types.js').BrowserSignalPayload
  ): Promise<SessionState>;

  /** Access underlying session store */
  getStore(): AgentShieldStore;

  /** Access underlying event bus */
  getEvents(): EventBus;
}
