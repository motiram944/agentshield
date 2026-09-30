/**
 * @file index.ts
 * Main entry point for @agentshield/node.
 * Express middleware and Node.js request adapters for AgentShield.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  AgentShieldEngine,
  type NormalizedRequest,
  type ShieldConfig,
  type AnalysisResult,
} from '../index.js';

export * from '../index.js';

export interface AgentShieldNodeOptions extends ShieldConfig {
  /** Salt used for one-way IP hashing (defaults to runtime random salt) */
  ipHashSalt?: string;
  /** Custom request ID extractor */
  getRequestId?: (req: Request) => string;
}

/**
 * Creates an Express-compatible middleware for AgentShield.
 */
export function agentShield(options: AgentShieldNodeOptions = {}): RequestHandler {
  const engine = new AgentShieldEngine(options);
  const runtimeSalt = options.ipHashSalt ?? crypto.randomBytes(16).toString('hex');
  const sessionHeader = options.sessionHeaderName ?? 'x-agentshield-session';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Check if correlation telemetry endpoint is called
      const isEventsEndpoint = req.method === 'POST' && (
        req.path === '/_agentshield/events' ||
        req.originalUrl?.includes('/_agentshield/events') ||
        (req.baseUrl === '/_agentshield/events' && req.path === '/')
      );
      if (isEventsEndpoint) {
        const body = (req as unknown as { body: import('../shared/index.js').BrowserSignalPayload }).body;
        const sessionId = req.headers[sessionHeader.toLowerCase()] as string | undefined;
        if (sessionId && body) {
          await engine.correlateBrowserSignals(sessionId, body);
          res.status(204).end();
          return;
        }
      }

      // 1b. Human Session Resume endpoint
      const isResumeEndpoint = req.method === 'POST' && (
        req.path === '/_agentshield/resume' ||
        req.originalUrl?.includes('/_agentshield/resume') ||
        req.path === '/api/agentshield/resume' ||
        req.originalUrl?.includes('/api/agentshield/resume')
      );
      if (isResumeEndpoint) {
        const sessionId = req.headers[sessionHeader.toLowerCase()] as string | undefined;
        if (sessionId) {
          const store = (engine as unknown as { store: import('../shared/index.js').AgentShieldStore }).store;
          const session = await store.getSession(sessionId);
          if (session) {
            session.riskScore = 0;
            session.riskLevel = 'NORMAL';
            session.detectedIntent = 'NORMAL_BROWSING';
            session.action = 'ALLOW';
            await store.saveSession(session);
          }
        }
        res.status(200).json({ success: true, message: 'Session successfully resumed for verified human user.' });
        return;
      }

      // 2. Normalize incoming Node/Express request
      const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const ipHash = crypto
        .createHash('sha256')
        .update(rawIp + runtimeSalt)
        .digest('hex');

      const headersRecord: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headersRecord[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      }

      const queryRecord: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(req.query || {})) {
        if (typeof v === 'string' || Array.isArray(v)) {
          queryRecord[k] = v as string | string[];
        }
      }

      const reqId = options.getRequestId ? options.getRequestId(req) : (headersRecord['x-request-id'] ?? `req_${crypto.randomUUID()}`);
      const sessionId = headersRecord[sessionHeader.toLowerCase()];

      const normalizedRequest: NormalizedRequest = {
        id: reqId,
        timestamp: Date.now(),
        method: req.method,
        url: req.originalUrl || req.url,
        pathname: req.path,
        queryParams: queryRecord,
        headers: headersRecord,
        userAgent: headersRecord['user-agent'],
        sessionId,
        ipHash,
        isAuthenticated: Boolean((req as unknown as { user?: unknown }).user),
      };

      // 3. Analyze request through DetectionEngine
      const result: AnalysisResult = await engine.analyze(normalizedRequest);

      // Attach AgentShield result to request context
      (req as unknown as { agentShield: AnalysisResult }).agentShield = result;

      // Set audit headers
      res.setHeader('X-AgentShield-Risk', String(result.riskScore.score));
      res.setHeader('X-AgentShield-Action', result.action);
      res.setHeader('X-AgentShield-Intent', result.intent.intent);
      res.setHeader('X-AgentShield-Session', result.sessionId);

      // 4. Enforce Decision
      switch (result.action) {
        case 'ALLOW':
        case 'OBSERVE':
          return next();

        case 'THROTTLE':
          if (result.throttleDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, result.throttleDelayMs));
          }
          return next();

        case 'CHALLENGE':
          res.status(428).json({
            error: 'Action Required',
            message: 'Behavioral verification challenge required.',
            challengeToken: result.challengeToken,
            code: 'AGENTSHIELD_CHALLENGE_REQUIRED',
          });
          return;

        case 'RESTRICT':
          res.status(403).json({
            error: 'Access Restricted',
            message: 'Access to this resource has been temporarily restricted.',
            code: 'AGENTSHIELD_RESTRICTED',
          });
          return;

        case 'BLOCK':
          res.status(403).json({
            error: 'Forbidden',
            message: 'Request blocked by behavioral security policy.',
            code: 'AGENTSHIELD_BLOCKED',
          });
          return;

        default:
          return next();
      }
    } catch (err) {
      // Fail-open principle: never crash application traffic if middleware encounters internal error
      console.error('[AgentShield Node Middleware Error]:', err);
      next();
    }
  };
}
