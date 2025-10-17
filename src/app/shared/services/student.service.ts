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

  // Search companies by name
  async searchCompanies(query: string): Promise<Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }>> {
    const url = this.abs(`/api/companies/search?q=${encodeURIComponent(query)}`);
    try {
      const res = await firstValueFrom(this.http.get<any>(url, { headers: new HttpHeaders({ Accept: 'application/json' }) }));
      const items: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.companies) ? res.companies : []));
      return items.map((c: any) => ({
        id: (c.id ?? c._id ?? '').toString(),
        name: c.name ?? '',
        email: c.email,
        phone: c.phone,
        address: c.address,
        website: c.website,
        industry: c.industry,
        description: c.description
      }));
    } catch {
      return [];
    }
  }

  // POST /api/student/request-to-add-company
  async requestToAddCompany(payload: { name: string; email: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; justification?: string }) {
    const url = this.abs('/api/student/request-to-add-company');
    return await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // GET /api/student/request-to-add-company
  async getMyCompanyRequests(): Promise<{ companyRequests: any[]; message?: string }> {
    const url = this.abs('/api/student/request-to-add-company');
    return await firstValueFrom(this.http.get<any>(url, { headers: new HttpHeaders({ Accept: 'application/json' }) }));
  }

  // GET /api/student/appex-a
  async getAppExA(): Promise<any> {
    const url = this.abs('/api/student/appex-a');
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
    const url = this.abs('/api/student/appex-a');
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
    const url = this.abs('/api/student/appex-a');
    return await firstValueFrom(this.http.put<any>(url, payload, { headers: this.jsonHeaders() }));
  }
}
