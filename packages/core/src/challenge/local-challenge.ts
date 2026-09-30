/**
 * @file local-challenge.ts
 * Self-contained local challenge provider for step-up verification and rate attenuation.
 */

import type { ChallengeProvider, ChallengeResult, ShieldAction } from '../shared/index.js';

interface ChallengeData {
  sessionId: string;
  requestId: string;
  timestamp: number;
  expectedAnswer: string;
  expiresAt: number;
}

export class LocalChallengeProvider implements ChallengeProvider {
  readonly name = 'agentshield-local-challenge';
  private readonly pendingChallenges = new Map<string, ChallengeData>();

  async generateChallenge(context: {
    sessionId: string;
    requestId: string;
    action: ShieldAction;
  }): Promise<{
    challengeToken: string;
    payload?: Record<string, unknown>;
  }> {
    const timestamp = Date.now();
    const challengeToken = `chk_${context.sessionId}_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Simple computational puzzle: solve small arithmetic or string proof
    const num1 = Math.floor(Math.random() * 20) + 1;
    const num2 = Math.floor(Math.random() * 20) + 1;
    const answer = String(num1 + num2);

    this.pendingChallenges.set(challengeToken, {
      sessionId: context.sessionId,
      requestId: context.requestId,
      timestamp,
      expectedAnswer: answer,
      expiresAt: timestamp + 300_000, // 5 min TTL
    });

    return {
      challengeToken,
      payload: {
        type: 'local_math',
        prompt: `Compute the sum: ${num1} + ${num2}`,
        expiresInSeconds: 300,
      },
    };
  }

  async verifyChallenge(
    challengeToken: string,
    solution: string | Record<string, unknown>
  ): Promise<ChallengeResult> {
    const entry = this.pendingChallenges.get(challengeToken);
    if (!entry) {
      return { verified: false, reason: 'Invalid or expired challenge token' };
    }

    if (Date.now() > entry.expiresAt) {
      this.pendingChallenges.delete(challengeToken);
      return { verified: false, reason: 'Challenge has expired' };
    }

    const submittedAnswer = typeof solution === 'string' ? solution.trim() : String(solution['answer'] ?? '').trim();

    if (submittedAnswer === entry.expectedAnswer) {
      this.pendingChallenges.delete(challengeToken);
      return { verified: true, score: 0 };
    }

    return { verified: false, reason: 'Incorrect challenge response' };
  }
}
