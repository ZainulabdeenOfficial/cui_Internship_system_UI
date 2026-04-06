import { Injectable } from '@angular/core';

/**
 * Async Operation Manager
 * Provides utilities for executing async operations with proper cleanup
 * Ensures loading states are always reset, even on errors
 */
@Injectable({ providedIn: 'root' })
export class AsyncOperationManager {
  /**
   * Execute an async operation with automatic loading state cleanup
   * Sets loading flag before operation, clears it after (success or error)
   * 
   * Usage:
   * const result = await this.asyncOp.execute(
   *   () => this.loadingFlag = true,
   *   () => this.loadingFlag = false,
   *   () => this.apiService.call()
   * );
   */
  async execute<T>(
    onStart: () => void,
    onEnd: () => void,
    operation: () => Promise<T>
  ): Promise<T> {
    onStart();
    try {
      const result = await operation();
      onEnd();
      return result;
    } catch (error) {
      onEnd();
      throw error;
    }
  }

  /**
   * Create a bound execution function for a specific loading flag
   * Returns a function that can be used to wrap async operations
   * 
   * Usage:
   * const trackLoading = this.asyncOp.createBoundExecutor(
   *   () => this.isLoading = true,
   *   () => this.isLoading = false
   * );
   * 
   * const result = await trackLoading(() => this.apiService.call());
   */
  createBoundExecutor(
    onStart: () => void,
    onEnd: () => void
  ): <T>(operation: () => Promise<T>) => Promise<T> {
    return <T,>(operation: () => Promise<T>) => {
      return this.execute(onStart, onEnd, operation);
    };
  }

  /**
   * Execute with ref updates
   * Useful for triggering change detection in components
   * 
   * Usage in component with `cdr: ChangeDetectorRef`:
   * await this.asyncOp.executeWithRefresh(
   *   () => { ... },
   *   () => { ... },
   *   () => { ... },
   *   () => this.cdr.markForCheck()
   * );
   */
  async executeWithRefresh<T>(
    onStart: () => void,
    onEnd: () => void,
    operation: () => Promise<T>,
    onRefresh?: () => void
  ): Promise<T> {
    onStart();
    try {
      const result = await operation();
      onEnd();
      onRefresh?.();
      return result;
    } catch (error) {
      onEnd();
      onRefresh?.();
      throw error;
    }
  }

  /**
   * Create a wrapper for a promise-returning function
   * Automatically handles loading state
   * 
   * Usage:
   * const wrappedFunction = this.asyncOp.wrapAsync(
   *   this.apiService.submit.bind(this.apiService),
   *   () => this.isLoading = true,
   *   () => this.isLoading = false
   * );
   * 
   * const result = await wrappedFunction(arg1, arg2);
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    onStart: () => void,
    onEnd: () => void
  ): (...args: T) => Promise<R> {
    return async (...args: T) => {
      return this.execute(onStart, onEnd, () => fn(...args));
    };
  }

  /**
   * Create a button click handler wrapper
   * Prevents double-clicks and manages loading state
   * 
   * Usage in template:
   * <button (click)="handleClick($event)" [disabled]="isLoading">Submit</button>
   * 
   * In component:
   * async handleClick(event: Event) {
   *   event.preventDefault();
   *   await this.asyncOp.executeClickHandler(
   *     () => this.isLoading = true,
   *     () => this.isLoading = false,
   *     () => this.performAction()
   *   );
   * }
   */
  async executeClickHandler(
    onStart: () => void,
    onEnd: () => void,
    operation: () => Promise<void>
  ): Promise<void> {
    onStart();
    try {
      await operation();
    } catch (error) {
      // Error should be handled by caller or error handler
      throw error;
    } finally {
      onEnd();
    }
  }

  /**
   * Multi-operation wrapper
   * Execute multiple sequential operations with single loading state
   * 
   * Usage:
   * await this.asyncOp.executeSequential(
   *   () => this.isLoading = true,
   *   () => this.isLoading = false,
   *   [
   *     () => this.operation1(),
   *     () => this.operation2(),
   *     () => this.operation3()
   *   ]
   * );
   */
  async executeSequential<T>(
    onStart: () => void,
    onEnd: () => void,
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    onStart();
    try {
      const results: T[] = [];
      for (const op of operations) {
        results.push(await op());
      }
      onEnd();
      return results;
    } catch (error) {
      onEnd();
      throw error;
    }
  }
}
