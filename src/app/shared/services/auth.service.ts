import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { StudentRegisterRequest, RegisterResponse, LoginRequest, LoginResponse, SendVerificationEmailRequest, SendVerificationEmailResponse, RefreshTokenResponse } from '../models/auth.models';
import { ResetPasswordRequest, ResetPasswordResponse } from '../models/auth/forgot-reset.models';
import { GeneratePasswordResponse } from '../models/auth/generate-password.response';
import { VerifyEmailRequest, VerifyEmailResponse } from '../models/auth/verify-email.models';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient, private router: Router) {}
  private absBase = environment.apiBaseUrl.replace(/\/$/, '');
  private rel(path: string) { return path.startsWith('/') ? path : `/${path}`; }
  private async postJson<T>(path: string, body: any, opts?: { timeoutMs?: number }) {
    const urlRel = this.rel(path);
    // withCredentials: true ensures the browser sends/receives httpOnly cookies (refresh token)
    const req$ = this.http.post<T>(urlRel, body, { headers: new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }), withCredentials: true });
    try { return await firstValueFrom(opts?.timeoutMs ? req$.pipe(timeout(opts.timeoutMs)) : req$); }
    catch (err: any) {
      // Only fallback on network/CORS-like errors (status 0). For 4xx/5xx, bubble up as-is.
      const status = err?.status ?? err?.error?.status ?? 0;
      if (status && status !== 0) throw err;
      // Fallback to absolute base if relative fails due to environment misconfig
      const abs = `${this.absBase}${urlRel}`;
      const req2$ = this.http.post<T>(abs, body, { headers: new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }), withCredentials: true });
      return await firstValueFrom(opts?.timeoutMs ? req2$.pipe(timeout(opts.timeoutMs)) : req2$);
    }
  }
  private async getJson<T>(path: string, opts?: { timeoutMs?: number }) {
    const urlRel = this.rel(path);
    const req$ = this.http.get<T>(urlRel, { headers: new HttpHeaders({ Accept: 'application/json' }) });
    try { return await firstValueFrom(opts?.timeoutMs ? req$.pipe(timeout(opts.timeoutMs)) : req$); }
    catch (err: any) {
      const status = err?.status ?? err?.error?.status ?? 0;
      if (status && status !== 0) throw err;
      const abs = `${this.absBase}${urlRel}`;
      const req2$ = this.http.get<T>(abs, { headers: new HttpHeaders({ Accept: 'application/json' }) });
      return await firstValueFrom(opts?.timeoutMs ? req2$.pipe(timeout(opts.timeoutMs)) : req2$);
    }
  }

  async registerStudent(input: StudentRegisterRequest, options?: { timeoutMs?: number }): Promise<RegisterResponse> {
    try {
  const res = await this.postJson<RegisterResponse>('/api/auth/register', input, { timeoutMs: options?.timeoutMs ?? 4000 });
      // If API returns 200, consider it success even if it lacks a 'success' flag
      return ({ success: true, ...(res as any) }) as RegisterResponse;
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Registration failed';
      return { success: false, message };
    }
  }

  async login(input: LoginRequest, options?: { timeoutMs?: number }): Promise<LoginResponse> {
    const to = options?.timeoutMs ?? 6000;
    const attempt = async (): Promise<LoginResponse> => {
      const res = await this.postJson<LoginResponse>('/api/auth/login', input, { timeoutMs: to });
      const anyRes: any = res || {};
        // Support all common backend token response shapes:
        // { accessToken } | { token } | { data: { accessToken } } | { data: { token } }
        const atk = anyRes.accessToken || anyRes.token
          || anyRes.data?.accessToken || anyRes.data?.token
          || anyRes.tokens?.accessToken || anyRes.tokens?.token;
        const rtk = anyRes.refreshToken || anyRes.data?.refreshToken
          || anyRes.user?.refreshToken || anyRes.tokens?.refreshToken;
        let token = atk;
        const user = anyRes.user ?? anyRes.data?.user ?? anyRes.data ?? undefined;
        const role = (anyRes.role || user?.role || '').toString();
        // Save tokens if present
        try {
          if (atk) sessionStorage.setItem('authToken', atk);
          if (atk) sessionStorage.setItem('accessToken', atk);
          // Also persist in localStorage so the token survives page refresh
          if (atk) localStorage.setItem('authToken', atk);
          if (atk) localStorage.setItem('accessToken', atk);
          if (rtk) localStorage.setItem('refreshToken', rtk);
        } catch {}
      // If API omitted token but set success, try refresh once
      if (!token) {
        try {
          const refreshed = await this.refreshAccessToken();
          token = (refreshed as any)?.token || (refreshed as any)?.accessToken || token;
        } catch {}
      }
        return ({ success: true, token, accessToken: anyRes.accessToken, user, role, message: anyRes.message }) as LoginResponse;
    };
    try {
      return await attempt();
    } catch (err: any) {
      // Retry once on timeout only
      const isTimeout = err?.name === 'TimeoutError' || /timeout/i.test(err?.message || '');
      if (isTimeout) {
        try { return await attempt(); } catch (e2: any) {
          // After retry fails, provide more specific guidance
          return { success: false, message: 'Server took too long to respond. Please check your internet connection and try again.' };
        }
      }
      const message = err?.error?.message || err?.message || 'Login failed';
      return { success: false, message };
    }
  }

  async sendVerificationEmail(email: string, options?: { timeoutMs?: number }): Promise<SendVerificationEmailResponse> {
    try {
      const res = await this.postJson<SendVerificationEmailResponse>('/api/auth/send-verification-email', { email } as SendVerificationEmailRequest, { timeoutMs: options?.timeoutMs ?? 4000 });
      return res;
    } catch (err: any) {
      // Normalize timeout into a user friendly message while allowing UI to proceed optimistically
      if (err?.name === 'TimeoutError') {
        return { message: 'Request timed out – please check your inbox. You may retry shortly.' } as SendVerificationEmailResponse;
      }
      throw err;
    }
  }

  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    return await this.postJson<VerifyEmailResponse>('/api/auth/verify-email', { token } as VerifyEmailRequest);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return await this.postJson<{ message: string }>('/api/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
    const body: ResetPasswordRequest = { token, password };
    return await this.postJson<ResetPasswordResponse>('/api/auth/reset-password', body);
  }

  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    const endpoint = '/api/auth/refresh-token';
    const headers = { Accept: 'application/json' };

    // Use GET method with cookies (withCredentials: true sends refresh token from httpOnly cookie)
    const get = (url: string) => this.http.get<RefreshTokenResponse>(
      url,
      { headers: new HttpHeaders(headers), withCredentials: true }
    );

    const pathVariants = [endpoint, `${endpoint}/`];
    let res: RefreshTokenResponse | null = null;
    let lastErr: any = null;

    try {
      // Try same-origin (proxy) first so cookie domain matches
      for (const candidate of pathVariants) {
        try {
          console.log(`🔄 [TokenRefresh] GET ${candidate}`);
          res = await firstValueFrom(get(candidate));
          console.log(`✅ [TokenRefresh] GET ${candidate} succeeded`);
          break;
        } catch (err: any) {
          const status: number = err?.status ?? 0;
          console.warn(`⚠️ [TokenRefresh] GET ${candidate} failed (HTTP ${status})`);
          lastErr = err;
        }
      }

      // If same-origin failed, try absolute URL
      if (!res && lastErr) {
        const absBase = this.absBase;
        console.log(`🔄 [TokenRefresh] Fallback to absolute URL: ${absBase}`);
        
        for (const candidate of pathVariants) {
          try {
            const absUrl = `${absBase}${candidate}`;
            console.log(`🔄 [TokenRefresh] GET ${absUrl}`);
            res = await firstValueFrom(get(absUrl));
            console.log(`✅ [TokenRefresh] GET ${absUrl} succeeded`);
            break;
          } catch (absErr: any) {
            const status: number = absErr?.status ?? 0;
            console.warn(`⚠️ [TokenRefresh] GET failed (HTTP ${status})`);
            lastErr = absErr;
          }
        }
      }

      if (!res) {
        throw lastErr;
      }
    } catch (err: any) {
      console.error('❌ Token refresh failed:', err?.message || err);
      throw err;
    }
    
    // Validate and save tokens from response
    if (!res?.accessToken) {
      console.error('❌ Token refresh response missing access token');
      throw new Error('Invalid refresh response: missing access token');
    }
    
    // Save access token in both storages so it persists across page refreshes
    sessionStorage.setItem('authToken', res.accessToken);
    sessionStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('authToken', res.accessToken);
    localStorage.setItem('accessToken', res.accessToken);
    
    // Save refresh token if new one provided
    if (res.refreshToken) {
      localStorage.setItem('refreshToken', res.refreshToken);
    }
    
    return res;
  }

  async generatePassword(): Promise<GeneratePasswordResponse> {
    return await this.getJson<GeneratePasswordResponse>('/api/auth/generate-password');
  }

  clearTokens() {
    try {
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('token');
    } catch {}
    try {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('accessToken');
    } catch {}
  }

  async logout(options?: { redirect?: boolean; returnTo?: string }) {
    this.clearTokens();
    const doRedirect = options?.redirect !== false;
    if (!doRedirect) return;
    const returnUrl = options?.returnTo || (typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : undefined);
    try {
      await this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
    } catch {
      try { if (typeof window !== 'undefined') window.location.href = '/login' + (returnUrl ? (`?returnUrl=${encodeURIComponent(returnUrl)}`) : ''); } catch {}
    }
  }
}
