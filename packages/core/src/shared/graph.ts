/**
 * @file graph.ts
 * Application Behavior Graph data models and transition rules.
 */

export interface GraphNode {
  id: string;
  routePattern: string;
  isApi: boolean;
  requiresAuth: boolean;
  requiredRole?: string;
  isSensitive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  fromNodeId: string;
  toNodeId: string;
  /** Observed transition count for learning */
  frequency?: number;
  /** Weight or probability of transition (0.0 - 1.0) */
  probability?: number;
  /** Whether this edge is marked explicitly valid */
  isPermitted: boolean;
}

export interface ApplicationGraphDefinition {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Allowed entry points without prior flow history */
  entryNodes: string[];
}

export interface FlowAnomalyResult {
  isAnomaly: boolean;
  score: number;
  reason?: string;
  fromNodeId?: string;
  toNodeId?: string;
}
