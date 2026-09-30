import { describe, it, expect } from 'vitest';
import {
  createDetectionEngine,
  AgentShieldEngine,
  InMemoryStore,
  TypedEventBus,
  ApplicationBehaviorGraph,
  LocalChallengeProvider,
  type NormalizedRequest,
} from '../packages/core/src/index.js';

describe('AgentShield Core Detection Engine', () => {
  it('should initialize engine with default configuration', () => {
    const engine = createDetectionEngine();
    expect(engine).toBeInstanceOf(AgentShieldEngine);
    expect(engine.getStore()).toBeInstanceOf(InMemoryStore);
    expect(engine.getEvents()).toBeInstanceOf(TypedEventBus);
  });

  it('should analyze normal browsing request with score 0 and ALLOW action', async () => {
    const engine = createDetectionEngine({ mode: 'protect' });

    const request: NormalizedRequest = {
      id: 'req_normal_1',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/products',
      pathname: '/products',
      queryParams: {},
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      sessionId: 'sess_normal_100',
    };

    const result = await engine.analyze(request);

    expect(result.action).toBe('ALLOW');
    expect(result.riskScore.score).toBeLessThanOrEqual(20);
    expect(result.riskScore.level).toBe('NORMAL');
    expect(result.intent.intent).toBe('NORMAL_BROWSING');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('should detect headless browser and automation indicators', async () => {
    const engine = createDetectionEngine({ mode: 'protect' });

    const request: NormalizedRequest = {
      id: 'req_bot_1',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/products',
      pathname: '/api/products',
      queryParams: {},
      headers: {
        'user-agent': 'Mozilla/5.0 HeadlessChrome/118.0.5993.70',
      },
      sessionId: 'sess_bot_101',
    };

    const result = await engine.analyze(request);

    expect(result.riskScore.score).toBeGreaterThanOrEqual(40);
    expect(result.intent.intent).toBe('AUTOMATION');
    const codes = result.riskScore.reasons.map((r) => r.code);
    expect(codes).toContain('HEADLESS_BROWSER');
  });

  it('should detect sequential ID resource enumeration and escalate risk', async () => {
    const engine = createDetectionEngine({ mode: 'protect' });
    const sessionId = 'sess_scanner_102';

    // Simulate sequential traversal of resources /api/users/1 .. /api/users/8
    for (let id = 1; id <= 6; id++) {
      await engine.analyze({
        id: `req_enum_${id}`,
        timestamp: Date.now() + id * 50,
        method: 'GET',
        url: `https://example.com/api/users/${id}`,
        pathname: `/api/users/${id}`,
        queryParams: {},
        headers: {},
        sessionId,
      });
    }

    const finalResult = await engine.analyze({
      id: 'req_enum_7',
      timestamp: Date.now() + 350,
      method: 'GET',
      url: 'https://example.com/api/users/7',
      pathname: '/api/users/7',
      queryParams: {},
      headers: {},
      sessionId,
    });

    expect(finalResult.intent.intent).toBe('RESOURCE_ENUMERATION');
    const codes = finalResult.riskScore.reasons.map((r) => r.code);
    expect(codes).toContain('SEQUENTIAL_ID_ENUMERATION');
    expect(finalResult.riskScore.score).toBeGreaterThanOrEqual(30);
  });

  it('should detect admin endpoint probing by unauthenticated client', async () => {
    const engine = createDetectionEngine({ mode: 'protect' });

    const result = await engine.analyze({
      id: 'req_probe_1',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/admin/secrets',
      pathname: '/api/admin/secrets',
      queryParams: {},
      headers: {},
      isAuthenticated: false,
      sessionId: 'sess_attacker_103',
    });

    expect(result.riskScore.reasons.some((r) => r.code === 'ADMIN_ENDPOINT_PROBING')).toBe(true);
    expect(result.intent.intent).toBe('RECONNAISSANCE');
  });

  it('should detect debug endpoint access attempt with high severity', async () => {
    const engine = createDetectionEngine({ mode: 'protect' });

    const result = await engine.analyze({
      id: 'req_debug_1',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/debug/dump',
      pathname: '/api/debug/dump',
      queryParams: {},
      headers: {},
      sessionId: 'sess_attacker_104',
    });

    expect(result.riskScore.reasons.some((r) => r.code === 'DEBUG_ENDPOINT_PROBING')).toBe(true);
    expect(result.riskScore.score).toBeGreaterThanOrEqual(40);
  });

  it('should enforce custom policies with priority', async () => {
    const engine = createDetectionEngine({
      mode: 'protect',
      policies: [
        {
          id: 'block-destructive',
          match: '/api/delete/*',
          minimumRisk: 30,
          action: 'BLOCK',
          priority: 100,
        },
      ],
    });

    // Make an admin probe to push score above 30
    await engine.analyze({
      id: 'req_prep',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/admin',
      pathname: '/api/admin',
      queryParams: {},
      headers: {},
      sessionId: 'sess_policy_user',
    });

    const result = await engine.analyze({
      id: 'req_del',
      timestamp: Date.now() + 10,
      method: 'POST',
      url: 'https://example.com/api/delete/all',
      pathname: '/api/delete/all',
      queryParams: {},
      headers: {},
      sessionId: 'sess_policy_user',
    });

    expect(result.action).toBe('BLOCK');
    expect(result.policyMatched?.id).toBe('block-destructive');
  });

  it('should respect observe mode by not blocking or challenging', async () => {
    const engine = createDetectionEngine({
      mode: 'observe',
    });

    const result = await engine.analyze({
      id: 'req_debug_observe',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/api/debug/dump',
      pathname: '/api/debug/dump',
      queryParams: {},
      headers: {
        'user-agent': 'HeadlessChrome/118.0.0',
      },
      sessionId: 'sess_observe_user',
    });

    // In observe mode, action is non-blocking
    expect(result.action).toBe('OBSERVE');
    expect(result.riskScore.score).toBeGreaterThanOrEqual(60);
  });

  it('should correlate browser telemetry signals into active session', async () => {
    const engine = createDetectionEngine();
    const sessionId = 'sess_browser_sync';

    // First request
    await engine.analyze({
      id: 'req_init',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://example.com/app',
      pathname: '/app',
      queryParams: {},
      headers: {},
      sessionId,
    });

    // Correlate browser signals with automation flags
    const updatedSession = await engine.correlateBrowserSignals(sessionId, {
      version: '1.0',
      sessionId,
      timestamp: Date.now(),
      automationFlags: {
        hasWebDriver: true,
        hasAutomationGlobals: true,
        hasConsistentPlugins: false,
        hasConsistentLanguages: true,
        hasHeadlessScreenDims: true,
        hasTamperedUserAgent: false,
      },
    });

    expect(updatedSession.browserSignals?.automationFlags?.hasWebDriver).toBe(true);
    expect(updatedSession.riskScore).toBeGreaterThanOrEqual(65);
    expect(updatedSession.detectedIntent).toBe('AUTOMATION');
  });

  it('should generate and verify local step-up challenges', async () => {
    const provider = new LocalChallengeProvider();
    const chk = await provider.generateChallenge({
      sessionId: 'sess_test',
      requestId: 'req_1',
      action: 'CHALLENGE',
    });

    expect(chk.challengeToken).toBeDefined();
    expect(chk.payload?.['type']).toBe('local_math');

    // Extract numbers from prompt: "Compute the sum: X + Y"
    const promptStr = String(chk.payload?.['prompt']);
    const match = promptStr.match(/(\d+)\s*\+\s*(\d+)/);
    expect(match).not.toBeNull();
    const sum = String(parseInt(match![1]!, 10) + parseInt(match![2]!, 10));

    const verifyResult = await provider.verifyChallenge(chk.challengeToken, sum);
    expect(verifyResult.verified).toBe(true);

    const badVerify = await provider.verifyChallenge('invalid_token', '999');
    expect(badVerify.verified).toBe(false);
  });

  it('should detect abnormal workflow transitions via ApplicationBehaviorGraph', () => {
    const graph = new ApplicationBehaviorGraph();
    graph.addNode({ id: 'home', routePattern: '/', isApi: false, requiresAuth: false });
    graph.addNode({ id: 'cart', routePattern: '/cart', isApi: false, requiresAuth: false });
    graph.addNode({ id: 'checkout', routePattern: '/checkout', isApi: false, requiresAuth: true, isSensitive: true });

    graph.addEdge('home', 'cart', true);
    graph.addEdge('cart', 'checkout', true);
    graph.addEntryNode('home');

    // Normal transition home -> cart
    const r1 = graph.evaluateTransition('/', '/cart', false);
    expect(r1.isAnomaly).toBe(false);

    // Unauthenticated attempt to sensitive checkout
    const r2 = graph.evaluateTransition('/cart', '/checkout', false);
    expect(r2.isAnomaly).toBe(true);
    expect(r2.reason).toContain('requires authenticated state');

    // Direct jump into sensitive checkout without prior history
    const r3 = graph.evaluateTransition(undefined, '/checkout', false);
    expect(r3.isAnomaly).toBe(true);
  });
});
