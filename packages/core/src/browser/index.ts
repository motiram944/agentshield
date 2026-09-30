/**
 * @file index.ts
 * Lightweight, privacy-first browser behavioral telemetry SDK for AgentShield.
 */

import type { BrowserSignalPayload } from '../shared/index.js';

export interface AgentShieldBrowserOptions {
  sessionId?: string;
  endpoint?: string;
  batchIntervalMs?: number;
  mode?: 'observe' | 'protect';
}

export class AgentShieldBrowser {
  readonly sessionId: string;
  private readonly endpoint: string;
  private readonly batchIntervalMs: number;
  private intervalId: number | null = null;
  private isRunning = false;

  // Interaction accumulators (zero DOM or text capture)
  private pointerMoveCount = 0;
  private clickCount = 0;
  private clickTimestamps: number[] = [];
  private scrollCount = 0;
  private visibilityChangeCount = 0;
  private windowFocusCount = 0;

  constructor(options: AgentShieldBrowserOptions = {}) {
    this.sessionId = options.sessionId ?? this.getOrCreateSessionId();
    this.endpoint = options.endpoint ?? '/_agentshield/events';
    this.batchIntervalMs = options.batchIntervalMs ?? 10_000;
  }

  start(): void {
    if (this.isRunning || typeof window === 'undefined') {
      return;
    }
    this.isRunning = true;

    // Attach passive listeners
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('click', this.onClick, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange, { passive: true });
    window.addEventListener('focus', this.onFocus, { passive: true });

    // Periodic flush
    this.intervalId = window.setInterval(() => {
      void this.flush();
    }, this.batchIntervalMs);
  }

  stop(): void {
    if (!this.isRunning || typeof window === 'undefined') {
      return;
    }
    this.isRunning = false;

    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('focus', this.onFocus);

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    void this.flush();
  }

  getPayload(): BrowserSignalPayload {
    const navTiming = this.getNavigationTiming();
    const automationFlags = this.detectAutomationFlags();

    let meanClickIntervalMs = 0;
    if (this.clickTimestamps.length > 1) {
      const diffs: number[] = [];
      for (let i = 1; i < this.clickTimestamps.length; i++) {
        const prev = this.clickTimestamps[i - 1];
        const curr = this.clickTimestamps[i];
        if (prev !== undefined && curr !== undefined) {
          diffs.push(curr - prev);
        }
      }
      if (diffs.length > 0) {
        meanClickIntervalMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      }
    }

    return {
      version: '0.1.0',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      navigationTiming: navTiming,
      interactionStats: {
        pointerMoveCount: this.pointerMoveCount,
        pointerEntropy: Math.min(1.0, this.pointerMoveCount / 100),
        clickCount: this.clickCount,
        meanClickIntervalMs,
        scrollCount: this.scrollCount,
        visibilityChangeCount: this.visibilityChangeCount,
        windowFocusCount: this.windowFocusCount,
      },
      automationFlags,
      clientContext: typeof window !== 'undefined' ? {
        screenWidth: window.screen?.width ?? 0,
        screenHeight: window.screen?.height ?? 0,
        viewportWidth: window.innerWidth ?? 0,
        viewportHeight: window.innerHeight ?? 0,
        devicePixelRatio: window.devicePixelRatio ?? 1,
        language: navigator.language ?? 'en',
        timezoneOffset: new Date().getTimezoneOffset(),
      } : undefined,
    };
  }

  async flush(): Promise<void> {
    if (typeof window === 'undefined') return;

    const payload = this.getPayload();

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(this.endpoint, blob);
      } else {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-agentshield-session': this.sessionId,
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch {
      // Non-blocking telemetry delivery
    }
  }

  private onPointerMove = (): void => {
    this.pointerMoveCount++;
  };

  private onClick = (): void => {
    this.clickCount++;
    this.clickTimestamps.push(Date.now());
    if (this.clickTimestamps.length > 20) {
      this.clickTimestamps.shift();
    }
  };

  private onScroll = (): void => {
    this.scrollCount++;
  };

  private onVisibilityChange = (): void => {
    this.visibilityChangeCount++;
  };

  private onFocus = (): void => {
    this.windowFocusCount++;
  };

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') {
      return `sess_${Math.random().toString(36).slice(2, 10)}`;
    }
    const key = 'agentshield_sid';
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) return stored;
      const created = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(key, created);
      return created;
    } catch {
      return `sid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  }

  private getNavigationTiming(): BrowserSignalPayload['navigationTiming'] {
    if (typeof performance === 'undefined') return undefined;

    const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return undefined;

    return {
      domComplete: nav.domComplete,
      domInteractive: nav.domInteractive,
      loadEventEnd: nav.loadEventEnd,
    };
  }

  private detectAutomationFlags(): BrowserSignalPayload['automationFlags'] {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const navAny = navigator as unknown as Record<string, unknown>;
    const winAny = window as unknown as Record<string, unknown>;

    const hasWebDriver = Boolean(navigator.webdriver || navAny['__webdriver_evaluate'] || navAny['__selenium_evaluate']);
    const hasAutomationGlobals = Boolean(
      winAny['_phantom'] ||
      winAny['__nightmare'] ||
      winAny['emit'] ||
      winAny['Buffer'] ||
      winAny['callPhantom'] ||
      winAny['__playwright']
    );

    const hasConsistentPlugins = navigator.plugins !== undefined;
    const hasConsistentLanguages = Array.isArray(navigator.languages) && navigator.languages.length > 0;
    const hasHeadlessScreenDims = window.screen.width === 0 || window.screen.height === 0;
    const hasTamperedUserAgent = Boolean(navAny['userAgentData'] && !navigator.userAgent);

    return {
      hasWebDriver,
      hasAutomationGlobals,
      hasConsistentPlugins,
      hasConsistentLanguages,
      hasHeadlessScreenDims,
      hasTamperedUserAgent,
    };
  }
}

/**
 * Convenience helper to initialize and start browser protection.
 */
export function initAgentShieldBrowser(options?: AgentShieldBrowserOptions): AgentShieldBrowser {
  const browser = new AgentShieldBrowser(options);
  browser.start();
  return browser;
}
