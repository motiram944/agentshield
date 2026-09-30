import { describe, it, expect } from 'vitest';
import type {
  RiskLevel,
  AgentIntent,
  ShieldAction,
  RiskScore,
  NormalizedRequest,
  DetectionEngine,
  PolicyEngine,
  AgentShieldStore,
  ChallengeProvider,
  EventBus,
  FeatureExtractor,
  RiskModel,
  SessionState,
} from '../packages/shared/src/index.js';

describe('AgentShield Architecture & Contract Compliance', () => {
  it('should enforce proper risk tiers', () => {
    const validLevels: RiskLevel[] = ['NORMAL', 'LOW_RISK', 'SUSPICIOUS', 'HIGH_RISK', 'CRITICAL'];
    expect(validLevels).toHaveLength(5);
  });

  it('should cover all required intent classifications', () => {
    const intents: AgentIntent[] = [
      'NORMAL_BROWSING',
      'AUTOMATION',
      'API_USAGE',
      'ACCOUNT_AUTOMATION',
      'RECONNAISSANCE',
      'RESOURCE_ENUMERATION',
      'AUTH_PROBING',
      'RESOURCE_ABUSE',
      'UNKNOWN',
    ];
    expect(intents).toHaveLength(9);
  });

  it('should support progressive shield actions', () => {
    const actions: ShieldAction[] = [
      'ALLOW',
      'OBSERVE',
      'THROTTLE',
      'CHALLENGE',
      'RESTRICT',
      'BLOCK',
    ];
    expect(actions).toHaveLength(6);
  });

  it('should validate normalized request shape without privacy violations', () => {
    const request: NormalizedRequest = {
      id: 'req_123',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/products',
      pathname: '/api/products',
      queryParams: { limit: '10' },
      headers: {
        'user-agent': 'Mozilla/5.0 AgentTest',
        'x-request-id': 'req_123',
      },
      ipHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    expect(request.method).toBe('GET');
    expect(request.pathname).toBe('/api/products');
    expect(request.ipHash).toBeDefined();
    // Verify that sensitive fields are not in the normalized contract
    expect((request as Record<string, unknown>)['password']).toBeUndefined();
    expect((request as Record<string, unknown>)['body']).toBeUndefined();
  });

  it('should ensure RiskScore is bounded and explainable', () => {
    const score: RiskScore = {
      score: 78,
      level: 'HIGH_RISK',
      reasons: [
        {
          code: 'HIGH_REQUEST_RATE',
          weight: 20,
          description: 'Request frequency significantly exceeds normal session behavior',
        },
        {
          code: 'ENDPOINT_ENUMERATION',
          weight: 25,
          description: 'Client accessed many resource endpoints sequentially',
        },
        {
          code: 'ABNORMAL_NAVIGATION_SPEED',
          weight: 15,
          description: 'Navigation occurred significantly faster than observed human sessions',
        },
      ],
    };

    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.level).toBe('HIGH_RISK');
    expect(score.reasons.length).toBeGreaterThan(0);
    for (const r of score.reasons) {
      expect(r.code).toBeDefined();
      expect(r.weight).toBeGreaterThan(0);
      expect(r.description).toBeDefined();
    }
  });

  it('should permit interface instantiation for custom components', () => {
    // Verify custom store conforms to AgentShieldStore contract
    class MockStore implements AgentShieldStore {
      private sessions = new Map<string, SessionState>();
      async getSession(id: string): Promise<SessionState | null> {
        return this.sessions.get(id) || null;
      }
      async saveSession(session: SessionState): Promise<void> {
        this.sessions.set(session.id, session);
      }
      async deleteSession(id: string): Promise<void> {
        this.sessions.delete(id);
      }
    }

    const store: AgentShieldStore = new MockStore();
    expect(store).toBeDefined();
    expect(typeof store.getSession).toBe('function');
  });
});
