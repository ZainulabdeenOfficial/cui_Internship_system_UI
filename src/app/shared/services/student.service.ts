import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export type InternshipType = 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID'|string;

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private http: HttpClient) {}

  private base = environment.apiBaseUrl.replace(/\/$/, '');
  private abs(path: string) { 
    // Always use relative paths - Vercel rewrites and local proxy handle routing to backend
    return path;
  }
  private getAuthToken(): string {
    return sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || '';
  }
  private jsonHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({ 
      'Content-Type': 'application/json', 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
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
    const url = this.abs('/api/student/appex-a');
    const token = this.getAuthToken();
    const headers = new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
    return await firstValueFrom(this.http.get<any>(url, { headers }));
  }

  // POST /api/student/appex-a
  async submitAppExA(payload: any) {
    // Helper to convert dates to ISO 8601 format
    const toISODate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        // Return full ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
        return date.toISOString();
      } catch {
        return dateStr;
      }
    };
    
    // Helper to convert checkbox natureOfInternship to comma-separated string
    const buildInternshipField = (payload: any): string => {
      const nature = payload.natureOfInternship;
      if (!nature || typeof nature !== 'object') {
        return payload.internshipField || payload.internshipNature || '';
      }
      
      const selected: string[] = [];
      if (nature.softwareDevelopment) selected.push('Software Development');
      if (nature.dataScience) selected.push('Data Science');
      if (nature.networking) selected.push('Networking');
      if (nature.cyberSecurity) selected.push('Cyber Security');
      if (nature.webMobile) selected.push('Web/Mobile Development');
      if (nature.otherChecked && nature.otherText) selected.push(nature.otherText);
      
      return selected.length > 0 ? selected.join(', ') : (payload.internshipField || payload.internshipNature || '');
    };
    
    // Only send fields the backend expects
    const cleanPayload = {
      organization: payload.organization || '',
      address: payload.address || '',
      industrySector: payload.industrySector || '',
      contactName: payload.contactName || '',
      contactDesignation: payload.contactDesignation || '',
      contactPhone: payload.contactPhone || '',
      contactEmail: payload.contactEmail || '',
      internshipLocation: payload.internshipLocation || '',
      internshipNature: buildInternshipField(payload),
      mode: payload.mode || '',
      numberOfInternship: String(payload.numberOfPositions || payload.numberOfInternship || '1'),
      startDate: toISODate(payload.startDate) || '',
      endDate: toISODate(payload.endDate) || '',
      workingDays: payload.workingDays || '',
      workingHours: payload.workingHours || ''
    };
    
    const url = this.abs('/api/student/appex-a');
    const token = this.getAuthToken();
    console.log('🔐 [submitAppExA] Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    const headers = this.jsonHeaders();
    console.log('📤 [submitAppExA] Headers:', headers.keys());
    console.log('📤 [submitAppExA] Authorization header:', headers.get('Authorization'));
    console.log('📦 [submitAppExA] Payload being sent:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.post<any>(url, cleanPayload, { headers }));
  }

  // PUT /api/student/appex-a
  async updateAppExA(payload: any) {
    // Helper to convert dates to ISO 8601 format
    const toISODate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        // Return full ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
        return date.toISOString();
      } catch {
        return dateStr;
      }
    };
    
    // Helper to convert checkbox natureOfInternship to comma-separated string
    const buildInternshipField = (payload: any): string => {
      const nature = payload.natureOfInternship;
      if (!nature || typeof nature !== 'object') {
        return payload.internshipField || payload.internshipNature || '';
      }
      
      const selected: string[] = [];
      if (nature.softwareDevelopment) selected.push('Software Development');
      if (nature.dataScience) selected.push('Data Science');
      if (nature.networking) selected.push('Networking');
      if (nature.cyberSecurity) selected.push('Cyber Security');
      if (nature.webMobile) selected.push('Web/Mobile Development');
      if (nature.otherChecked && nature.otherText) selected.push(nature.otherText);
      
      return selected.length > 0 ? selected.join(', ') : (payload.internshipField || payload.internshipNature || '');
    };
    
    // Only send fields the backend expects
    const cleanPayload = {
      organization: payload.organization || '',
      address: payload.address || '',
      industrySector: payload.industrySector || '',
      contactName: payload.contactName || '',
      contactDesignation: payload.contactDesignation || '',
      contactPhone: payload.contactPhone || '',
      contactEmail: payload.contactEmail || '',
      internshipLocation: payload.internshipLocation || '',
      internshipNature: buildInternshipField(payload),
      mode: payload.mode || '',
      numberOfInternship: String(payload.numberOfPositions || payload.numberOfInternship || '1'),
      startDate: toISODate(payload.startDate) || '',
      endDate: toISODate(payload.endDate) || '',
      workingDays: payload.workingDays || '',
      workingHours: payload.workingHours || ''
    };
    
    const url = this.abs('/api/student/appex-a');
    const headers = this.jsonHeaders();
    console.log('📤 [updateAppExA] Sending updated payload:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.put<any>(url, cleanPayload, { headers }));
  }

  // GET /api/student/appex-b
  async getAppExB(): Promise<any> {
    const url = this.abs('/api/student/appex-b');
    const token = this.getAuthToken();
    const headers = new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
    return await firstValueFrom(this.http.get<any>(url, { headers }));
  }

  // POST /api/student/appex-b
  async submitAppExB(payload: any) {
    // Only send fields the backend expects
    const cleanPayload = {
      name: payload.name || '',
      degreeProgram: payload.degreeProgram || '',
      email: payload.email || '',
      semester: payload.semester || '',
      contactNo: payload.contactNo || '',
      preferredField: payload.preferredField || '',
      agreementAccepted: !!payload.agreementAccepted
    };
    
    const url = this.abs('/api/student/appex-b');
    const token = this.getAuthToken();
    console.log('🔐 [submitAppExB] Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    const headers = this.jsonHeaders();
    console.log('📦 [submitAppExB] Payload being sent:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.post<any>(url, cleanPayload, { headers }));
  }

  // PUT /api/student/appex-b
  async updateAppExB(payload: any) {
    // Only send fields the backend expects
    const cleanPayload = {
      name: payload.name || '',
      degreeProgram: payload.degreeProgram || '',
      email: payload.email || '',
      semester: payload.semester || '',
      contactNo: payload.contactNo || '',
      preferredField: payload.preferredField || '',
      agreementAccepted: !!payload.agreementAccepted
    };
    
    const url = this.abs('/api/student/appex-b');
    const headers = this.jsonHeaders();
    console.log('📤 [updateAppExB] Sending updated payload:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.put<any>(url, cleanPayload, { headers }));
  }

  // GET /api/student/appex-c
  async getAppExC(): Promise<any> {
    const url = this.abs('/api/student/appex-c');
    const token = this.getAuthToken();
    const headers = new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
    return await firstValueFrom(this.http.get<any>(url, { headers }));
  }

  // POST /api/student/appex-c
  async submitAppExC(payload: any) {
    // Helper to convert keyActivities to comma-separated string
    const buildKeyActivities = (payload: any): string => {
      const activities = payload.keyActivities;
      if (!activities || typeof activities !== 'object') {
        return payload.keyActivities || '';
      }
      
      const selected: string[] = [];
      if (activities.coding) selected.push('Coding');
      if (activities.testing) selected.push('Testing');
      if (activities.documentation) selected.push('Documentation');
      if (activities.dataAnalysis) selected.push('Data Analysis');
      if (activities.research) selected.push('Research');
      if (activities.technicalSupport) selected.push('Technical Support');
      if (activities.dashboard) selected.push('Dashboard/Report Creation');
      if (activities.other && activities.otherText) selected.push(`Other: ${activities.otherText}`);
      
      return selected.length > 0 ? selected.join(', ') : '';
    };

    // Only send fields the backend expects
    const cleanPayload = {
      organizationOverview: payload.organizationOverview || '',
      roleDescription: payload.roleDescription || '',
      keyActivities: buildKeyActivities(payload),
      toolsTechnologies: payload.toolsTechnologies || payload.tools || '',
      expectedDeliverables: payload.expectedDeliverables || ''
    };
    
    const url = this.abs('/api/student/appex-c');
    const token = this.getAuthToken();
    console.log('🔐 [submitAppExC] Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    const headers = this.jsonHeaders();
    console.log('📦 [submitAppExC] Payload being sent:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.post<any>(url, cleanPayload, { headers }));
  }

  // PUT /api/student/appex-c
  async updateAppExC(payload: any) {
    // Helper to convert keyActivities to comma-separated string
    const buildKeyActivities = (payload: any): string => {
      const activities = payload.keyActivities;
      if (!activities || typeof activities !== 'object') {
        return payload.keyActivities || '';
      }
      
      const selected: string[] = [];
      if (activities.coding) selected.push('Coding');
      if (activities.testing) selected.push('Testing');
      if (activities.documentation) selected.push('Documentation');
      if (activities.dataAnalysis) selected.push('Data Analysis');
      if (activities.research) selected.push('Research');
      if (activities.technicalSupport) selected.push('Technical Support');
      if (activities.dashboard) selected.push('Dashboard/Report Creation');
      if (activities.other && activities.otherText) selected.push(`Other: ${activities.otherText}`);
      
      return selected.length > 0 ? selected.join(', ') : '';
    };

    // Only send fields the backend expects
    const cleanPayload = {
      organizationOverview: payload.organizationOverview || '',
      roleDescription: payload.roleDescription || '',
      keyActivities: buildKeyActivities(payload),
      toolsTechnologies: payload.toolsTechnologies || payload.tools || '',
      expectedDeliverables: payload.expectedDeliverables || ''
    };
    
    const url = this.abs('/api/student/appex-c');
    const headers = this.jsonHeaders();
    console.log('📤 [updateAppExC] Sending updated payload:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.put<any>(url, cleanPayload, { headers }));
  }
}
