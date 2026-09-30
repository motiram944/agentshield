# @agentshield/browser

> **Lightweight (< 5KB), privacy-first browser behavioral telemetry SDK for AgentShield.**

[![npm version](https://img.shields.io/npm/v/@agentshield/browser.svg)](https://www.npmjs.com/package/@agentshield/browser)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

---

## Features

- 🔒 **Zero Invasive Tracking:** Strictly analyzes interaction entropy, pointer intervals, and automation markers. Never captures form text, keystrokes, DOM text, or passwords.
- ⚡ **Ultra-lightweight:** Zero external dependencies. Target payload size < 5KB.
- 📡 **Batched & Passive:** Non-blocking telemetry sent via `navigator.sendBeacon` or fetch keepalive.

---

## Installation

```bash
npm install @agentshield/browser
# or
pnpm add @agentshield/browser
```

---

## Usage

```typescript
import { AgentShieldBrowser } from '@agentshield/browser';

const shield = new AgentShieldBrowser({
  sessionId: 'your_session_id', // optional, automatically generated if omitted
  endpoint: '/_agentshield/events',
  batchIntervalMs: 10000,
});

shield.start();
```

---

## License

Apache-2.0 © [Motiram Shinde](https://github.com/motiram944)
