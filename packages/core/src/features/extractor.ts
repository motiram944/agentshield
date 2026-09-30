/**
 * @file extractor.ts
 * Extracts normalized statistical and behavioral features from requests and session history.
 */

import type {
  FeatureExtractor,
  FeatureVector,
  NormalizedRequest,
  SessionState,
} from '../shared/index.js';

// Common sensitive/probe pathname markers
const ADMIN_PATTERNS = [/^\/api\/admin/i, /^\/admin/i, /^\/_admin/i];
const DEBUG_PATTERNS = [/^\/api\/debug/i, /^\/debug/i, /^\/_debug/i, /^\/eval/i, /^\/env/i, /^\/\.env/i];
const AUTH_PATTERNS = [/^\/api\/auth/i, /^\/api\/login/i, /^\/login/i, /^\/oauth/i];
const NUMERIC_ID_REGEX = /\/(\d+)(?:\/|$|\?)/;

export class DefaultFeatureExtractor implements FeatureExtractor {
  extract(request: NormalizedRequest, session: SessionState): FeatureVector {
    const now = request.timestamp;
    const history = session.recentRequests;
    const totalRequests = history.length + 1; // including current

    // 1. Request Rate Analysis
    const oneMinuteAgo = now - 60_000;
    const tenSecondsAgo = now - 10_000;

    const reqsInLastMinute = history.filter((r) => r.timestamp >= oneMinuteAgo).length + 1;
    const burstRatePer10Sec = history.filter((r) => r.timestamp >= tenSecondsAgo).length + 1;

    // 2. Endpoint Diversity & Sequential Traversal
    const pathnames = new Set(history.map((r) => r.pathname));
    pathnames.add(request.pathname);
    const uniqueEndpointCount = pathnames.size;

    // Sequential ID detection across historical paths (e.g. /api/users/1, /api/users/2, ...)
    let sequentialResourceIdCount = 0;
    const extractedIds: number[] = [];
    for (const r of [...history, { pathname: request.pathname, timestamp: now }]) {
      const match = r.pathname.match(NUMERIC_ID_REGEX);
      if (match && match[1]) {
        const id = parseInt(match[1], 10);
        if (!isNaN(id)) {
          extractedIds.push(id);
        }
      }
    }
    for (let i = 1; i < extractedIds.length; i++) {
      const prev = extractedIds[i - 1];
      const curr = extractedIds[i];
      if (prev !== undefined && curr !== undefined && Math.abs(curr - prev) === 1) {
        sequentialResourceIdCount++;
      }
    }

    // 3. Probing patterns
    let adminEndpointAccessCount = 0;
    let debugEndpointAccessCount = 0;
    let authAttempts = 0;
    let error404Count = 0;
    let apiCount = 0;

    for (const r of [...history, { pathname: request.pathname, statusCode: 200 }]) {
      const p = r.pathname;
      if (ADMIN_PATTERNS.some((pattern) => pattern.test(p))) {
        adminEndpointAccessCount++;
      }
      if (DEBUG_PATTERNS.some((pattern) => pattern.test(p))) {
        debugEndpointAccessCount++;
      }
      if (AUTH_PATTERNS.some((pattern) => pattern.test(p))) {
        authAttempts++;
      }
      if (p.startsWith('/api/') || p.startsWith('/v1/') || p.startsWith('/v2/')) {
        apiCount++;
      }
      if (r.statusCode === 404) {
        error404Count++;
      }
    }

    const error404Ratio = totalRequests > 0 ? error404Count / totalRequests : 0;
    const apiEndpointRatio = totalRequests > 0 ? apiCount / totalRequests : 0;

    // 4. Session Timing & Intervals
    const sessionDurationSeconds = Math.max(1, (now - session.createdAt) / 1000);
    let meanNavigationIntervalMs = 0;
    let interactionVariance = 0;

    if (history.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        if (prev && curr) {
          intervals.push(Math.max(0, curr.timestamp - prev.timestamp));
        }
      }
      if (intervals.length > 0) {
        const sum = intervals.reduce((a, b) => a + b, 0);
        meanNavigationIntervalMs = sum / intervals.length;
        const squareDiffs = intervals.map((val) => Math.pow(val - meanNavigationIntervalMs, 2));
        interactionVariance = squareDiffs.reduce((a, b) => a + b, 0) / intervals.length;
      }
    }

    // 5. Browser Automation Heuristics from correlation
    let hasAutomationIndicators = false;
    let isHeadlessBrowser = false;

    if (session.browserSignals) {
      const auto = session.browserSignals.automationFlags;
      if (auto) {
        if (auto.hasWebDriver || auto.hasAutomationGlobals) {
          hasAutomationIndicators = true;
        }
        if (auto.hasHeadlessScreenDims || auto.hasTamperedUserAgent) {
          isHeadlessBrowser = true;
        }
      }
    }

    // Quick user-agent heuristic (non-invasive fallback)
    const uaString = request.userAgent ?? (request.headers['user-agent'] as string | undefined) ?? (request.headers['User-Agent'] as string | undefined);
    if (uaString) {
      const ua = uaString.toLowerCase();
      if (
        ua.includes('headlesschrome') ||
        ua.includes('phantomjs') ||
        ua.includes('selenium') ||
        ua.includes('puppeteer') ||
        ua.includes('playwright')
      ) {
        isHeadlessBrowser = true;
        hasAutomationIndicators = true;
      }
    }

    return {
      requestRatePerMinute: reqsInLastMinute,
      burstRatePer10Sec,
      uniqueEndpointCount,
      error404Ratio,
      apiEndpointRatio,
      sequentialResourceIdCount,
      adminEndpointAccessCount,
      debugEndpointAccessCount,
      authFailureCount: authAttempts > 3 && !request.isAuthenticated ? authAttempts : 0,
      sessionDurationSeconds,
      meanNavigationIntervalMs,
      interactionVariance,
      hasAutomationIndicators,
      isHeadlessBrowser,
      graphTransitionAnomaly: false, // Updated by Graph Engine
      hasSessionAnomaly: burstRatePer10Sec > 25,
    };
  }
}
