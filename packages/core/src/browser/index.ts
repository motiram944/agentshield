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

  // Active Frontend Defense State
  private locked = false;
  private overlayElement: HTMLElement | null = null;
  private captureTrap = (e: Event): void => {
    if (this.locked && !this.overlayElement?.contains(e.target as Node)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };

  /**
   * Immediately freezes the frontend DOM to prevent harmful AI bots from clicking buttons,
   * scraping sensitive data, or submitting forms, and displays a human verification modal.
   */
  lockdown(options: { reason?: string; risk?: number; intent?: string; onResume?: () => void } = {}): void {
    if (this.locked || typeof document === 'undefined') return;
    this.locked = true;

    // 1. Sever event propagation to prevent scripted clicks/keys on the application
    ['click', 'keydown', 'keypress', 'submit', 'change', 'input'].forEach((evt) => {
      window.addEventListener(evt, this.captureTrap, true);
    });

    // 2. Inject high-priority security overlay & human verification modal
    const overlay = document.createElement('div');
    overlay.id = 'agentshield-lockdown-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(9, 13, 22, 0.88);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const riskVal = options.risk ?? 100;
    const intentVal = options.intent ?? 'STEALTH_AUTOMATION';
    const reasonMsg = options.reason ?? 'Automated agent activity detected. Access paused to protect web application data and integrity.';

    overlay.innerHTML = `
      <div style="background: rgba(18, 24, 38, 0.95); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 1rem; max-width: 500px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 35px rgba(239,68,68,0.25); text-align: center; color: #f3f4f6;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto; font-size: 28px;">
          🛡️
        </div>
        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 700; color: #f87171;">
          Autonomous AI Agent Mitigated
        </h2>
        <p style="margin: 0 0 1.25rem 0; font-size: 0.9rem; line-height: 1.5; color: #94a3b8;">
          ${reasonMsg}
        </p>
        <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.8rem;">
          <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08);">
            Risk Score: <strong style="color: #ef4444;">${riskVal}/100</strong>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08);">
            Intent: <strong style="color: #38bdf8;">${intentVal}</strong>
          </div>
        </div>
        <button id="as-human-verify-btn" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 0.85rem 1.5rem; font-size: 0.95rem; font-weight: 600; border-radius: 0.6rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">
          👤 I am a Human — Verify & Resume Session
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayElement = overlay;

    // Attach human verification listener
    const verifyBtn = overlay.querySelector('#as-human-verify-btn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        await this.resumeSession();
        if (options.onResume) options.onResume();
      });
    }
  }

  /**
   * Restores human access, clears active defenses, and syncs session reset with the backend.
   */
  async resumeSession(): Promise<void> {
    if (!this.locked || typeof document === 'undefined') return;

    try {
      await fetch('/_agentshield/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agentshield-session': this.sessionId,
        },
      });
    } catch {}

    // Remove event trap
    ['click', 'keydown', 'keypress', 'submit', 'change', 'input'].forEach((evt) => {
      window.removeEventListener(evt, this.captureTrap, true);
    });

    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    this.locked = false;
    this.isTeleportedClick = false;
  }

  isLocked(): boolean {
    return this.locked;
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
