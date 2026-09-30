import { describe, it, expect, vi } from 'vitest';
import { agentShield } from '../packages/node/src/index.js';
import type { Request, Response, NextFunction } from 'express';

describe('@agentshield/node Express Middleware Integration', () => {
  it('should allow normal requests and attach agentShield result', async () => {
    const middleware = agentShield({ mode: 'protect' });

    const req = {
      method: 'GET',
      path: '/api/products',
      url: '/api/products',
      originalUrl: '/api/products',
      headers: {
        'user-agent': 'Mozilla/5.0 NormalUser',
        'x-request-id': 'req_node_1',
      },
      query: {},
      ip: '127.0.0.1',
    } as unknown as Request;

    const setHeaderMock = vi.fn();
    const res = {
      setHeader: setHeaderMock,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(setHeaderMock).toHaveBeenCalledWith('X-AgentShield-Risk', expect.any(String));
    expect(setHeaderMock).toHaveBeenCalledWith('X-AgentShield-Action', 'ALLOW');
    expect((req as unknown as { agentShield: unknown }).agentShield).toBeDefined();
  });

  it('should challenge requests exceeding high risk threshold', async () => {
    const middleware = agentShield({
      mode: 'protect',
      scoreThresholds: {
        challenge: 50,
        restrict: 75,
        block: 85,
      },
    });

    const req = {
      method: 'GET',
      path: '/api/products',
      url: '/api/products',
      headers: {
        'user-agent': 'HeadlessChrome/118.0.0', // Automation trigger (+65 risk)
      },
      query: {},
      ip: '10.0.0.1',
    } as unknown as Request;

    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(428);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AGENTSHIELD_CHALLENGE_REQUIRED',
        challengeToken: expect.any(String),
      })
    );
  });

  it('should block requests matching explicit block policies', async () => {
    const middleware = agentShield({
      mode: 'protect',
      policies: [
        {
          match: '/api/admin/*',
          action: 'BLOCK',
          minimumRisk: 0,
        },
      ],
    });

    const req = {
      method: 'POST',
      path: '/api/admin/reset',
      url: '/api/admin/reset',
      headers: {},
      query: {},
      ip: '10.0.0.2',
    } as unknown as Request;

    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AGENTSHIELD_BLOCKED',
      })
    );
  });
});
