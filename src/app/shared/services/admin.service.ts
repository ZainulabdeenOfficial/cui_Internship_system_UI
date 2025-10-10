import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CreateAccountRequest, CreateAccountResponse } from '../models/admin/create-account.models';
type Decoded = { exp?: number };

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}
  
  private createUrl = (() => {
    const path = (environment.adminCreateAccountUrl?.trim() || '/api/admin/create-account');
    const absBase = environment.apiBaseUrl.replace(/\/$/, '');
    // In production on Vercel, prefer same-origin relative path so vercel.json rewrites proxy to backend (no CORS)
    if (environment.production) {
      return path.startsWith('http') ? path : (path || '/api/admin/create-account');
    }
    // In development, compose absolute backend URL
    return path.startsWith('http') ? path : `${absBase}${path.startsWith('/') ? '' : '/'}${path}`;
  })();

  async createAccount(input: CreateAccountRequest): Promise<CreateAccountResponse> {
    const body = {
      email: (input.email || '').trim(),
      name: (input.name || '').trim(),
      password: input.password,
      role: input.role || 'ADMIN'
    } as CreateAccountRequest;
    if (!body.email || !body.name || !body.password) throw new Error('Missing required fields');
   
    if (environment.production && this.createUrl.startsWith('http:')) throw new Error('Insecure endpoint');
    const getToken = () => {
      try {
        return sessionStorage.getItem('authToken')
          || sessionStorage.getItem('accessToken')
          || sessionStorage.getItem('token')
          || localStorage.getItem('authToken')
          || localStorage.getItem('accessToken');
      } catch { return null; }
    };
    // Preflight: if token exists but expired (>30s grace), surface a clear error so caller/interceptor can refresh
    try {
      const t = getToken();
      if (t) {
        const parts = t.split('.');
        if (parts.length === 3) {
          const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson) as Decoded;
          const exp = payload?.exp;
          if (exp && (Date.now() / 1000 > exp - 30)) {
            throw new Error('Access token expired; please refresh before creating account');
          }
        }
      }
    } catch {
      // If decode fails, proceed; backend will validate token
    }
    const post = (url: string) => {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return this.http.post<CreateAccountResponse>(url, body, { headers: new HttpHeaders(headers) });
    };
    try {
      return await firstValueFrom(post(this.createUrl));
    } catch (err: any) {
      // Do not fallback to relative path; ensure we only talk to backend domain to avoid frontend 401 OK
      throw err;
    }
  }
}
