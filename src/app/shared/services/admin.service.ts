import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CreateAccountRequest, CreateAccountResponse } from '../models/admin/create-account.models';
type Decoded = { exp?: number };
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient, private auth: AuthService) {}
  
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
  const normalizedRole = ((input.role as any) || 'ADMIN').toString().toUpperCase();
  const apiRole = normalizedRole === 'FACULTY' ? 'FACULT' : (normalizedRole === 'SITE' ? 'SITE' : normalizedRole);
    const body = {
      email: (input.email || '').trim(),
      name: (input.name || '').trim(),
      password: input.password,
      role: apiRole
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
    // If no token, attempt a refresh using stored refreshToken
    try {
      if (!getToken()) {
        await this.auth.refreshAccessToken();
      }
    } catch {}
    // Preflight: if token exists but expired (>30s grace), attempt refresh before calling API
    try {
      const t = getToken();
      if (t) {
        const parts = t.split('.');
        if (parts.length === 3) {
          const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson) as Decoded;
          const exp = payload?.exp;
          if (exp && (Date.now() / 1000 > exp - 30)) {
            await this.auth.refreshAccessToken();
          }
        }
      }
    } catch {
      // If decode fails, proceed; backend will validate token
    }
    const post = (url: string) => {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
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

  async addCompany(payload: { name: string; email: string; phone: string; address: string; website: string; industry: string; description: string }): Promise<{ message?: string; id?: string }> {
    const path = (environment as any).adminAddCompanyUrl?.trim() || '/api/admin/add-company';
    const url = environment.production ? (path.startsWith('http') ? path : path) : `${environment.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    const token = (() => { try { return sessionStorage.getItem('accessToken') || sessionStorage.getItem('authToken') || localStorage.getItem('accessToken') || localStorage.getItem('authToken'); } catch { return null; } })();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = {
      name: (payload.name || '').trim(),
      email: (payload.email || '').trim(),
      phone: (payload.phone || '').trim(),
      address: (payload.address || '').trim(),
      website: (payload.website || '').trim(),
      industry: (payload.industry || '').trim(),
      description: (payload.description || '').trim()
    };
    if (!body.name || !body.email) throw new Error('Name and email are required');
    return await firstValueFrom(this.http.post<{ message?: string; id?: string }>(url, body, { headers: new HttpHeaders(headers) }));
  }

  async updateCompany(payload: { id?: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }): Promise<{ message?: string }> {
    const path = (environment as any).adminUpdateCompanyUrl?.trim() || '/api/admin/update-company';
    const url = environment.production ? (path.startsWith('http') ? path : path) : `${environment.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    const token = (() => { try { return sessionStorage.getItem('accessToken') || sessionStorage.getItem('authToken') || localStorage.getItem('accessToken') || localStorage.getItem('authToken'); } catch { return null; } })();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = {
      id: payload.id,
      name: (payload.name || '').trim(),
      email: (payload.email || '').trim() || undefined,
      phone: (payload.phone || '').trim() || undefined,
      address: (payload.address || '').trim() || undefined,
      website: (payload.website || '').trim() || undefined,
      industry: (payload.industry || '').trim() || undefined,
      description: (payload.description || '').trim() || undefined
    };
    if (!body.name) throw new Error('Company name is required');
    return await firstValueFrom(this.http.post<{ message?: string }>(url, body, { headers: new HttpHeaders(headers) }));
  }

  async getCompanies(): Promise<Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }>> {
    // Prefer an admin-scoped list endpoint; fallback to a generic one if needed
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const candidates = ['/api/admin/companies', '/api/companies', '/api/admin/list-companies'];
    const token = (() => { try { return sessionStorage.getItem('accessToken') || sessionStorage.getItem('authToken') || localStorage.getItem('accessToken') || localStorage.getItem('authToken'); } catch { return null; } })();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tryGet = async (path: string) => {
      const url = environment.production ? (path.startsWith('http') ? path : path) : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
      return await firstValueFrom(this.http.get<any>(url, { headers: new HttpHeaders(headers) }));
    };
    let lastErr: any;
    for (const p of candidates) {
      try {
        const res = await tryGet(p);
        // Normalize to expected shape array
        const list: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : []));
        return list.map((x: any) => ({
          id: (x.id ?? x._id ?? x.companyId ?? x.remoteId ?? '').toString(),
          name: x.name ?? x.companyName ?? '',
          email: x.email,
          phone: x.phone,
          address: x.address,
          website: x.website,
          industry: x.industry,
          description: x.description
        })).filter(c => !!c.id && !!c.name);
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('Failed to fetch companies');
  }
}
