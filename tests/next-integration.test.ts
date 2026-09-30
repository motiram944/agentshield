import { describe, it, expect } from 'vitest';
import { createAgentShield } from '../packages/next/src/index.js';

describe('@agentshield/next Middleware & Route Handler Integration', () => {
  it('should analyze Fetch Request and return allowed status', async () => {
    const shield = createAgentShield({ mode: 'protect' });
    const middleware = shield.middleware();

    const request = new Request('https://example.com/api/products', {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 NormalUser',
      },
    });

    const response = await middleware(request);
    // Allowed requests return undefined in Next.js middleware to pass through
    expect(response).toBeUndefined();
  });

  it('should block high-risk requests with 403 Response', async () => {
    const shield = createAgentShield({
      mode: 'protect',
      policies: [
        {
          match: '/api/admin/*',
          action: 'BLOCK',
          minimumRisk: 0,
        },
      ],
    });
    const middleware = shield.middleware();

    const request = new Request('https://example.com/api/admin/internal', {
      method: 'GET',
    });

    const response = await middleware(request);
    expect(response).toBeDefined();
    expect(response?.status).toBe(403);

    const body = (await response?.json()) as { code: string };
    expect(body.code).toBe('AGENTSHIELD_BLOCKED');
  });
});
