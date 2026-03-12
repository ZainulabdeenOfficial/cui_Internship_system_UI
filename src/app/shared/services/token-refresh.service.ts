import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private timer: any = null;
  private lastTokenHash = '';
  private readonly skewMs = 120_000; // refresh 2 minutes before expiry for safety
  private watcher: any = null;

  constructor(private auth: AuthService) {}

  init() { this.start(); }

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

  start() {
    // watch token changes periodically and reschedule
    if (this.watcher) clearInterval(this.watcher);
  this.watcher = setInterval(() => this.ensureSchedule(), 10_000);
    this.ensureSchedule();
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
