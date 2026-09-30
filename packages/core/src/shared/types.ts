/**
 * @file types.ts
 * Core domain types and contracts for AgentShield.
 */

/**
 * Normalized risk tiers ranging from safe to actively malicious.
 */
export type RiskLevel =
  | 'NORMAL'
  | 'LOW_RISK'
  | 'SUSPICIOUS'
  | 'HIGH_RISK'
  | 'CRITICAL';

/**
 * High-level intent classification for detected client activity.
 */
export type AgentIntent =
  | 'NORMAL_BROWSING'
  | 'AUTOMATION'
  | 'STEALTH_AUTOMATION'
  | 'API_USAGE'
  | 'ACCOUNT_AUTOMATION'
  | 'RECONNAISSANCE'
  | 'RESOURCE_ENUMERATION'
  | 'AUTH_PROBING'
  | 'RESOURCE_ABUSE'
  | 'UNKNOWN';

/**
 * Enforcement actions supported by AgentShield policy engine.
 */
export type ShieldAction =
  | 'ALLOW'
  | 'OBSERVE'
  | 'THROTTLE'
  | 'CHALLENGE'
  | 'RESTRICT'
  | 'BLOCK';

/**
 * Operational mode of the AgentShield runtime.
 * - observe: Evaluate and log without blocking/challenging clients.
 * - protect: Enforce actions (throttle, challenge, block) based on policy and risk.
 * - disabled: Completely bypass detection and policy logic.
 */
export type ShieldMode = 'observe' | 'protect' | 'disabled';

/**
 * Preset sensitivity tuning for risk scoring thresholds and anomaly tolerances.
 */
export type ShieldSensitivity = 'lenient' | 'balanced' | 'strict';

/**
 * Granular explanation of why a risk score was incremented.
 */
export interface RiskReason {
  /** Identifier code for the rule or heuristic (e.g. HIGH_REQUEST_RATE) */
  code: string;
  /** Numerical weight contributed to the final score */
  weight: number;
  /** Human-readable explanation */
  description: string;
  /** Contextual non-sensitive metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Comprehensive risk evaluation result with explainability breakdown.
 */
export interface RiskScore {
  /** Normalized score from 0 (completely normal) to 100 (critical threat) */
  score: number;
  /** Categorized risk tier */
  level: RiskLevel;
  /** Array of contributing reasons explaining the score */
  reasons: RiskReason[];
}

/**
 * Result of behavioral intent prediction.
 */
export interface IntentPrediction {
  /** Primary predicted intent */
  intent: AgentIntent;
  /** Confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Optional secondary candidates */
  secondaryIntents?: Array<{
    intent: AgentIntent;
    confidence: number;
  }>;
}

/**
 * Privacy-first normalized HTTP request abstraction.
 * Note: Never contains passwords, request bodies by default, form data, or sensitive PII.
 */
export interface NormalizedRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  pathname: string;
  queryParams: Record<string, string | string[]>;
  headers: Record<string, string | undefined>;
  userAgent?: string;
  sessionId?: string;
  /** Privacy-preserving one-way hash of client IP (never raw IP) */
  ipHash?: string;
  /** Boolean indicating whether client has a verified auth session */
  isAuthenticated?: boolean;
  /** Privacy-preserving hash of user identity if authenticated */
  userIdHash?: string;
  /** Role string if authenticated (e.g. 'admin', 'user', 'guest') */
  userRole?: string;
  /** Optional route parameters matched by framework */
  routeParams?: Record<string, string>;
}

/**
 * Privacy-safe telemetry emitted by @agentshield/browser.
 * Strictly captures timing, interaction metrics, and environment flags.
 * Never captures keystrokes, form text, or DOM text.
 */
export interface BrowserSignalPayload {
  version: string;
  sessionId: string;
  timestamp: number;
  /** Navigation timing indicators */
  navigationTiming?: {
    domComplete?: number;
    domInteractive?: number;
    loadEventEnd?: number;
    timeToFirstClick?: number;
    pageTransitionDurationMs?: number;
  };
  /** Interaction heuristics */
  interactionStats?: {
    pointerMoveCount: number;
    pointerEntropy: number;
    clickCount: number;
    meanClickIntervalMs: number;
    scrollCount: number;
    visibilityChangeCount: number;
    windowFocusCount: number;
  };
  /** Browser automation flags (evaluates navigator.webdriver, mock plugins, etc.) */
  automationFlags?: {
    hasWebDriver: boolean;
    hasAutomationGlobals: boolean;
    hasConsistentPlugins: boolean;
    hasConsistentLanguages: boolean;
    hasHeadlessScreenDims: boolean;
    hasTamperedUserAgent: boolean;
    isWebDriverSpoofed?: boolean;
    hasCdpArtifacts?: boolean;
    isTeleportedClick?: boolean;
    clickDwellTimeMs?: number;
    biometricAnomaly?: boolean;
    humanLikelihoodScore?: number;
  };
  /** Client environment metadata (non-fingerprinting) */
  clientContext?: {
    screenWidth: number;
    screenHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    language: string;
    timezoneOffset: number;
  };
}

/**
 * Historical record of a single request stored in the session window.
 */
