import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type FacultyProfile = {
  id?: string;
  userId?: string;
  department?: string;
  designation?: string;
  phone?: string;
  office?: string;
  bio?: string;
  avatarUrl?: string;
  qualifications?: string;
  expertise?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: { id?: string; name?: string; email?: string; role?: string; verified?: boolean };
};

@Injectable({ providedIn: 'root' })
export class FacultyService {
  private base = 'https://cui-internship-system-git-dev-zas-projects-7d9cf03b.vercel.app';
  constructor(private http: HttpClient, private auth: AuthService) {}

  private getTokenFromStorage(): string | null {
    try {
      return sessionStorage.getItem('authToken')
        || sessionStorage.getItem('accessToken')
        || sessionStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('accessToken');
    } catch { return null; }
  }
  private async ensureFreshToken(): Promise<string | null> {
    const get = () => this.getTokenFromStorage();
    let token = get();
    if (!token) {
      try { await this.auth.refreshAccessToken(); token = get(); } catch {}
    }
    try {
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson) as { exp?: number };
          const exp = payload?.exp;
          if (exp && (Date.now() / 1000 > exp - 30)) {
            await this.auth.refreshAccessToken();
            token = get();
          }
        }
      }
    } catch {}
    return token || null;
  }
  private async authHeaders(json = true): Promise<HttpHeaders> {
    const token = await this.ensureFreshToken();
    const base: Record<string, string> = { Accept: 'application/json' };
    if (json) base['Content-Type'] = 'application/json';
    if (token) base['Authorization'] = `Bearer ${token}`;
    return new HttpHeaders(base);
  }

  async getProfile(): Promise<{ message?: string; profile?: FacultyProfile }> {
    const url = `${this.base}/api/faculty/profile`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false) }));
    return { message: res?.message, profile: res?.profile as FacultyProfile };
  }

  async updateProfile(input: Partial<FacultyProfile>): Promise<{ message?: string; profile?: FacultyProfile }>{
    const url = `${this.base}/api/faculty/profile`;
    const body: any = {
      department: input.department ?? '',
      designation: input.designation ?? '',
      phone: input.phone ?? '',
      office: input.office ?? '',
      bio: input.bio ?? '',
      avatarUrl: input.avatarUrl ?? '',
      qualifications: input.qualifications ?? '',
      expertise: input.expertise ?? ''
    };
    const res = await firstValueFrom(this.http.post<any>(url, body, { headers: await this.authHeaders(true) }));
    return { message: res?.message, profile: res?.profile as FacultyProfile };
  }

  async getAppexAApprovals(status?: string, page?: number, limit?: number): Promise<any> {
    let url = `${this.base}/api/faculty/appex-a-approval`;
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length) url += '?' + params.join('&');
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false) }));
    return res;
  }

  async updateAppexAApproval(appexAId: string, status: 'approved' | 'rejected', comments?: string): Promise<any> {
    const url = `${this.base}/api/faculty/appex-a-approval`;
    const body = { appexAId, status, comments: comments || '' };
    const res = await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
    return res;
  }

  async getAppexBVerifications(status?: string, page?: number, limit?: number): Promise<any> {
    let url = `${this.base}/api/faculty/appex-b-verification`;
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length) url += '?' + params.join('&');
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false) }));
    return res;
  }

  async updateAppexBVerification(assignmentId: string, action: 'approve' | 'request_changes', comments?: string): Promise<any> {
    const url = `${this.base}/api/faculty/appex-b-verification`;
    const body = { assignmentId, action, comments: comments || '' };
    const res = await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
    return res;
  }
}
