import { Injectable } from '@angular/core';
import { finalize } from 'rxjs';

/**
 * Request Tracker Service
 * Tracks loading state for individual requests/operations
 * Useful for managing per-button or per-form loading states
 */
@Injectable({ providedIn: 'root' })
export class RequestTrackerService {
  private requestStates = new Map<string, { loading: boolean; error: any }>();

  /**
   * Get loading state for a specific request ID
   */
  isLoading(requestId: string): boolean {
    return this.requestStates.get(requestId)?.loading ?? false;
  }

  /**
   * Get error for a specific request ID
   */
  getError(requestId: string): any {
    return this.requestStates.get(requestId)?.error ?? null;
  }

  /**
   * Mark request as loading
   */
  startRequest(requestId: string): void {
    this.requestStates.set(requestId, { loading: true, error: null });
  }

  /**
   * Mark request as completed (success)
   */
  completeRequest(requestId: string): void {
    const state = this.requestStates.get(requestId);
    if (state) {
      state.loading = false;
      state.error = null;
    }
  }

  /**
   * Mark request as failed
   */
  failRequest(requestId: string, error: any): void {
    const state = this.requestStates.get(requestId);
    if (state) {
      state.loading = false;
      state.error = error;
    }
  }

  /**
   * Clear request state
   */
  clearRequest(requestId: string): void {
    this.requestStates.delete(requestId);
  }

  /**
   * Clear all request states
   */
  clearAll(): void {
    this.requestStates.clear();
  }

  /**
   * Execute async operation with automatic loading state management
   * Ensures loading state is always reset, even on error
   */
  async track<T>(
    requestId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startRequest(requestId);
    try {
      const result = await operation();
      this.completeRequest(requestId);
      return result;
    } catch (error) {
      this.failRequest(requestId, error);
      throw error;
    }
  }

  /**
   * Execute Observable-based operation with automatic loading state management
   */
  trackObservable<T>(
    requestId: string,
    operation: () => any
  ): any {
    this.startRequest(requestId);
    return operation().pipe(
      finalize(() => {
        const state = this.requestStates.get(requestId);
        if (state?.loading) {
          this.completeRequest(requestId);
        }
      })
    );
  }
}
