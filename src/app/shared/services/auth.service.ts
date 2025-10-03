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
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(url, input, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(timeout(options?.timeoutMs ?? 4000))
      );
      // Normalize API shape -> our app shape
      const anyRes: any = res || {};
      const token = anyRes.token || anyRes.accessToken;
      const user = anyRes.user ?? anyRes.data ?? undefined;
      return ({ success: true, token, user, message: anyRes.message }) as LoginResponse;
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Login failed';
      return { success: false, message };
    }
  }

  async sendVerificationEmail(email: string): Promise<SendVerificationEmailResponse> {
    const url = `${this.base}/api/auth/send-verification-email`;
    return await firstValueFrom(
      this.http.post<SendVerificationEmailResponse>(url, { email } as SendVerificationEmailRequest, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
    );
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
    const url = `${this.base}/api/auth/refresh-token`;
    return await firstValueFrom(this.http.get<RefreshTokenResponse>(url));
  }

  async generatePassword(): Promise<GeneratePasswordResponse> {
    const url = `${this.base}/api/auth/generate-passowrd`;
    return await firstValueFrom(this.http.get<GeneratePasswordResponse>(url));
  }
}