export interface SessionRequestRecord {
  id: string;
  timestamp: number;
  method: string;
  pathname: string;
  statusCode?: number;
  durationMs?: number;
  riskScore?: number;
}

/**
 * Stateful tracking object for an observed client session.
 */
export interface SessionState {
  id: string;
  createdAt: number;
  lastSeenAt: number;
  requestCount: number;
  recentRequests: SessionRequestRecord[];
  /** Latest computed risk score */
  riskScore: number;
  /** Latest computed risk level */
  riskLevel: RiskLevel;
  /** Latest classified intent */
  detectedIntent: AgentIntent;
  /** Active enforcement action applied to session */
  action: ShieldAction;
  /** Latest browser-side signals received, if correlated */
  browserSignals?: BrowserSignalPayload;
  /** Graph transition history for abnormal flow detection */
  flowHistory: string[];
  /** Additional non-sensitive operational metadata */
  metadata: Record<string, unknown>;
}

/**
 * Numerical and categorical features extracted from request + session history
 * for evaluation by RuleBasedModel, StatisticalModel, or external ML models.
 */
export interface FeatureVector {
  requestRatePerMinute: number;
  burstRatePer10Sec: number;
  uniqueEndpointCount: number;
  error404Ratio: number;
  apiEndpointRatio: number;
  sequentialResourceIdCount: number;
  adminEndpointAccessCount: number;
  debugEndpointAccessCount: number;
  authFailureCount: number;
  sessionDurationSeconds: number;
  meanNavigationIntervalMs: number;
  interactionVariance: number;
  hasAutomationIndicators: boolean;
  isHeadlessBrowser: boolean;
  hasStealthAutomation?: boolean;
  isTeleportedClick?: boolean;
  biometricAnomaly?: boolean;
  graphTransitionAnomaly: boolean;
  hasSessionAnomaly: boolean;
}

/**
 * Policy matching rule definition.
 */
export interface PolicyRule {
  /** Pathname pattern string (e.g. '/api/admin/*') or RegExp */
  match: string | RegExp;
  /** HTTP method or methods to match (defaults to all) */
  method?: string | string[];
  /** Minimum risk score to trigger this policy (0-100) */
  minimumRisk?: number;
  /** Minimum risk level required to trigger */
  minimumLevel?: RiskLevel;
  /** Action to take when condition is met */
  action: ShieldAction;
  /** Specific intents that should trigger this action */
  targetedIntents?: AgentIntent[];
  /** Excluded intents */
  excludedIntents?: AgentIntent[];
  /** Optional custom priority (higher values evaluated first) */
  priority?: number;
  /** Optional policy rule identifier */
  id?: string;
}

/**
 * Configurable thresholds for progressive risk escalation.
 */
export interface ScoreThresholds {
  challenge: number;
  restrict: number;
  block: number;
}

/**
 * Privacy controls and data minimization settings.
 */
export interface PrivacyConfig {
  /** Allow correlating browser behavioral signals */
  collectBrowserSignals: boolean;
  /** Whether to retain hashed IP address for rate/session analysis */
  hashIp: boolean;
  /** Never collect request bodies */
  collectRequestBody: false;
  /** Never collect form contents */
  collectFormData: false;
}

/**
 * Active detection rules configuration.
 */
export interface RuleToggles {
  highRequestRate?: boolean;
  burstRequests?: boolean;
  endpointEnumeration?: boolean;
  sequentialIdEnumeration?: boolean;
  reconnaissance404?: boolean;
  adminProbing?: boolean;
  debugProbing?: boolean;
  authProbing?: boolean;
  apiAbuse?: boolean;
  browserAutomation?: boolean;
  abnormalWorkflow?: boolean;
}

/**
 * Complete AgentShield configuration options.
 */
export interface ShieldConfig {
  /** Operational mode */
  mode?: ShieldMode;
  /** Sensitivity level */
  sensitivity?: ShieldSensitivity;
  /** Thresholds for challenge, restrict, and block */
  scoreThresholds?: ScoreThresholds;
  /** Privacy controls */
  privacy?: Partial<PrivacyConfig>;
  /** Enabled rules */
  rules?: RuleToggles;
  /** Custom policy rules list */
  policies?: PolicyRule[];
  /** Storage driver type or custom instance */
  store?: 'memory' | 'redis' | unknown;
  /** Enable or disable console logging */
  logger?: boolean | ((log: SecurityLogEntry) => void);
  /** Custom session identifier header name */
  sessionHeaderName?: string;
  /** Client token verification secret (for tamper-evident browser payloads) */
  secret?: string;
}

/**
 * Full evaluation output generated per inspected request.
 */
export interface AnalysisResult {
  requestId: string;
  sessionId: string;
  timestamp: number;
  mode: ShieldMode;
  riskScore: RiskScore;
  intent: IntentPrediction;
  action: ShieldAction;
  policyMatched?: PolicyRule;
  throttleDelayMs?: number;
  challengeRequired?: boolean;
  challengeToken?: string;
  explanation: string[];
}

/**
 * Structured security audit log entry.
 */
export interface SecurityLogEntry {
  timestamp: string;
  requestId: string;
  sessionId: string;
  route: string;
  method: string;
  riskScore: number;
  riskLevel: RiskLevel;
  intent: AgentIntent;
  action: ShieldAction;
  reasons: RiskReason[];
}
