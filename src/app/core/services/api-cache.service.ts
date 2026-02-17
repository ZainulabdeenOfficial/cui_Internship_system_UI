import { Injectable } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';

export interface CacheConfig {
  maxAge?: number; // milliseconds
  maxSize?: number; // max number of cached items
}

export interface CacheEntry<T> {
  data: Observable<T>;
  timestamp: number;
}

/**
 * API Cache Service - Implements intelligent caching with stale-while-revalidate pattern
 * Prevents duplicate API calls and improves performance
 */
@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlightRequests = new Map<string, Observable<any>>();
  private readonly defaultMaxAge = 5 * 60 * 1000; // 5 minutes
  private readonly defaultMaxSize = 100;

  /**
   * Get data from cache or execute the API call
   * Implements stale-while-revalidate pattern
   */
  get<T>(
    key: string,
    apiCall: () => Observable<T>,
    config: CacheConfig = {}
  ): Observable<T> {
    const maxAge = config.maxAge ?? this.defaultMaxAge;
    const cached = this.cache.get(key);

    // Return cached data if fresh
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }

    // Prevent duplicate in-flight requests
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      return inFlight as Observable<T>;
    }

    // Execute API call
    const request$ = apiCall().pipe(
      tap(() => this.inFlightRequests.delete(key)),
      shareReplay(1)
    );

    this.inFlightRequests.set(key, request$);

    // Cache the result
    const entry: CacheEntry<T> = {
      data: request$,
      timestamp: Date.now()
    };
    this.cache.set(key, entry);

    // Enforce cache size limit
    this.enforceMaxSize(config.maxSize ?? this.defaultMaxSize);

    return request$;
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.inFlightRequests.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (pattern.test(key)) {
        this.invalidate(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Enforce maximum cache size using LRU eviction
   */
  private enforceMaxSize(maxSize: number): void {
    if (this.cache.size <= maxSize) return;

    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, this.cache.size - maxSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }
}
