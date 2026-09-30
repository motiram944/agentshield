# AgentShield

> **Runtime protection against unauthorized autonomous agents, automation, and abusive clients.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-yellow.svg)](https://vitest.dev/)

---

## What is AgentShield?

AI autonomous agents, automated browsers (Playwright, Puppeteer), headless clients, and scraping crawlers now interact with web applications with human-like fidelity. Traditional IP rate limiting, WAF signatures, and simple bot checks fail to distinguish between authorized user journeys and malicious autonomous automation.

AgentShield is a **privacy-first, local-first runtime behavioral firewall** for Node.js, Express, Next.js, and web applications. It does **not** rely on third-party cloud APIs, LLM calls, or intrusive user tracking.

```
Detect behavior → calculate risk → understand intent → enforce policy.
```

---

## Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| [`@agentshield/core`](./packages/core) | `0.1.0` | Algorithmic detection engine, anomaly analysis, graph engine, and policy evaluation. |
| [`@agentshield/node`](./packages/node) | `0.1.0` | Node.js and Express middleware with response throttling and challenge hooks. |
| [`@agentshield/next`](./packages/next) | `0.1.0` | Next.js App Router and Edge-compatible middleware adapter. |
| [`@agentshield/browser`](./packages/browser) | `0.1.0` | Ultra-lightweight (<5KB) client telemetry for behavioral correlation. |
| [`@agentshield/shared`](./packages/shared) | `0.1.0` | Shared domain models, contracts, and type definitions. |

---

## Quick Start (Express)

```bash
npm install @agentshield/node
```

```ts
import express from 'express';
import { agentShield } from '@agentshield/node';

const app = express();

// Protect endpoints using progressive behavioral enforcement
app.use(agentShield({
  mode: 'protect',
  sensitivity: 'balanced',
  scoreThresholds: {
    challenge: 60,
    restrict: 75,
    block: 85
  }
}));

app.get('/api/data', (req, res) => {
  res.json({ message: 'Secure payload' });
});

app.listen(3000);
```

---

## Behavioral Intent Classification

Rather than a binary "is bot" verdict, AgentShield classifies behavioral intent with calibrated confidence:

- `NORMAL_BROWSING`: Standard human navigation patterns.
- `AUTOMATION`: Scripted browser or automated runner.
- `API_USAGE`: Direct non-browser API integration.
- `ACCOUNT_AUTOMATION`: Scripted authentication or credential manipulation.
- `RECONNAISSANCE`: Probing for unlinked routes, hidden endpoints, or debug paths.
- `RESOURCE_ENUMERATION`: Systematic scanning across ID ranges or sequential resources.
- `AUTH_PROBING`: Credential stuffing, brute-forcing, or token fuzzing.
- `RESOURCE_ABUSE`: Rapid volumetric endpoint hammering.

---

## Explainable Risk Scoring (0–100)

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

## Progressive Mitigation Actions

```
ALLOW → OBSERVE → THROTTLE → CHALLENGE → RESTRICT → BLOCK
```

---

## Security & Defense-in-Depth

AgentShield is a runtime behavioral layer designed to complement existing security controls. It does not replace:
- Authentication & Authorization (RBAC/ABAC)
- Input sanitization and API validation
- CSRF protection
- Traditional network-layer firewalls

---

## License

Apache-2.0.
