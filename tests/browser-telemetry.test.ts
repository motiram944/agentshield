import { describe, it, expect } from 'vitest';
import { AgentShieldBrowser } from '../packages/browser/src/index.js';

describe('@agentshield/browser Telemetry & Privacy Boundaries', () => {
  it('should initialize and produce valid privacy-safe payload', () => {
    const browser = new AgentShieldBrowser({
      sessionId: 'sess_client_test',
    });

    const payload = browser.getPayload();

    expect(payload.sessionId).toBe('sess_client_test');
    expect(payload.interactionStats).toBeDefined();
    expect(payload.timestamp).toBeGreaterThan(0);

    // Verify privacy invariants: DOM, keystrokes, form data must not exist
    const payloadRecord = payload as unknown as Record<string, unknown>;
    expect(payloadRecord['keystrokes']).toBeUndefined();
    expect(payloadRecord['domText']).toBeUndefined();
    expect(payloadRecord['formData']).toBeUndefined();
    expect(payloadRecord['passwords']).toBeUndefined();
  });
});
