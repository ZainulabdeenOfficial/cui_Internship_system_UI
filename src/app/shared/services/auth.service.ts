import { Injectable } from '@angular/core';
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
  constructor(private http: HttpClient) {}
  private base = (environment.production ? environment.apiBaseUrl.replace(/\/$/, '') : '').replace(/\/$/, '');

  async registerStudent(input: StudentRegisterRequest, options?: { timeoutMs?: number }): Promise<RegisterResponse> {
    const url = `${this.base}/api/auth/register`;
    try {
  const res = await firstValueFrom(
    this.http.post<RegisterResponse>(url, input, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(timeout(options?.timeoutMs ?? 4000))
  );
      // If API returns 200, consider it success even if it lacks a 'success' flag
      return ({ success: true, ...(res as any) }) as RegisterResponse;
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Registration failed';
      return { success: false, message };
    }
  }

  async login(input: LoginRequest, options?: { timeoutMs?: number }): Promise<LoginResponse> {
    const url = `${this.base}/api/auth/login`;
    const to = options?.timeoutMs ?? 4000;
    const attempt = async (): Promise<LoginResponse> => {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(url, input, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(timeout(to))
      );
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
    const url = `${this.base}/api/auth/send-verification-email`;
    try {
      const res = await firstValueFrom(
        this.http.post<SendVerificationEmailResponse>(url, { email } as SendVerificationEmailRequest, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
          .pipe(timeout(options?.timeoutMs ?? 4000))
      );
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
    const url = `${this.base}/api/auth/verify-email`;
    return await firstValueFrom(
      this.http.post<VerifyEmailResponse>(url, { token } as VerifyEmailRequest, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
    );
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const absBase = environment.apiBaseUrl.replace(/\/$/, '');
    const url = `${absBase}/api/auth/forgot-password`;
    return await firstValueFrom(
      this.http.post<{ message: string }>(url, { email }, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
    );
  }

  async resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
    const url = `${this.base}/api/auth/reset-password`;
    const body: ResetPasswordRequest = { token, password };
    return await firstValueFrom(
      this.http.post<ResetPasswordResponse>(url, body, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
    );
  }

  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    const absBase = environment.apiBaseUrl.replace(/\/$/, '');
    const url = `${absBase}/api/auth/refresh-token`;
    let refreshToken: string | null = null;
    try { refreshToken = localStorage.getItem('refreshToken'); } catch {}
    if (!refreshToken) {
      try { if (!environment.production) console.warn('[Auth] No refreshToken found; skipping refresh'); } catch {}
      throw new Error('No refresh token found');
    }
    const post = (u: string) => this.http.post<RefreshTokenResponse>(u, { refreshToken }, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) });
    let res: RefreshTokenResponse;
    try {
      res = await firstValueFrom(post(url));
    } catch (err: any) {
      // Fallback: try same-origin path to use Vercel rewrites
      const rel = '/api/auth/refresh-token';
      res = await firstValueFrom(post(rel));
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
    const url = `${this.base}/api/auth/generate-password`;
    return await firstValueFrom(this.http.get<GeneratePasswordResponse>(url));
  }
}
