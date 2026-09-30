# agentshield-core

> **Runtime behavioral firewall for modern web applications and APIs.** Protects against unauthorized autonomous AI agents, headless browsers, automated scraping, and API abuse.

[![npm version](https://img.shields.io/npm/v/agentshield-core.svg)](https://www.npmjs.com/package/agentshield-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)

---

## 🌟 What is AgentShield?

AI autonomous agents, automated browsers (Playwright, Puppeteer), headless clients, and scraping crawlers now interact with web applications with human-like fidelity. Traditional IP rate limiting, WAF signatures, and simple bot checks fail to distinguish between authorized user journeys and malicious autonomous automation.

`agentshield-core` is an **all-in-one, privacy-first, zero-dependency behavioral security firewall** for Node.js, Express, Next.js, and web applications.

```
Detect behavior → calculate risk → understand intent → enforce policy.
```

- ⚡ **Zero External Dependencies**: 100% self-contained TypeScript library.
- 🛡️ **Zero Cloud / LLM Calls**: Evaluates requests locally in **< 1ms**.
- 🔒 **Privacy-First by Design**: Never inspects request bodies, form data, or passwords.
- 📦 **All-in-One Package**: Includes Backend Engine, Express Middleware, Next.js Adapter, and Browser Telemetry in one install.

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

## 🚀 Quick Starts

### 1. Express / Node.js Backend

```typescript
import express from 'express';
import { agentShield } from 'agentshield-core';

const app = express();

// Protect all routes with progressive behavioral enforcement
app.use(
  agentShield({
    mode: 'protect', // 'protect' | 'observe' | 'disabled'
    sensitivity: 'balanced', // 'lenient' | 'balanced' | 'strict'
    scoreThresholds: {
      challenge: 60,
      restrict: 75,
      block: 85,
    },
  })
);

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from secure endpoint' });
});

app.listen(3000);
```

### 2. Next.js (`middleware.ts`)

```typescript
import { createAgentShield } from 'agentshield-core';

const shield = createAgentShield({
  mode: 'protect',
  sensitivity: 'balanced',
});

export default shield.middleware();

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 3. Frontend Telemetry (React, Next.js, Vite, Vanilla JS)

```typescript
import { AgentShieldBrowser } from 'agentshield-core';

// In your root component or entry point
const shield = new AgentShieldBrowser({
  endpoint: '/_agentshield/events', // Automatic backend correlation endpoint
  batchIntervalMs: 10000,           // Batched passive telemetry every 10s
});

shield.start();
```

---

## 🧠 Behavioral Intent Classification

Rather than a simple binary "bot" flag, AgentShield classifies *intent* with calibrated confidence:

| Intent | Description |
| :--- | :--- |
| `NORMAL_BROWSING` | Standard human navigation and timing patterns. |
| `AUTOMATION` | Headless browser environment or automation drivers detected. |
| `RESOURCE_ENUMERATION` | Systematic incremental scanning (e.g. `/api/users/1`, `/api/users/2`...). |
| `RECONNAISSANCE` | Probing for unlinked routes, hidden endpoints, or 404 scanning. |
| `AUTH_PROBING` | Credential brute-forcing, password spraying, or auth fuzzing. |
| `RESOURCE_ABUSE` | Volumetric burst hammering and resource exhaustion patterns. |
| `API_USAGE` | Direct non-browser scripted API integration. |

---

## 📊 Explainable Risk Scoring (0 to 100)

Every decision includes a full audit breakdown:

```json
{
  "score": 78,
  "level": "HIGH_RISK",
  "intent": "RESOURCE_ENUMERATION",
  "action": "CHALLENGE",
  "reasons": [
    {
      "code": "HIGH_REQUEST_RATE",
      "weight": 20,
      "description": "Request frequency significantly exceeds normal session behavior"
    },
    {
      "code": "ENDPOINT_ENUMERATION",
      "weight": 25,
      "description": "Client accessed many resource endpoints sequentially"
    },
    {
      "code": "ABNORMAL_NAVIGATION_SPEED",
      "weight": 15,
      "description": "Navigation occurred significantly faster than observed human sessions"
    }
  ]
}
```

---

## 🚦 Progressive Mitigation

```
ALLOW → OBSERVE → THROTTLE → CHALLENGE → RESTRICT → BLOCK
```

- **ALLOW (0-20)**: Normal verified human sessions proceed instantly.
- **OBSERVE (21-40)**: Passive monitoring and telemetry collection.
- **THROTTLE (41-60)**: Automatically inserts an artificial delay (500ms) to attenuate burst automated scraping.
- **CHALLENGE (61-74)**: Returns HTTP `428 Precondition Required` with a lightweight, local computational challenge.
- **RESTRICT (75-84)**: Restricts access to sensitive routes.
- **BLOCK (85-100)**: Returns HTTP `403 Forbidden` for confirmed malicious probing.

---

## 🗺️ Application Behavior Graph

AgentShield models normal route transitions:
$$\text{Home} \longrightarrow \text{Products} \longrightarrow \text{Cart} \longrightarrow \text{Checkout}$$

When an automated script attempts an impossible direct leap:
$$\text{/} \longrightarrow \text{/api/admin/dump} \longrightarrow \text{/api/users/1} \longrightarrow \text{/api/users/2}$$

AgentShield flags an `ABNORMAL_APPLICATION_FLOW` anomaly and applies protective policies.

---

## 🛠️ Custom Policy Rules

```typescript
app.use(
  agentShield({
    policies: [
      {
        match: '/api/admin/*',
        action: 'BLOCK',
        minimumRisk: 40,
      },
      {
        match: '/api/checkout/*',
        method: 'POST',
        action: 'CHALLENGE',
        minimumRisk: 50,
      },
    ],
  })
);
```

---

## 🔒 Privacy & Data Minimization

AgentShield implements strict privacy invariants:
- **Never inspects**: Request bodies, form inputs, passwords, keystrokes, clipboard contents, screenshots, or DOM text.
- **IP Protection**: Raw client IPs are transformed into salted one-way hashes (`ipHash`).
- **No Cloud Leakage**: No telemetry ever leaves your server.

---

## 📄 License

Apache-2.0 © [Motiram Shinde](https://github.com/motiram944)
