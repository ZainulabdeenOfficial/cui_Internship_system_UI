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
  private getTokenFromStorage(): string | null {
    try {
      return sessionStorage.getItem('authToken')
        || sessionStorage.getItem('accessToken')
        || sessionStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('accessToken');
    } catch { return null; }
  }

  // Lightweight dropdown companies for selects/search (id + name)
  async getDropdownCompanies(query?: string): Promise<Array<{ id: string; name: string; email?: string; address?: string; website?: string; industry?: string }>> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/dropdown/companies';
    const qs = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const url = environment.production ? `${path}${qs}` : `${base}${path}${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const list: any[] = Array.isArray(res?.companies) ? res.companies : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    return list
      .map((x: any) => ({
        id: (x.id ?? x._id ?? x.companyId ?? '').toString(),
        name: x.name ?? x.companyName ?? '',
        email: x.email,
        address: x.address,
        website: x.website,
        industry: x.industry
      }))
      .filter(x => !!x.id && !!x.name);
  }

  // Search faculty supervisors by query (name, email, company name, company email)
  async searchFaculty(query: string): Promise<Array<{ id: string; name: string; email?: string; companyName?: string; companyEmail?: string }>> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/search-faculty';
    const qs = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const url = environment.production ? `${path}${qs}` : `${base}${path}${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const list: any[] = Array.isArray(res?.faculty) ? res.faculty : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    return list
      .map((x: any) => ({
        id: (x.id ?? x._id ?? '').toString(),
        name: x.name ?? '',
        email: x.email,
        companyName: x.companyName,
        companyEmail: x.companyEmail
      }))
      .filter(x => !!x.id && !!x.name);
  }

  // Search site supervisors by query (name, email, company name, company email)
  async searchSiteSupervisors(query: string): Promise<Array<{ id: string; name: string; email?: string; companyName?: string; companyEmail?: string }>> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/search-site-supervisors';
    const qs = query && query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const url = environment.production ? `${path}${qs}` : `${base}${path}${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const list: any[] = Array.isArray(res?.siteSupervisors) ? res.siteSupervisors : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    return list
      .map((x: any) => ({
        id: (x.id ?? x._id ?? '').toString(),
        name: x.name ?? '',
        email: x.email,
        companyName: x.companyName,
        companyEmail: x.companyEmail
      }))
      .filter(x => !!x.id && !!x.name);
  }
  private async ensureFreshToken(): Promise<string | null> {
    const get = () => this.getTokenFromStorage();
    let token = get();
    // If missing, try refresh
    if (!token) {
      try { await this.auth.refreshAccessToken(); token = get(); } catch {}
    }
    // If present but expiring in <=30s, refresh
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
  private async authHeaders(json = false): Promise<HttpHeaders> {
    const token = await this.ensureFreshToken();
    const base: Record<string, string> = { Accept: 'application/json' };
    if (json) base['Content-Type'] = 'application/json';
    if (token) base['Authorization'] = `Bearer ${token}`;
    return new HttpHeaders(base);
  }
  
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
  // Map UI roles to backend expected identifiers
  const apiRole = normalizedRole === 'FACULTY' ? 'FACULTY'
    : (normalizedRole === 'SITE' || normalizedRole === 'SITE_SUPERVISOR' ? 'SITE_SUPERVISOR' : normalizedRole);
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
    const headers = await this.authHeaders(true);
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
    return await firstValueFrom(this.http.post<{ message?: string; id?: string }>(url, body, { headers }));
  }

  async updateCompany(payload: { id?: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }): Promise<{ message?: string }> {
    const path = (environment as any).adminUpdateCompanyUrl?.trim() || '/api/admin/update-company';
    const url = environment.production ? (path.startsWith('http') ? path : path) : `${environment.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = await this.authHeaders(true);
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
    return await firstValueFrom(this.http.post<{ message?: string }>(url, body, { headers }));
  }

  async getCompanies(): Promise<Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }>> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const post = async (path: string) => {
      const url = environment.production ? (path.startsWith('http') ? path : path) : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
      return await firstValueFrom(this.http.post<any>(url, '', { headers: await this.authHeaders() }));
    };
    const get = async (path: string) => {
      const url = environment.production ? (path.startsWith('http') ? path : path) : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
      return await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    };
    let res: any;
    let lastErr: any;
    const attempts: Array<{ method: 'GET'|'POST'; path: string }> = [
      { method: 'POST', path: '/api/admin/company-supervisors' },
      { method: 'GET',  path: '/api/admin/companies' },
      { method: 'GET',  path: '/api/admin/list-companies' },
      { method: 'GET',  path: '/api/companies' }
    ];
    for (const a of attempts) {
      try {
        res = a.method === 'POST' ? await post(a.path) : await get(a.path);
        if (res) break;
      } catch (e: any) {
        lastErr = e;
        // Continue trying others; if final error is 404, we'll return [] below
      }
    }
    if (!res) {
      const status = lastErr?.status ?? lastErr?.error?.status;
      if (status === 404) return [];
      throw lastErr || new Error('Failed to fetch companies');
    }
    const list: any[] = Array.isArray(res?.companies) ? res.companies : (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : [])));
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
  }

  async getAssignableSiteSupervisors(params: { companyId?: string; unassigned?: boolean }): Promise<Array<{ id: string; name: string; email?: string; companyId?: string }>> {
    // Endpoint sample: /api/admin/assign-supervisor?companyId=1&unassigned=true
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/assign-supervisor';
    const q: string[] = [];
    if (params.companyId) q.push(`companyId=${encodeURIComponent(params.companyId)}`);
    if (typeof params.unassigned === 'boolean') q.push(`unassigned=${params.unassigned}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    const url = environment.production ? `${path}${qs}` : `${base}${path}${qs}`;
  const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const list: any[] = Array.isArray(res)
      ? res
      : (Array.isArray(res?.supervisors) ? res.supervisors : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : [])));
    return list.map((x: any) => ({ id: (x.id ?? x._id ?? x.siteId ?? '').toString(), name: x.name ?? x.fullName ?? '', email: x.email, companyId: (x.companyId ?? '').toString() })).filter(x => !!x.id);
  }

  async getCompanyReviewRequests(params: { page?: number; limit?: number; status?: 'PENDING'|'APPROVED'|'REJECTED'; search?: string }): Promise<{ items: Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>, total?: number }>{
    // Use absolute Vercel URL as requested
    const base = 'https://cui-internship-system-git-dev-zas-projects-7d9cf03b.vercel.app';
    const path = `${base}/api/admin/review-company`;
    const q: string[] = [];
    if (params.page) q.push(`page=${encodeURIComponent(String(params.page))}`);
    if (params.limit) q.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params.status) q.push(`status=${encodeURIComponent(params.status)}`);
  if (params.search) q.push(`search=${encodeURIComponent(params.search)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    const url = `${path}${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    // Support multiple shapes; prefer the documented 'requests' list
    const items: any[] = Array.isArray(res?.requests) ? res.requests
      : (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : [])));
    const total: number | undefined = (typeof res?.total === 'number') ? res.total
      : (typeof res?.count === 'number' ? res.count : (typeof res?.totalItems === 'number' ? res.totalItems : undefined));
    const mapped = items.map((x: any) => ({
      id: (x.id ?? x._id ?? x.requestId ?? '').toString(),
      companyName: x.name ?? x.companyName ?? x.company?.name,
      email: x.requestedBy?.email ?? x.email ?? x.requesterEmail ?? x.student?.email,
      studentId: (x.requestedBy?.id ?? x.studentId ?? x.student?.id ?? '').toString() || undefined,
      registrationNo: x.requestedBy?.regNo ?? x.registrationNo ?? x.student?.registrationNo,
      status: x.status ?? x.state,
      createdAt: x.createdAt ?? x.requestedAt
    })).filter(r => !!r.id);
    return { items: mapped, total };
  }

  async reviewCompanyRequest(input: { requestId: string; decision: 'APPROVED'|'REJECTED'; notes?: string }): Promise<{ message?: string }>{
    // Use absolute Vercel URL for review action too
    const base = 'https://cui-internship-system-git-dev-zas-projects-7d9cf03b.vercel.app';
    const headers = await this.authHeaders(true);
    // Try primary endpoint: POST /api/admin/review-company
    const postJson = async (path: string, body: any) => {
      const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
      return await firstValueFrom(this.http.post<any>(url, body, { headers }));
    };
    try {
      const res = await postJson('/api/admin/review-company', { requestId: input.requestId, action: input.decision, notes: input.notes });
      return res;
    } catch (errPrimary) {
      // Fallback split endpoints: /approve or /reject
      try {
        const suffix = input.decision === 'APPROVED' ? 'approve' : 'reject';
        const res = await postJson(`/api/admin/review-company/${suffix}`, { requestId: input.requestId });
        return res;
      } catch (err) {
        throw errPrimary;
      }
    }
  }

  async assignSiteSupervisorToCompany(payload: { siteSupervisorId: string; companyId: string }): Promise<any> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/assign-supervisor';
    const url = environment.production ? path : `${base}${path}`;
  const headers = await this.authHeaders(true);
    const body = { siteSupervisorId: String(payload.siteSupervisorId), companyId: String(payload.companyId) };
  return await firstValueFrom(this.http.post<any>(url, body, { headers }));
  }

  async getCompanySupervisors(companyId: string): Promise<{ company: any; supervisors: any[]; totalSupervisors?: number }> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = `/api/admin/company-supervisors?companyId=${encodeURIComponent(companyId)}`;
    const url = environment.production ? path : `${base}${path}`;
  const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const company = res?.company ?? {};
    const supervisors = Array.isArray(res?.company?.supervisors) ? res.company.supervisors : (Array.isArray(res?.supervisors) ? res.supervisors : []);
    return { company, supervisors, totalSupervisors: res?.totalSupervisors };
  }

  async getCompaniesWithSupervisorCounts(): Promise<any[]> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/company-supervisors';
    const url = environment.production ? path : `${base}${path}`;
  const res = await firstValueFrom(this.http.post<any>(url, '', { headers: await this.authHeaders() }));
    const companies: any[] = Array.isArray(res?.companies) ? res.companies : (Array.isArray(res) ? res : []);
    return companies;
  }

  // APEX Forms Management APIs
  async getApexAForms(): Promise<Array<{ id: string; startDate?: string; endDate?: string; status?: string; student?: { id: string; name: string; email: string; regNo: string } }>> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/appex-a';
    const url = environment.production ? path : `${base}${path}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return data.map((item: any) => ({
      id: item.id || item._id || '',
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status || 'pending',
      student: {
        id: item.student?.id || item.student?._id || '',
        name: item.student?.name || '',
        email: item.student?.email || '',
        regNo: item.student?.regNo || ''
      }
    }));
  }

  async updateApexAStatus(formId: string, studentId: string, status: 'approved' | 'rejected'): Promise<any> {
    if (!formId || !studentId || !status) {
      throw new Error('AppEx A ID, student ID and status are required');
    }
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/appex-a';
    const url = environment.production ? path : `${base}${path}`;
    const body = { 
      id: formId, 
      appexAId: formId,
      studentId, 
      status 
    };
    return await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
  }

  async getApexBForms(params?: { id?: string; status?: string }): Promise<any> {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/appex-b';
    
    // Build query string
    const queryParams = [];
    if (params?.id) queryParams.push(`id=${encodeURIComponent(params.id)}`);
    if (params?.status) queryParams.push(`status=${encodeURIComponent(params.status)}`);
    const qs = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    
    const url = environment.production ? `${path}${qs}` : `${base}${path}${qs}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders() }));
    
    // If fetching single record by ID, return it directly
    if (params?.id) {
      return res?.data || res;
    }
    
    // Otherwise return array
    const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return data.map((item: any) => ({
      id: item.id || item._id || '',
      name: item.name,
      degreeProgram: item.degreeProgram,
      email: item.email,
      semester: item.semester,
      contactNo: item.contactNo,
      preferredField: item.preferredField,
      companyName: item.companyName,
      internshipRole: item.internshipRole,
      facultySupervisorNameDesig: item.facultySupervisorNameDesig,
      siteSupervisorNameDesig: item.siteSupervisorNameDesig,
      durationWeeks: item.durationWeeks,
      startDate: item.startDate,
      endDate: item.endDate,
      agreementAccepted: item.agreementAccepted,
      status: item.status || 'PENDING_VERIFICATION',
      adminApproved: item.adminApproved || item.adminVerified || item.status === 'approved' || false,
      adminApprovalStatus: item.adminApprovalStatus || item.status,
      facultyVerified: item.facultyVerified,
      facultyVerifiedAt: item.facultyVerifiedAt,
      facultyVerificationComments: item.facultyVerificationComments,
      studentVerified: item.studentVerified,
      studentVerifiedAt: item.studentVerifiedAt,
      studentVerificationComments: item.studentVerificationComments,
      student: item.student ? {
        id: item.student.id || item.student._id || '',
        name: item.student.name || '',
        email: item.student.email || '',
        regNo: item.student.regNo || ''
      } : undefined,
      faculty: item.faculty ? {
        id: item.faculty.id || '',
        name: item.faculty.name || '',
        email: item.faculty.email || ''
      } : undefined,
      site: item.site ? {
        id: item.site.id || '',
        name: item.site.name || '',
        email: item.site.email || ''
      } : undefined
    }));
  }

  // Admin updates APEX B extended details (company, role, supervisors, dates, IDs)
  // This PATCH endpoint is for updating internship details and admin approval

  async updateApexBDetails(details: {
    studentId: string;
    companyName?: string;
    internshipRole?: string;
    facultySupervisorNameDesig?: string;
    siteSupervisorNameDesig?: string;
    facultyId?: string | null;
    siteId?: string | null;
    durationWeeks?: number;
    startDate?: string;
    endDate?: string;
    adminApprovalAction?: 'approve' | 'reject';
  }): Promise<any> {
    if (!details.studentId) {
      throw new Error('studentId is required');
    }
    
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const path = '/api/admin/appex-b';
    const url = environment.production ? path : `${base}${path}`;
    
    // Helper to convert dates to ISO 8601 format
    const toISODate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toISOString();
      } catch {
        return dateStr;
      }
    };
    
    // Build clean payload matching API expectations
    const body: any = {
      studentId: details.studentId
    };
    
    if (details.companyName !== undefined) body.companyName = details.companyName;
    if (details.internshipRole !== undefined) body.internshipRole = details.internshipRole;
    if (details.facultySupervisorNameDesig !== undefined) body.facultySupervisorNameDesig = details.facultySupervisorNameDesig;
    if (details.siteSupervisorNameDesig !== undefined) body.siteSupervisorNameDesig = details.siteSupervisorNameDesig;
    if (details.durationWeeks !== undefined) body.durationWeeks = details.durationWeeks;
    if (details.startDate !== undefined) body.startDate = toISODate(details.startDate);
    if (details.endDate !== undefined) body.endDate = toISODate(details.endDate);
    if (details.facultyId !== undefined) body.facultyId = details.facultyId;
    if (details.siteId !== undefined) body.siteId = details.siteId;
    if (details.adminApprovalAction !== undefined) body.adminApprovalAction = details.adminApprovalAction;
    
    // Verify at least one updateable field beyond studentId is provided
    const updateFields = ['companyName', 'internshipRole', 'facultySupervisorNameDesig', 'siteSupervisorNameDesig', 'facultyId', 'siteId', 'durationWeeks', 'startDate', 'endDate', 'adminApprovalAction'];
    const hasUpdateField = updateFields.some(field => body.hasOwnProperty(field));
    if (!hasUpdateField) {
      throw new Error('At least one field to update must be provided');
    }
    
    console.log('[AdminService] updateApexBDetails final payload:', JSON.stringify(body, null, 2));
    return await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
  }
}
