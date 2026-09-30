# @agentshield/core

> **Core behavioral detection, anomaly scoring, and policy evaluation engine for AgentShield.** Framework-independent with zero external network or database dependencies.

[![npm version](https://img.shields.io/npm/v/@agentshield/core.svg)](https://www.npmjs.com/package/@agentshield/core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

---

## Overview

`@agentshield/core` is the deterministic evaluation brain powering AgentShield. It coordinates:
- Feature extraction from requests and session historical windows.
- Sequential ID traversal, burst request, and endpoint enumeration detection.
- Application Behavior Graph workflow verification.
- Calibrated intent classification.
- Explainable risk calculation (0–100).
- In-memory session tracking with TTL and LRU-like safety limits.

---

## Installation

```bash
npm install @agentshield/core
# or
pnpm add @agentshield/core
```

---

## Usage

```typescript
import { createDetectionEngine, type NormalizedRequest } from '@agentshield/core';

const engine = createDetectionEngine({
  mode: 'protect',
  sensitivity: 'balanced',
});

const result = await engine.analyze({
  id: 'req_123',
  timestamp: Date.now(),
  method: 'GET',
  url: 'https://example.com/api/users/1',
  pathname: '/api/users/1',
  queryParams: {},
  headers: {
    'user-agent': 'Mozilla/5.0 ...',
  },
  sessionId: 'user_session_abc',
});

console.log(result.riskScore); // { score: 0, level: 'NORMAL', reasons: [] }
console.log(result.intent);    // { intent: 'NORMAL_BROWSING', confidence: 0.96 }
console.log(result.action);    // 'ALLOW'
```

---

## License

Apache-2.0 © [Motiram Shinde](https://github.com/motiram944)
