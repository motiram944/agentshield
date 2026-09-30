/**
 * @file events.ts
 * Strongly typed events emitted by the AgentShield engine.
 */

import type {
  AnalysisResult,
  NormalizedRequest,
  PolicyRule,
  RiskReason,
  RiskScore,
  SessionState,
  ShieldAction,
} from './types.js';

export type EventCallback<T> = (data: T) => void | Promise<void>;

/**
 * Event payloads for AgentShield system events.
 */
export interface AgentShieldEventMap {
  /** Emitted whenever a request has been completely evaluated */
  REQUEST_ANALYZED: {
    request: NormalizedRequest;
    result: AnalysisResult;
  };

  /** Emitted whenever session state is modified or updated */
  SESSION_UPDATED: {
    sessionId: string;
    session: SessionState;
    previousRiskScore?: number;
  };

  /** Emitted when a session's risk score or risk level shifts significantly */
  RISK_CHANGED: {
    sessionId: string;
    oldScore: number;
    newScore: number;
    delta: number;
    reasons: RiskReason[];
  };

  /** Emitted when an anomaly or threat behavior exceeds the suspicious threshold */
  THREAT_DETECTED: {
    sessionId: string;
    requestId: string;
    riskScore: RiskScore;
    threats: RiskReason[];
    action: ShieldAction;
  };

  /** Emitted when an explicit policy rule matches a request */
  POLICY_TRIGGERED: {
    sessionId: string;
    requestId: string;
    rule: PolicyRule;
    action: ShieldAction;
  };

  /** Emitted when an enforcement action is executed */
  ACTION_EXECUTED: {
    sessionId: string;
    requestId: string;
    action: ShieldAction;
    reason?: string;
  };

  /** Emitted when a client is challenged */
  CHALLENGE_TRIGGERED: {
    sessionId: string;
    requestId: string;
    challengeToken?: string;
  };

  /** Emitted when a client is blocked */
  BLOCK_TRIGGERED: {
    sessionId: string;
    requestId: string;
    riskScore: number;
    reasons: RiskReason[];
  };
}
