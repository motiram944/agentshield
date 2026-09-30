/**
 * @file index.ts
 * Next.js integration for AgentShield supporting App Router, Route Handlers, and Edge Middleware.
 */

import {
  AgentShieldEngine,
  type AnalysisResult,
  type NormalizedRequest,
  type ShieldConfig,
} from '../index.js';

export * from '../index.js';

export interface NextAgentShieldOptions extends ShieldConfig {
  sessionHeaderName?: string;
}

export class NextAgentShield {
  private readonly engine: AgentShieldEngine;
  private readonly sessionHeaderName: string;

  constructor(options: NextAgentShieldOptions = {}) {
    this.engine = new AgentShieldEngine(options);
    this.sessionHeaderName = options.sessionHeaderName ?? 'x-agentshield-session';
  }

  getEngine(): AgentShieldEngine {
    return this.engine;
  }

  /**
   * Universal Web API / Edge-compatible Request normalizer and analyzer.
   */
  async analyzeRequest(request: Request): Promise<AnalysisResult> {
    const url = new URL(request.url);
    const headersRecord: Record<string, string | undefined> = {};
    request.headers.forEach((val, key) => {
      headersRecord[key.toLowerCase()] = val;
    });

    const queryParams: Record<string, string | string[]> = {};
    url.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const sessionId = headersRecord[this.sessionHeaderName.toLowerCase()];
    const reqId = headersRecord['x-request-id'] ?? `req_${Math.random().toString(36).slice(2, 10)}`;

    const normalized: NormalizedRequest = {
      id: reqId,
      timestamp: Date.now(),
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      queryParams,
      headers: headersRecord,
      userAgent: headersRecord['user-agent'],
      sessionId,
      ipHash: headersRecord['x-forwarded-for']?.split(',')[0]?.trim(),
    };

    return this.engine.analyze(normalized);
  }

  /**
   * Next.js Middleware handler creator.
   * Can be imported directly into middleware.ts.
   */
  middleware() {
    return async (request: Request): Promise<Response | undefined> => {
      const url = new URL(request.url);

      // Handle telemetry correlation endpoint
      if (url.pathname === '/_agentshield/events' && request.method === 'POST') {
        try {
          const body = await request.json();
          const sessionId = request.headers.get(this.sessionHeaderName);
          if (sessionId && body) {
            await this.engine.correlateBrowserSignals(sessionId, body);
            return new Response(null, { status: 204 });
          }
        } catch {
          return new Response(null, { status: 400 });
        }
      }

      const result = await this.analyzeRequest(request);

      if (result.action === 'BLOCK') {
        return new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Request blocked by behavioral security policy.',
            code: 'AGENTSHIELD_BLOCKED',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-AgentShield-Risk': String(result.riskScore.score),
              'X-AgentShield-Action': result.action,
            },
          }
        );
      }

      if (result.action === 'CHALLENGE') {
        return new Response(
          JSON.stringify({
            error: 'Action Required',
            message: 'Behavioral verification challenge required.',
            challengeToken: result.challengeToken,
            code: 'AGENTSHIELD_CHALLENGE_REQUIRED',
          }),
          {
            status: 428,
            headers: {
              'Content-Type': 'application/json',
              'X-AgentShield-Risk': String(result.riskScore.score),
              'X-AgentShield-Action': result.action,
            },
          }
        );
      }

      if (result.action === 'RESTRICT') {
        return new Response(
          JSON.stringify({
            error: 'Access Restricted',
            message: 'Access to this resource has been temporarily restricted.',
            code: 'AGENTSHIELD_RESTRICTED',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-AgentShield-Risk': String(result.riskScore.score),
              'X-AgentShield-Action': result.action,
            },
          }
        );
      }

      // Allow / Observe / Throttle continues into Next.js pipeline
      return undefined;
    };
  }
}

export function createAgentShield(options?: NextAgentShieldOptions): NextAgentShield {
  return new NextAgentShield(options);
}
