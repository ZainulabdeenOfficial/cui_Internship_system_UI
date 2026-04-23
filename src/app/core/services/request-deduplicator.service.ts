import { Injectable } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { Observable, shareReplay, finalize } from 'rxjs';
import { LoadingService } from './loading.service';

/**
 * Request Deduplicator Service
 * Prevents duplicate concurrent identical GET requests.
 * Also ensures the LoadingService counter is kept in sync:
 * when a component unsubscribes mid-request (navigation), the spinner is force-hidden
 * so the counter never gets stuck above zero.
 */
@Injectable({ providedIn: 'root' })
export class RequestDeduplicatorService {
  private pendingRequests = new Map<string, Observable<any>>();
  // Track which in-flight keys are currently showing the global spinner
  private spinnerKeys = new Set<string>();

  constructor(private loadingService: LoadingService) {}

  deduplicate<T>(req: HttpRequest<any>, request$: Observable<T>): Observable<T> {
    if (req.method !== 'GET') {
      return request$;
    }

    const key = this.generateKey(req);
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Observable<T>;
    }

    const deduped$ = request$.pipe(
      shareReplay(1),
      finalize(() => {
        setTimeout(() => {
          this.pendingRequests.delete(key);
          // If this request was showing the spinner (not skipGlobalLoading),
          // ensure the spinner is hidden when the stream is fully torn down.
          // This handles the case where a component navigates away mid-request.
          if (this.spinnerKeys.has(key)) {
            this.spinnerKeys.delete(key);
            // Force the loading count to 0 if no other requests are pending
            if (this.pendingRequests.size === 0) {
              this.loadingService.forceHide();
            }
          }
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

  /** Called by the HTTP interceptor to mark that a request is showing the global spinner. */
  trackSpinner(key: string): void {
    this.spinnerKeys.add(key);
  }
}
