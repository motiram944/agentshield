# AgentShield

> **Privacy-first, local-first runtime behavioral firewall for Node.js, Express, Next.js, and web applications.**  
> Protects against unauthorized autonomous AI agents, automated headless browsers, stealth scraping, and resource abuse with zero cloud dependencies.

[![npm version](https://img.shields.io/npm/v/agentshield-core.svg)](https://www.npmjs.com/package/agentshield-core)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-yellow.svg)](https://vitest.dev/)

---

## 🌟 What is AgentShield?

AI autonomous agents, automated browsers (Playwright, Puppeteer, Selenium), and multimodal scraping bots (Claude Computer Use, GPT-4o Vision) interact with websites with human-like fidelity. Traditional IP rate limiters, static WAF rules, and simple bot checks fail because AI agents use real browser runtimes and rotate residential IP proxies.

`agentshield-core` provides an **all-in-one, privacy-first behavioral security firewall**:

```
Detect behavior → calculate risk → understand intent → enforce policy.
```

* ⚡ **Zero External Dependencies**: 100% self-contained TypeScript engine (`deps: none`).
* ⏱️ **Ultra-Fast Local Evaluation**: Evaluates behavioral risk in **< 0.8 ms** in-process without any cloud or LLM API calls.
* 🔒 **Privacy-First**: Uses one-way salted hashes; never captures PII, form bodies, or keystrokes.
* 🛑 **Frontend Active Defense**: Freezes the DOM, blurs content against AI vision scrapers, and rejects synthetic clicks.
* 👤 **1-Click Human Recovery**: Legitimate human users can verify and resume work seamlessly without page reload.
* 📢 **Block Mode or Notify-Only Mode**: Full control to either automatically block threats or run in stealth observation mode with webhooks/alerts.

---

## 📦 Installation

```bash
npm install agentshield-core
# or
pnpm add agentshield-core
# or
yarn add agentshield-core
```

---

## 🎛️ Controlling Enforcement: Block vs. Notify-Only

AgentShield allows you to configure whether to actively block AI agents or just receive threat alerts:

| Mode | Behavior | Ideal For |
| :--- | :--- | :--- |
| **`mode: 'protect'`** | **Active Blocking:** Intercepts requests, serves HTTP 428 Challenges / HTTP 403 Blocks, throttles rapid calls, and engages frontend active DOM lockdown. | Production applications wanting immediate autonomous protection. |
| **`mode: 'observe'`** | **Notify / Audit Only:** **Never blocks or interrupts any user or bot.** Calculates full risk scores, tags headers (`X-AgentShield-Risk`), and emits threat events so you can log or send alerts to Slack/Discord/Datadog. | Auditing traffic, baseline calibration, and zero-risk shadow deployments. |
| **`mode: 'disabled'`** | Completely bypasses the shield engine. | Local unit testing or debugging. |

---

## 🚀 Integration Guides

### 1. Express / Node.js Backend

```typescript
import express from 'express';
import { agentShield } from 'agentshield-core';

const app = express();

// Configure AgentShield
const shield = agentShield({
  mode: 'protect', // Change to 'observe' for Notify-Only mode
  sensitivity: 'balanced', // 'lenient' | 'balanced' | 'strict'
  scoreThresholds: {
    challenge: 60,
    restrict: 75,
    block: 85,
  },
  policies: [
    {
      id: 'admin-protection',
      match: '/api/admin/*',
      minimumRisk: 30,
      action: 'BLOCK',
    },
    {
      id: 'debug-protection',
      match: '/api/debug/*',
      minimumRisk: 0,
      action: 'BLOCK',
    }
  ]
});

// Attach middleware for API routes
app.use('/api', shield);

app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Alice' });
});

app.listen(3000, () => console.log('Server running with AgentShield'));
```

#### Notify / Alert Only Example (Slack / Discord / Webhook)
```typescript
import { createDetectionEngine } from 'agentshield-core';

const engine = createDetectionEngine({ mode: 'observe' });

// Listen for threat detection events
engine.events.on('THREAT_DETECTED', async (event) => {
  console.log(`🚨 AI Bot Detected on session ${event.sessionId}: Risk ${event.riskScore.score}`);
  
  // Send alert to your team
  await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
    method: 'POST',
    body: JSON.stringify({
      text: `⚠️ *AgentShield Alert*: Detected ${event.intent.intent} from IP hash ${event.request.ipHash} (Score: ${event.riskScore.score}/100)`
    })
  });
});
```

---

### 2. Next.js (App Router & Edge Middleware)

Add `middleware.ts` in your Next.js project root:

```typescript
// middleware.ts
import { createAgentShield } from 'agentshield-core/next';
import { NextResponse } from 'next/server';

export const middleware = createAgentShield({
  mode: 'protect', // or 'observe' for alerts only
  excludePaths: ['/_next', '/favicon.ico', '/public'],
  onThreatDetected: (req, result) => {
    console.warn(`[AgentShield Alert] ${result.action} on ${req.nextUrl.pathname} (Score: ${result.riskScore.score})`);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

### 3. Frontend Web Application (React, Vue, Vanilla JS)

The browser telemetry client captures non-invasive interaction biometrics (cursor trajectory entropy, dwell time, and prototype tampering) and provides **Frontend Active Defense**:

```typescript
import { AgentShieldBrowser } from 'agentshield-core/browser';

const shield = new AgentShieldBrowser({
  endpoint: '/_agentshield/events', // Automatic backend correlation endpoint
  batchIntervalMs: 5000,
});

shield.start();
```

#### What Happens When an AI Agent is Detected on Frontend:
1. **Screen Blurring & Freezing:** A high-priority interstitial appears (`z-index: 2147483647`) and background DOM is blurred (`backdrop-filter: blur(14px)`), blinding AI vision scrapers and OCR tools.
2. **Event Severing:** Clicks, keypresses, and form submissions are swallowed at the capture phase.
3. **AI Click Rejection:** If an AI agent tries to programmatically click the `"Verify & Continue"` button (via `page.click()`), AgentShield inspects physical dwell time (< 25ms) and event trust, **rejecting the AI bypass attempt**.
4. **1-Click Human Recovery:** Legitimate humans click the button with natural finger dynamics, restoring their session risk to **0 (ALLOW)** without losing page state.

---

## 🛡️ Complete AI Threat Matrix (Problems Solved)

| Threat Vector | How AI Agents Attack | How AgentShield Protects |
| :--- | :--- | :--- |
| **Headless Driver Flags** | Playwright / Puppeteer automation | Detects `navigator.webdriver` and automation globals &rarr; `CHALLENGE`. |
| **Stealth Prototype Spoofing** | Script redefines `Object.defineProperty(navigator, 'webdriver', { get: () => false })` | Inspects `Navigator.prototype` vs own properties; unmasks getter tampering &rarr; `BLOCK`. |
| **Synthetic / Teleported Clicks** | AI scripts fire instant click events across coordinates | Flags clicks with zero prior trajectory moves or dwell time < 10ms &rarr; `RESTRICT`. |
| **Trajectory Entropy Deficit** | Bots move mice in straight lines | Calculates Shannon directional entropy; flags low-entropy artificial paths &rarr; `RESTRICT`. |
| **Chrome DevTools Protocol (CDP)** | Headless automation bindings in window | Inspects runtime CDP artifacts (`window.cdc_*`, `window.__playwright`) &rarr; `BLOCK`. |
| **Volumetric API Bursts** | 20+ requests in < 1 second | Sliding-window velocity detector flags `RESOURCE_ABUSE` &rarr; `BLOCK`. |
| **Sequential Resource Scraping** | Crawling `/api/users/1`, `/2`, `/3`... | Traversal pattern analyzer identifies monotonic ID iteration &rarr; `BLOCK`. |
| **Unauthorized Reconnaissance** | Probing `/api/admin/*`, `/.env`, debug endpoints | Policy engine immediately enforces priority `BLOCK` (HTTP 403). |
| **AI Bypass on Human Button** | Bot scripts try clicking the verification button | Rejects synthetic clicks; screen remains securely locked until a real human interacts. |

---

## 📄 License

Apache-2.0 © 2026 AgentShield Contributors.
