/**
 * @file behavior-graph.ts
 * Application Behavior Graph engine for workflow validation and abnormal flow detection.
 */

import type {
  ApplicationGraphDefinition,
  FlowAnomalyResult,
  GraphEdge,
  GraphNode,
} from '@agentshield/shared';

export class ApplicationBehaviorGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();
  private readonly entryNodes = new Set<string>();

  constructor(definition?: ApplicationGraphDefinition) {
    if (definition) {
      this.loadDefinition(definition);
    }
  }

  loadDefinition(def: ApplicationGraphDefinition): void {
    for (const node of def.nodes) {
      this.nodes.set(node.id, node);
    }
    for (const edge of def.edges) {
      const key = this.edgeKey(edge.fromNodeId, edge.toNodeId);
      this.edges.set(key, edge);
    }
    for (const entry of def.entryNodes) {
      this.entryNodes.add(entry);
    }
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(fromNodeId: string, toNodeId: string, isPermitted = true): void {
    const key = this.edgeKey(fromNodeId, toNodeId);
    const existing = this.edges.get(key);
    this.edges.set(key, {
      fromNodeId,
      toNodeId,
      frequency: (existing?.frequency ?? 0) + 1,
      isPermitted,
    });
  }

  addEntryNode(nodeId: string): void {
    this.entryNodes.add(nodeId);
  }

  /**
   * Observe and record a normal transition (online learning).
   */
  learnTransition(fromRoute: string, toRoute: string): void {
    const fromId = this.matchNodeId(fromRoute) ?? fromRoute;
    const toId = this.matchNodeId(toRoute) ?? toRoute;

    if (!this.nodes.has(fromId)) {
      this.nodes.set(fromId, { id: fromId, routePattern: fromRoute, isApi: fromRoute.startsWith('/api/'), requiresAuth: false });
    }
    if (!this.nodes.has(toId)) {
      this.nodes.set(toId, { id: toId, routePattern: toRoute, isApi: toRoute.startsWith('/api/'), requiresAuth: false });
    }

    const key = this.edgeKey(fromId, toId);
    const edge = this.edges.get(key);
    if (edge) {
      edge.frequency = (edge.frequency ?? 0) + 1;
    } else {
      this.edges.set(key, {
        fromNodeId: fromId,
        toNodeId: toId,
        frequency: 1,
        isPermitted: true,
      });
    }
  }

  /**
   * Evaluates if a route transition is abnormal.
   */
  evaluateTransition(
    fromRoute: string | undefined,
    toRoute: string,
    isAuthenticated = false
  ): FlowAnomalyResult {
    const toNodeId = this.matchNodeId(toRoute) ?? toRoute;
    const targetNode = this.nodes.get(toNodeId);

    // If target requires authentication but client is unauthenticated
    if (targetNode?.requiresAuth && !isAuthenticated) {
      return {
        isAnomaly: true,
        score: 35,
        reason: `Target route '${toRoute}' requires authenticated state`,
        toNodeId,
      };
    }

    // Direct entry check
    if (!fromRoute) {
      if (this.entryNodes.size > 0 && !this.entryNodes.has(toNodeId)) {
        // Direct jump into non-entry sensitive endpoint
        if (targetNode?.isSensitive || targetNode?.id.includes('admin') || targetNode?.id.includes('checkout')) {
          return {
            isAnomaly: true,
            score: 25,
            reason: `Direct unreferenced entry into sensitive endpoint '${toRoute}' without prior browsing history`,
            toNodeId,
          };
        }
      }
      return { isAnomaly: false, score: 0 };
    }

    const fromNodeId = this.matchNodeId(fromRoute) ?? fromRoute;
    const key = this.edgeKey(fromNodeId, toNodeId);
    const edge = this.edges.get(key);

    if (edge && !edge.isPermitted) {
      return {
        isAnomaly: true,
        score: 30,
        reason: `Prohibited workflow jump from '${fromRoute}' to '${toRoute}'`,
        fromNodeId,
        toNodeId,
      };
    }

    return {
      isAnomaly: false,
      score: 0,
    };
  }

  private matchNodeId(pathname: string): string | undefined {
    for (const [id, node] of this.nodes.entries()) {
      if (node.routePattern === pathname) {
        return id;
      }
      // Simple glob/prefix match
      if (node.routePattern.endsWith('/*') && pathname.startsWith(node.routePattern.slice(0, -2))) {
        return id;
      }
    }
    return undefined;
  }

  private edgeKey(from: string, to: string): string {
    return `${from}->${to}`;
  }
}
