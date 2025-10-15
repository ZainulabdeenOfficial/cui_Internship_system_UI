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
    const req$ = this.http.post<T>(urlRel, body, { headers: new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }) });
    try { return await firstValueFrom(opts?.timeoutMs ? req$.pipe(timeout(opts.timeoutMs)) : req$); }
    catch (err) {
      // Fallback to absolute base if relative fails due to environment misconfig
      const abs = `${this.absBase}${urlRel}`;
      const req2$ = this.http.post<T>(abs, body, { headers: new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }) });
      return await firstValueFrom(opts?.timeoutMs ? req2$.pipe(timeout(opts.timeoutMs)) : req2$);
    }
  }
  private async getJson<T>(path: string, opts?: { timeoutMs?: number }) {
    const urlRel = this.rel(path);
    const req$ = this.http.get<T>(urlRel, { headers: new HttpHeaders({ Accept: 'application/json' }) });
    try { return await firstValueFrom(opts?.timeoutMs ? req$.pipe(timeout(opts.timeoutMs)) : req$); }
    catch (err) {
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
    const to = options?.timeoutMs ?? 4000;
    const attempt = async (): Promise<LoginResponse> => {
      const res = await this.postJson<LoginResponse>('/api/auth/login', input, { timeoutMs: to });
      const anyRes: any = res || {};
        let token = anyRes.token || anyRes.accessToken;
        const user = anyRes.user ?? anyRes.data ?? undefined;
        const role = (user?.role || anyRes.role || '').toString();
        // Save tokens if present
        try {
          const atk = anyRes.accessToken || anyRes.token;
          const rtk = anyRes.refreshToken || anyRes?.data?.refreshToken || anyRes?.user?.refreshToken;
          if (atk) sessionStorage.setItem('authToken', atk);
          if (atk) sessionStorage.setItem('accessToken', atk);
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
          return { success: false, message: 'Login timeout. Please try again.' };
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
    const rel = '/api/auth/refresh-token';
    let refreshToken: string | null = null;
    try { refreshToken = localStorage.getItem('refreshToken'); } catch {}
    if (!refreshToken) {
      try { if (!environment.production) console.warn('[Auth] No refreshToken found; skipping refresh'); } catch {}
      throw new Error('No refresh token found');
    }
    const post = (u: string) => this.http.post<RefreshTokenResponse>(u, { refreshToken }, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) });
    let res: RefreshTokenResponse;
    try {
      // Prefer same-origin (rewrites/proxy) then fallback to absolute
      res = await firstValueFrom(post(rel));
    } catch (err: any) {
      const absUrl = `${this.absBase}${rel}`;
      res = await firstValueFrom(post(absUrl));
    }
    try {
      const tok = (res as any)?.accessToken || (res as any)?.token;
      const rtk = (res as any)?.refreshToken;
      if (tok) { sessionStorage.setItem('authToken', tok); sessionStorage.setItem('accessToken', tok); }
      if (rtk) { localStorage.setItem('refreshToken', rtk); }
    } catch {}
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
    try { localStorage.removeItem('refreshToken'); } catch {}
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
