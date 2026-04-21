import { Injectable } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { Observable, shareReplay, finalize } from 'rxjs';

/**
 * Request Deduplicator Service
 * Prevents duplicate concurrent identical GET requests
 * If the same GET request is already in-flight, returns the same observable
 * Useful for when multiple components request the same data simultaneously
 */
@Injectable({ providedIn: 'root' })
export class RequestDeduplicatorService {
  private pendingRequests = new Map<string, Observable<any>>();

  /**
   * Deduplicate a request
   * If the same request is already in progress, returns the shared observable
   * Otherwise starts the request and caches it while in-flight
   */
  deduplicate<T>(req: HttpRequest<any>, request$: Observable<T>): Observable<T> {
    // Only deduplicate GET requests
    if (req.method !== 'GET') {
      return request$;
    }

    const key = this.generateKey(req);
    
    if (this.pendingRequests.has(key)) {
      console.log(`[RequestDedup] ⚡ Returning cached request for: ${key}`);
      return this.pendingRequests.get(key) as Observable<T>;
    }

    console.log(`[RequestDedup] 📡 Starting new request: ${key}`);
    
    // shareReplay(1) keeps the observable alive until all subscribers unsubscribe
    // This allows multiple components to subscribe and get the same result
    const deduped$ = request$.pipe(
      shareReplay(1),
      finalize(() => {
        // Clean up the cache entry after all subscribers have unsubscribed
        // Use setTimeout to ensure all micro-tasks complete
        setTimeout(() => {
          this.pendingRequests.delete(key);
          console.log(`[RequestDedup] 🧹 Cleaned up cache for: ${key}`);
        }, 100);
      })
    );

    this.pendingRequests.set(key, deduped$);
    return deduped$;
  }

  /**
   * Generate a unique key for a request
   * Key includes: method, URL, and normalized query string
   */
  private generateKey(req: HttpRequest<any>): string {
    const url = req.urlWithParams;
    return `${req.method}:${url}`;
  }

  /**
   * Manually clear all pending requests
   * Useful for logout or refresh token invalidation
   */
  clearCache(): void {
    console.log(`[RequestDedup] 🗑️ Clearing cache (${this.pendingRequests.size} pending requests)`);
    this.pendingRequests.clear();
  }

  /**
   * Get count of pending requests (for debugging)
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
