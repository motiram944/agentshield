# @motiramshinde/agentshield-node

> **Runtime behavioral firewall middleware for Express and Node.js applications.** Protects against unauthorized autonomous AI agents, headless browsers, automated scraping, and API abuse.

[![npm version](https://img.shields.io/npm/v/@motiramshinde/agentshield-node.svg)](https://www.npmjs.com/package/@motiramshinde/agentshield-node)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

---

## Features

- 🛡️ **Zero Cloud / Zero External API:** Runs 100% locally in your Node process with sub-millisecond execution latency.
- 🤖 **Behavioral Intent Classification:** Identifies whether requests are normal browsing, automated scrapers, sequential ID scanners, or credential probers.
- 📊 **Explainable Risk Scoring (0–100):** Every decision provides granular reasoning weights and contributing heuristic codes.
- 🔒 **Privacy-First by Design:** Never inspects request bodies, form data, or passwords. Uses salted one-way hashing for IP addresses.
- ⚡ **Progressive Mitigation:** Seamlessly transitions from `ALLOW` → `OBSERVE` → `THROTTLE` → `CHALLENGE` → `RESTRICT` → `BLOCK`.

---

## Installation

```bash
npm install @motiramshinde/agentshield-node
# or
pnpm add @motiramshinde/agentshield-node
# or
yarn add @motiramshinde/agentshield-node
```

---

## Quick Start (Express)

```typescript
import express from 'express';
import { agentShield } from '@motiramshinde/agentshield-node';

const app = express();

// Protect all routes with AgentShield
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

app.get('/api/products', (req, res) => {
  res.json({ message: 'Success' });
});

app.listen(3000, () => {
  console.log('Server protected by AgentShield running on port 3000');
});
```

---

## Custom Policies

Define granular routing rules based on path patterns, HTTP methods, and minimum risk thresholds:

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
        match: '/api/delete/*',
        method: 'POST',
        action: 'CHALLENGE',
        minimumRisk: 50,
      },
    ],
  })
);
```

---

## Audit Headers

`@motiramshinde/agentshield-node` automatically attaches inspection headers to every response:

- `X-AgentShield-Risk`: Normalized risk score (0–100).
- `X-AgentShield-Action`: Enforced action (`ALLOW`, `OBSERVE`, `THROTTLE`, `CHALLENGE`, `RESTRICT`, `BLOCK`).
- `X-AgentShield-Session`: Correlated session identifier.

---

## License

Apache-2.0 © [Motiram Shinde](https://github.com/motiram944)
