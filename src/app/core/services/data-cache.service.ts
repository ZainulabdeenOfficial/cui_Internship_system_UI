import { Injectable } from '@angular/core';

/**
 * DataCacheService
 *
 * Prevents the global loading spinner from showing every time a user
 * navigates back to an already-loaded route/tab.
 *
 * Usage:
 *   if (this.cache.isFresh('announcements')) return; // skip fetch
 *   await this.store.loadAnnouncements();
 *   this.cache.mark('announcements');
 *
 * A cache entry expires after `ttlMs` (default 5 minutes).
 * Call `invalidate(key)` to force a fresh load (e.g. after mutations).
 */
@Injectable({ providedIn: 'root' })
export class DataCacheService {
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private entries = new Map<string, number>(); // key → timestamp of last successful fetch

  /**
   * Returns true if data for `key` was loaded recently (within TTL).
   * When true, callers should skip the HTTP call (and the loading spinner).
   */
  isFresh(key: string, ttlMs = this.DEFAULT_TTL_MS): boolean {
    const ts = this.entries.get(key);
    if (ts === undefined) return false;
    return Date.now() - ts < ttlMs;
  }

  /**
   * Record a successful fetch for `key`.
   * Call this AFTER the data has been successfully retrieved.
   */
  mark(key: string): void {
    this.entries.set(key, Date.now());
  }

  /**
   * Force the next access to re-fetch (e.g. after a POST/PUT/DELETE).
   */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Invalidate all cache entries (e.g. on logout).
   */
  invalidateAll(): void {
    this.entries.clear();
  }
}
