import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

export type LoadingKey = string;

/**
 * Skeleton Loader Service
 * Manages loading states for different content sections
 * Usage:
 *   this.skeletonLoader.setLoading('complaints', true);
 *   try {
 *     await api.call();
 *   } finally {
 *     this.skeletonLoader.setLoading('complaints', false);
 *   }
 */
@Injectable({ providedIn: 'root' })
export class SkeletonLoaderService {
  private loadingStates = new Map<LoadingKey, boolean>();

  isLoading(key: LoadingKey) {
    return this.loadingStates.get(key) ?? false;
  }

  setLoading(key: LoadingKey, isLoading: boolean) {
    this.loadingStates.set(key, isLoading);
  }

  /**
   * Convenience method to update loading state with async operation
   * Usage:
   *   await this.skeletonLoader.withLoading('complaints', async () => {
   *     await api.loadComplaints();
   *   });
   */
  async withLoading<T>(key: LoadingKey, fn: () => Promise<T>): Promise<T> {
    try {
      this.setLoading(key, true);
      return await fn();
    } finally {
      this.setLoading(key, false);
    }
  }

  /**
   * Reset all loading states
   */
  resetAll() {
    this.loadingStates.clear();
  }

  /**
   * Reset specific loading state
   */
  reset(key: LoadingKey) {
    this.loadingStates.delete(key);
  }
}
