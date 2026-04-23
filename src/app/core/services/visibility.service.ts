import { Injectable, signal } from '@angular/core';

/**
 * Page Visibility API Service
 * Monitors when the app tab becomes visible/hidden and notifies services
 * Used to pause background operations (token refresh, polling) when tab is inactive
 */
@Injectable({ providedIn: 'root' })
export class VisibilityService {
  isVisible = signal(true);
  
  constructor() {
    this.initializeVisibilityListener();
  }

  private initializeVisibilityListener() {
    // Set initial state based on document.hidden
    this.isVisible.set(!document.hidden);
    
    // Listen to visibility changes (tab switch, minimize, etc.)
    // NOTE: We deliberately do NOT use window focus/blur — those fire on every
    // address-bar click, DevTools open, or context-menu, causing false toggles.
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      this.isVisible.set(nowVisible);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  get isAppVisible(): boolean {
    return this.isVisible();
  }
}
