/**
 * @file index.ts
 * Main entrypoint for agentshield-core.
 * Complete all-in-one behavioral security platform for modern web applications and APIs.
 */

// 1. Shared Types, Models, Enums, and Contracts
export * from './shared/index.js';

// 2. Core Behavioral Detection Engine
export { AgentShieldEngine, createDetectionEngine } from './engine.js';
export { InMemoryStore, type InMemoryStoreOptions } from './store/memory.js';
export { TypedEventBus } from './events/event-bus.js';
export { DefaultFeatureExtractor } from './features/extractor.js';
export { RuleBasedRiskModel, type RuleModelOptions } from './models/rules-model.js';
export { DefaultPolicyEngine, type PolicyEngineOptions } from './policy/policy-engine.js';
export { ApplicationBehaviorGraph } from './graph/behavior-graph.js';
export { LocalChallengeProvider } from './challenge/local-challenge.js';

// 3. Express & Node.js Runtime Integration
export { agentShield, type AgentShieldNodeOptions } from './node/index.js';

// 4. Browser Behavioral Telemetry SDK
export {
  AgentShieldBrowser,
  initAgentShieldBrowser,
  type AgentShieldBrowserOptions,
} from './browser/index.js';

// 5. Next.js App Router, Route Handlers & Edge Middleware Adapter
export {
  NextAgentShield,
  createAgentShield,
  type NextAgentShieldOptions,
} from './next/index.js';
