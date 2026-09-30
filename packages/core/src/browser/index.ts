/**
 * @file index.ts
 * Lightweight, privacy-first browser behavioral telemetry SDK for AgentShield.
 * Enhanced with Biometric Micro-telemetry, Prototype Anti-Spoofing, and Statistical ML Likelihood Scoring.
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
  private pointerPositions: Array<{ x: number; y: number; time: number }> = [];
  private lastPointerMoveTime = 0;
  private lastPointerDownTime = 0;
  private lastPointerUpTime = 0;
  private lastDwellTimeMs = 0;
  private clickCount = 0;
  private clickTimestamps: number[] = [];
  private scrollCount = 0;
  private visibilityChangeCount = 0;
  private windowFocusCount = 0;
  private isTeleportedClick = false;

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
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
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
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
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
    const entropy = this.calculatePointerEntropy();
    const automationFlags = this.detectAutomationFlags(entropy);

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
        pointerEntropy: entropy,
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

  private onPointerMove = (e: PointerEvent): void => {
    this.pointerMoveCount++;
    const now = Date.now();
    this.lastPointerMoveTime = now;
    this.pointerPositions.push({ x: e.clientX, y: e.clientY, time: now });
    if (this.pointerPositions.length > 20) {
      this.pointerPositions.shift();
    }
  };

  private onPointerDown = (): void => {
    this.lastPointerDownTime = Date.now();
  };

  private onPointerUp = (): void => {
    this.lastPointerUpTime = Date.now();
    if (this.lastPointerDownTime > 0) {
      this.lastDwellTimeMs = Math.max(0, this.lastPointerUpTime - this.lastPointerDownTime);
    }
  };

  private onClick = (e: MouseEvent): void => {
    this.clickCount++;
    const now = Date.now();
    this.clickTimestamps.push(now);
    if (this.clickTimestamps.length > 20) {
      this.clickTimestamps.shift();
    }

    // Teleported click & synthetic event detection:
    const timeSinceLastMove = this.lastPointerMoveTime > 0 ? now - this.lastPointerMoveTime : Infinity;
    const isSyntheticEvent = !e.isTrusted;
    const isInstantaneousDwell = this.lastDwellTimeMs < 8 && this.lastDwellTimeMs >= 0;
    const hasNoPriorMovement = this.pointerMoveCount === 0 || timeSinceLastMove > 2000;

    if (isSyntheticEvent || (hasNoPriorMovement && this.clickCount > 0) || (isInstantaneousDwell && hasNoPriorMovement)) {
      this.isTeleportedClick = true;
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

  private calculatePointerEntropy(): number {
    if (this.pointerPositions.length < 5) {
      return 0;
    }
    const angles: number[] = [];
    for (let i = 1; i < this.pointerPositions.length; i++) {
      const prev = this.pointerPositions[i - 1];
      const curr = this.pointerPositions[i];
      if (prev && curr) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        if (dx !== 0 || dy !== 0) {
          angles.push(Math.atan2(dy, dx));
        }
      }
    }
    if (angles.length < 4) return 0;

    const bins = new Array(8).fill(0);
    for (const a of angles) {
      const normalized = (a + Math.PI) / (2 * Math.PI);
      const binIdx = Math.min(7, Math.floor(normalized * 8));
      bins[binIdx]++;
    }

    let entropy = 0;
    const total = angles.length;
    for (const count of bins) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }
    return Number((entropy / 3).toFixed(3));
  }

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

  private detectAutomationFlags(entropy = 0): BrowserSignalPayload['automationFlags'] {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const navAny = navigator as unknown as Record<string, unknown>;
    const winAny = window as unknown as Record<string, unknown>;
    const docAny = (typeof document !== 'undefined' ? document : {}) as Record<string, unknown>;

    // 1. Prototype spoofing detection for navigator.webdriver
    let isWebDriverSpoofed = Object.prototype.hasOwnProperty.call(navigator, 'webdriver');
    try {
      const protoDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
      if (protoDesc?.get) {
        const getterStr = Function.prototype.toString.call(protoDesc.get);
        if (!getterStr.includes('[native code]')) {
          isWebDriverSpoofed = true;
        }
      }
      const instDesc = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
      if (instDesc !== undefined) {
        isWebDriverSpoofed = true;
      }
    } catch {
      // safe fallback
    }

    const hasWebDriver = Boolean(navigator.webdriver || navAny['__webdriver_evaluate'] || navAny['__selenium_evaluate'] || isWebDriverSpoofed);

    // 2. CDP & Browser Automation Globals
    const hasCdpArtifacts = Boolean(
      winAny['cdc_adoQpoasnfa76pfcZLmcfl_Array'] ||
      winAny['cdc_adoQpoasnfa76pfcZLmcfl_Promise'] ||
      winAny['cdc_adoQpoasnfa76pfcZLmcfl_Symbol'] ||
      docAny['$cdc_asdjflasutopfhvcZLmcfl_'] ||
      winAny['__playwright__binding__'] ||
      winAny['__pw_manual'] ||
      winAny['__playwright']
    );

    const hasAutomationGlobals = Boolean(
      winAny['_phantom'] ||
      winAny['__nightmare'] ||
      winAny['emit'] ||
      winAny['Buffer'] ||
      winAny['callPhantom'] ||
      hasCdpArtifacts
    );

    const hasConsistentPlugins = navigator.plugins !== undefined;
    const hasConsistentLanguages = Array.isArray(navigator.languages) && navigator.languages.length > 0;
    const hasHeadlessScreenDims = window.screen.width === 0 || window.screen.height === 0;
    const hasTamperedUserAgent = Boolean(navAny['userAgentData'] && !navigator.userAgent);

    // 3. Biometric Anomaly & Statistical Human Likelihood Model (ML Heuristic)
    const biometricAnomaly = this.isTeleportedClick || (this.clickCount > 0 && entropy < 0.1 && this.pointerMoveCount < 3);

    let humanScore = 1.0;
    if (hasWebDriver) humanScore -= 0.6;
    if (isWebDriverSpoofed) humanScore -= 0.7;
    if (hasCdpArtifacts) humanScore -= 0.5;
    if (this.isTeleportedClick) humanScore -= 0.45;
    if (biometricAnomaly) humanScore -= 0.3;
    if (hasHeadlessScreenDims) humanScore -= 0.6;
    const humanLikelihoodScore = Math.max(0, Math.min(1.0, Number(humanScore.toFixed(2))));

    return {
      hasWebDriver,
      hasAutomationGlobals,
      hasConsistentPlugins,
      hasConsistentLanguages,
      hasHeadlessScreenDims,
      hasTamperedUserAgent,
      isWebDriverSpoofed,
      hasCdpArtifacts,
      isTeleportedClick: this.isTeleportedClick,
      clickDwellTimeMs: this.lastDwellTimeMs,
      biometricAnomaly,
      humanLikelihoodScore,
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
