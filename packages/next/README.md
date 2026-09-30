# @agentshield/next

> **Next.js App Router, Route Handlers, and Edge Middleware integration for AgentShield.**

[![npm version](https://img.shields.io/npm/v/@agentshield/next.svg)](https://www.npmjs.com/package/@agentshield/next)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

---

## Features

- ⚡ **Next.js Middleware Ready:** Easily drop into `middleware.ts`.
- 🌐 **Edge Runtime Compatible:** Works across Vercel Edge, Node.js SSR, and API route handlers.
- 🛡️ **Progressive Mitigation:** Automatically blocks or challenges malicious autonomous clients before your React components render.

---

## Installation

```bash
npm install @agentshield/next
# or
pnpm add @agentshield/next
```

---

## Usage (`middleware.ts`)

```typescript
import { createAgentShield } from '@agentshield/next';

const shield = createAgentShield({
  mode: 'protect',
  sensitivity: 'balanced',
  scoreThresholds: {
    challenge: 60,
    restrict: 75,
    block: 85,
  },
});

export default shield.middleware();

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## License

Apache-2.0 © [Motiram Shinde](https://github.com/motiram944)
