/**
 * @file memory.ts
 * In-memory session store with TTL expiration and LRU-like safety limits.
 */

import type { AgentShieldStore, SessionState } from '../shared/index.js';

interface StoreEntry {
  session: SessionState;
  expiresAt: number;
}

export interface InMemoryStoreOptions {
  /** Maximum number of sessions held concurrently to prevent memory exhaustion */
  maxEntries?: number;
  /** Default TTL in seconds (default: 3600 seconds / 1 hour) */
  defaultTtlSeconds?: number;
}

export class InMemoryStore implements AgentShieldStore {
  private readonly entries = new Map<string, StoreEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlSeconds: number;

  constructor(options: InMemoryStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
  }

  async getSession(id: string): Promise<SessionState | null> {
    const entry = this.entries.get(id);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(id);
      return null;
    }

    return entry.session;
  }

  async saveSession(session: SessionState, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    // Guard against memory exhaustion via eviction
    if (this.entries.size >= this.maxEntries && !this.entries.has(session.id)) {
      this.evictExpiredOrOldest();
    }

    this.entries.set(session.id, {
      session,
      expiresAt,
    });
  }

  async deleteSession(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  /**
   * Helper to inspect active entry count.
   */
  get size(): number {
    return this.entries.size;
  }

  private evictExpiredOrOldest(): void {
    const now = Date.now();
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        return;
      }
      if (entry.session.lastSeenAt < oldestTime) {
        oldestTime = entry.session.lastSeenAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }
}
