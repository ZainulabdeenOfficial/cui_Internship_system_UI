import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { StudentRegisterRequest, RegisterResponse, LoginRequest, LoginResponse } from '../models/auth.models';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}
  private base = environment.apiBaseUrl.replace(/\/$/, '');

  async registerStudent(input: StudentRegisterRequest, options?: { timeoutMs?: number }): Promise<RegisterResponse> {
    const url = `${this.base}/api/auth/register`;
    try {
  const res = await firstValueFrom(
    this.http.post<RegisterResponse>(url, input).pipe(timeout(options?.timeoutMs ?? 4000))
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
        this.http.post<LoginResponse>(url, input).pipe(timeout(options?.timeoutMs ?? 4000))
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
}
