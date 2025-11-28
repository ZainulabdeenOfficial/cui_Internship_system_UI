import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export type InternshipType = 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID'|string;

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private http: HttpClient) {}

  private base = environment.apiBaseUrl.replace(/\/$/, '');
  private abs(path: string) { return environment.production ? path : `${this.base}${path.startsWith('/') ? '' : '/'}${path}`; }
  private jsonHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' });
  }

  // POST /api/student/create-internship
  async createInternship(input: { type: InternshipType; siteId?: string; facultyId?: string }) {
    const url = this.abs('/api/student/create-internship');
    return await firstValueFrom(this.http.post<any>(url, input, { headers: this.jsonHeaders() }));
  }

  // POST /api/student/request-to-add-company
  async requestToAddCompany(payload: { name: string; email: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; justification?: string }) {
    const url = 'https://cui-internship-system-git-dev-zas-projects-7d9cf03b.vercel.app/api/student/request-to-add-company';
    return await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // GET student company requests via admin review endpoint (supports page/limit/status/search)
  async getMyCompanyRequests(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<{ companyRequests: any[]; total?: number; message?: string }> {
    const base = 'https://cui-internship-system-git-dev-zas-projects-7d9cf03b.vercel.app';
    const q: string[] = [];
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    q.push(`page=${encodeURIComponent(String(page))}`);
    q.push(`limit=${encodeURIComponent(String(limit))}`);
    if (params?.status) q.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.search) q.push(`search=${encodeURIComponent(params.search)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    const url = `${base}/api/admin/review-company${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: new HttpHeaders({ Accept: 'application/json' }) }));
    const items: any[] = Array.isArray(res?.requests) ? res.requests : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])));
    const mapped = items.map((x: any) => ({
      id: (x.id ?? x._id ?? x.requestId ?? '').toString(),
      name: x.name ?? x.companyName ?? x.company?.name,
      email: x.email ?? x.requestedBy?.email,
      phone: x.phone,
      address: x.address,
      website: x.website,
      industry: x.industry,
      description: x.description,
      reason: x.reason ?? x.justification,
      status: x.status ?? x.state ?? 'PENDING',
      notes: x.notes,
      createdAt: x.createdAt ?? x.requestedAt,
      reviewedAt: x.reviewedAt,
      requestedBy: x.requestedBy,
      reviewedBy: x.reviewedBy
    }));
    const total: number | undefined = (typeof res?.total === 'number') ? res.total : (typeof res?.count === 'number' ? res.count : (typeof res?.totalItems === 'number' ? res.totalItems : undefined));
    return { companyRequests: mapped, total };
  }

  // GET /api/student/appex-a
  async getAppExA(): Promise<any> {
    // Use the Talha dev Vercel endpoint for GET as requested
    const url = 'https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/student/appex-a';
    return await firstValueFrom(this.http.get<any>(url, { headers: new HttpHeaders({ Accept: 'application/json' }) }));
  }

  // POST /api/student/appex-a
  async submitAppExA(payload: {
    organization: string;
    address: string;
    industrySector?: string;
    contactName: string;
    contactDesignation?: string;
    contactPhone: string;
    contactEmail: string;
    internshipField?: string;
    internshipLocation?: string;
    startDate: string; // yyyy-mm-dd
    endDate: string;   // yyyy-mm-dd
    workingDays?: string;
    workingHours?: string;
  }) {
    const url = 'https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/student/appex-a';
    return await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // PUT /api/student/appex-a
  async updateAppExA(payload: {
    organization: string;
    address: string;
    industrySector?: string;
    contactName: string;
    contactDesignation?: string;
    contactPhone: string;
    contactEmail: string;
    internshipField?: string;
    internshipLocation?: string;
    startDate: string;
    endDate: string;
    workingDays?: string;
    workingHours?: string;
  }) {
    const url = 'https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/student/appex-a';
    return await firstValueFrom(this.http.put<any>(url, payload, { headers: this.jsonHeaders() }));
  }
}
