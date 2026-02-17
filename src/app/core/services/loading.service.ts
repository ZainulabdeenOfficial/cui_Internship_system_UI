import { Injectable, signal } from '@angular/core';

/**
 * Global Loading Service using Angular Signals
 * Manages global loading spinner state
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private loadingCount = signal(0);
  public isLoading = signal(false);

  /**
   * Show global loading spinner
   */
  show(): void {
    this.loadingCount.update(count => count + 1);
    this.isLoading.set(true);
  }

  /**
   * Hide global loading spinner
   * Only hides when all loading operations are complete
   */
  hide(): void {
    this.loadingCount.update(count => {
      const newCount = Math.max(0, count - 1);
      if (newCount === 0) {
        this.isLoading.set(false);
      }
      return newCount;
    });
  }

  /**
   * Force hide all loading spinners
   */
  forceHide(): void {
    this.loadingCount.set(0);
    this.isLoading.set(false);
  }

  /**
   * Execute an async operation with loading state
   */
  async withLoading<T>(operation: () => Promise<T>): Promise<T> {
    this.show();
    try {
      return await operation();
    } finally {
      this.hide();
    }
  }
}
