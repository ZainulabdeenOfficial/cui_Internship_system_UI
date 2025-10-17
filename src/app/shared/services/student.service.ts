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
