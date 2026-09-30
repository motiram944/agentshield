/**
 * @file event-bus.ts
 * Framework-independent typed event bus for AgentShield.
 */

import type { AgentShieldEventMap, EventBus, EventCallback } from '@agentshield/shared';

export class TypedEventBus implements EventBus {
  private readonly listeners = new Map<keyof AgentShieldEventMap, Set<EventCallback<unknown>>>();

  on<K extends keyof AgentShieldEventMap>(
    event: K,
    listener: EventCallback<AgentShieldEventMap[K]>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const genericListener = listener as EventCallback<unknown>;
    set.add(genericListener);

    return () => {
      set?.delete(genericListener);
      if (set?.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  once<K extends keyof AgentShieldEventMap>(
    event: K,
    listener: EventCallback<AgentShieldEventMap[K]>
  ): () => void {
    const unsubscribe = this.on(event, async (data) => {
      unsubscribe();
      await listener(data);
    });
    return unsubscribe;
  }

  async emit<K extends keyof AgentShieldEventMap>(
    event: K,
    payload: AgentShieldEventMap[K]
  ): Promise<void> {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const listener of Array.from(set)) {
      try {
        const result = listener(payload);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              // Prevent unhandled rejection from killing main pipeline
              console.error(`[AgentShield EventBus Error on ${String(event)}]:`, err);
            })
          );
        }
      } catch (err) {
        console.error(`[AgentShield EventBus Sync Error on ${String(event)}]:`, err);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  removeAllListeners(event?: keyof AgentShieldEventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
