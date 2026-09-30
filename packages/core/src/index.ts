/**
 * @file index.ts
 * Public entrypoint for @agentshield/core.
 */

export * from '@motiramshinde/agentshield-shared';

export { AgentShieldEngine, createDetectionEngine } from './engine.js';
export { InMemoryStore, type InMemoryStoreOptions } from './store/memory.js';
export { TypedEventBus } from './events/event-bus.js';
export { DefaultFeatureExtractor } from './features/extractor.js';
export { RuleBasedRiskModel, type RuleModelOptions } from './models/rules-model.js';
export { DefaultPolicyEngine, type PolicyEngineOptions } from './policy/policy-engine.js';
export { ApplicationBehaviorGraph } from './graph/behavior-graph.js';
export { LocalChallengeProvider } from './challenge/local-challenge.js';
