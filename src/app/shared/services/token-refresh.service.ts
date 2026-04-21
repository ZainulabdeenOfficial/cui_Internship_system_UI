import { Injectable, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { VisibilityService } from '../../core/services/visibility.service';

@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private timer: any = null;
  private lastTokenHash = '';
  private readonly skewMs = 120_000; // refresh 2 minutes before expiry for safety
  private watcher: any = null;
  private isPaused = false;
  private isInitialized = false;

  constructor(
    private auth: AuthService,
    private visibility: VisibilityService
  ) {
    // Pause/resume token refresh when app visibility changes
    effect(() => {
      const isVisible = this.visibility.isVisible();
      if (this.isInitialized) {
        if (!isVisible) {
          this.pause();
        } else {
          this.resume();
        }
      }
    });
  }

  /**
   * Initialize token refresh service
   * Only starts refresh cycle if user has a valid token (i.e., is logged in)
   * Called from APP_INITIALIZER on app startup
   */
  init() {
    const hasValidToken = this.getToken();
    if (!hasValidToken) {
      console.log('[TokenRefresh] No token on init - deferring start (user not logged in)');
      return;
    }
    console.log('[TokenRefresh] Valid token found - starting refresh cycle');
    this.start();
  }

  /**
   * Explicitly start the token refresh cycle
   * Called after successful login
   */
  start() {
    if (this.isInitialized) {
      console.log('[TokenRefresh] Already initialized, skipping start()');
      return;
    }
    this.isInitialized = true;
    // watch token changes periodically and reschedule
    if (this.watcher) clearInterval(this.watcher);
    this.watcher = setInterval(() => {
      if (!this.isPaused) {
        this.ensureSchedule();
      }
    }, 10_000);
    this.ensureSchedule();
  }

  /**
   * Stop the token refresh service completely
   * Called on logout
   */
  stop() {
    console.log('[TokenRefresh] Stopping refresh service');
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.watcher) { clearInterval(this.watcher); this.watcher = null; }
    this.lastTokenHash = '';
    this.isInitialized = false;
    this.isPaused = false;
  }

  /**
   * Pause token refresh without stopping completely
   * Used when app becomes hidden (tab switch, minimize, etc.)
   */
  private pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    console.log('[TokenRefresh] ⏸️ Paused - app is hidden');
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Resume token refresh after app regains visibility
   * Reschedules based on current token expiry
   */
  private resume() {
    if (!this.isPaused || !this.isInitialized) return;
    this.isPaused = false;
    console.log('[TokenRefresh] ▶️ Resumed - app is visible');
    this.ensureSchedule();
  }

  private getToken(): string | null {
    try {
      return sessionStorage.getItem('authToken')
        || sessionStorage.getItem('accessToken')
        || sessionStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('accessToken');
    } catch { return null; }
  }

  private decodeExpMs(token: string): number | null {
    try {
      const parts = token.split('.'); if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
      const json = atob(base64 + pad);
      const payload = JSON.parse(json);
      if (payload && typeof payload.exp === 'number') return payload.exp * 1000;
      return null;
    } catch { return null; }
  }

  private hashToken(tok: string | null): string {
    if (!tok) return '';
    let h = 0; for (let i = 0; i < tok.length; i++) { h = ((h << 5) - h) + tok.charCodeAt(i); h |= 0; }
    return String(h);
  }

  private ensureSchedule() {
    const tok = this.getToken();
    const currentHash = this.hashToken(tok);
    if (currentHash !== this.lastTokenHash) {
      this.lastTokenHash = currentHash;
      this.scheduleFromToken(tok);
    }
    // also if no timer active (e.g., first load), try schedule
    if (!this.timer) this.scheduleFromToken(tok);
  }

  private scheduleFromToken(tok: string | null) {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!tok) return; // nothing to schedule
    const expMs = this.decodeExpMs(tok);
    if (!expMs) return;
    const now = Date.now();
    let delay = expMs - now - this.skewMs;
    if (delay < 5_000) delay = 5_000; // minimum 5s
    this.timer = setTimeout(() => this.refreshAndReschedule(), delay);
  }

  private async refreshAndReschedule() {
    try {
      // Check if refresh token exists before attempting
      const hasRefreshToken = localStorage.getItem('refreshToken');
      if (!hasRefreshToken) {
        // User is not logged in - silently stop (expected behavior)
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        return;
      }
      
      console.log('🔄 [TokenRefresh] Attempting scheduled token refresh...');
      
      const result = await this.auth.refreshAccessToken();
      
      // Verify we got a valid response with token
      if (result && (result.accessToken || (result as any).token)) {
        console.log('✅ [TokenRefresh] Token refreshed successfully before expiry:', {
          accessToken: !!(result.accessToken || (result as any).token),
          refreshToken: !!(result.refreshToken || (result as any).refreshToken)
        });
        
        // token saved by AuthService.refreshAccessToken; reschedule with new token
        this.timer = null;
        this.lastTokenHash = ''; // Force re-evaluation
        this.ensureSchedule();
      } else {
        console.warn('⚠️ [TokenRefresh] Invalid refresh response, retrying in 60s');
        this.timer = setTimeout(() => this.refreshAndReschedule(), 60_000);
      }
    } catch (err: any) {
      const status: number = err?.status ?? 0;
      // For definitive server errors (4xx/5xx, e.g. 405 Method Not Allowed) stop the
      // retry loop — the endpoint is not going to start working on its own.
      if (status >= 400 && status < 600) {
        console.warn(`⚠️ [TokenRefresh] Non-retryable refresh failure (HTTP ${status}), stopping refresh timer.`);
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        return;
      }
      // For transient / network errors, retry in 60s
      console.warn('⚠️ [TokenRefresh] Failed to refresh token, retrying in 60s:', {
        error: err,
        message: err?.message,
        status: err?.status
      });
      this.timer = setTimeout(() => this.refreshAndReschedule(), 60_000);
    }
  }
}
