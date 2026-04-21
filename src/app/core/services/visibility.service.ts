import { Injectable, signal, effect } from '@angular/core';

/**
 * Page Visibility API Service
 * Monitors when the app tab becomes visible/hidden and notifies services
 * Used to pause background operations (token refresh, polling) when tab is inactive
 */
@Injectable({ providedIn: 'root' })
export class VisibilityService {
  isVisible = signal(true);
  
  constructor() {
    effect(() => {
      const visible = this.isVisible();
      console.log(`[Visibility] App is now ${visible ? 'VISIBLE' : 'HIDDEN'}`);
    });
    
    this.initializeVisibilityListener();
  }

  private initializeVisibilityListener() {
    // Set initial state based on document.hidden
    this.isVisible.set(!document.hidden);
    
    // Listen to visibility changes (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      console.log(`[Visibility] visibilitychange: hidden=${document.hidden}, updating signal to ${nowVisible}`);
      this.isVisible.set(nowVisible);
      
      if (nowVisible) {
        console.log('[Visibility] App restored from hidden state');
        this.onAppRestored();
      } else {
        console.log('[Visibility] App hidden');
        this.onAppHidden();
      }
    };
    
    // Window focus/blur (browser window or whole OS focus)
    const handleFocus = () => {
      console.log('[Visibility] Window focus event');
      this.isVisible.set(true);
      this.onAppRestored();
    };
    
    const handleBlur = () => {
      console.log('[Visibility] Window blur event');
      this.isVisible.set(false);
      this.onAppHidden();
    };
    
    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    // Cleanup (in practice, these would need to be stored for cleanup on service destroy)
    // For root service, cleanup is less critical but can be added if needed
  }

  private onAppRestored() {
    // This callback is triggered when the app regains visibility
    // Services can subscribe to isVisible signal and react to visibility changes
    console.log('[Visibility] Visibility listeners should resume background tasks');
  }

  private onAppHidden() {
    // This callback is triggered when the app loses visibility
    console.log('[Visibility] Visibility listeners should pause background tasks');
  }
}
