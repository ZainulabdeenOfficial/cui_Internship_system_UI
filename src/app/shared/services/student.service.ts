import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export type InternshipType = 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID'|string;

export interface StudentRequestOptions {
  skipGlobalLoading?: boolean;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  /** Suppress the global error toast — use for non-critical background fetches. */
  silentError?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private http: HttpClient) {}

  private base = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly cachePrefix = 'student.api.cache.';
  private readonly defaultCacheTtlMs = 5 * 60 * 1000;
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

  private withRequestOptions(headers: HttpHeaders, options?: StudentRequestOptions): HttpHeaders {
    if (options?.skipGlobalLoading) {
      headers = headers.set('X-Skip-Global-Loading', 'true');
    }
    if (options?.silentError) {
      headers = headers.set('X-Silent-Error', 'true');
    }
    return headers;
  }

  private cacheKey(endpoint: string): string {
    const token = this.getAuthToken();
    const userPart = token ? token.slice(-16) : 'anon';
    return `${this.cachePrefix}${userPart}:${endpoint}`;
  }

  private readCache<T>(key: string, options?: StudentRequestOptions): T | null {
    if (options?.forceRefresh) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { expiresAt?: number; data?: T };
      if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
        sessionStorage.removeItem(key);
        return null;
      }
      return (parsed.data ?? null) as T | null;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, data: T, ttlMs?: number): void {
    try {
      const expiresAt = Date.now() + (ttlMs ?? this.defaultCacheTtlMs);
      sessionStorage.setItem(key, JSON.stringify({ expiresAt, data }));
    } catch {}
  }

  private clearCache(endpoint: string): void {
    try {
      sessionStorage.removeItem(this.cacheKey(endpoint));
    } catch {}
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
  async getAppExA(options?: StudentRequestOptions): Promise<any> {
    const key = this.cacheKey('appex-a');
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs('/api/student/appex-a');
    const token = this.getAuthToken();
    const headers = this.withRequestOptions(new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs);
    return res;
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
    const res = await firstValueFrom(this.http.post<any>(url, cleanPayload, { headers }));
    this.clearCache('appex-a');
    return res;
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
    const res = await firstValueFrom(this.http.put<any>(url, cleanPayload, { headers }));
    this.clearCache('appex-a');
    return res;
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

    // Build clean payload - only include fields that have values
    const cleanPayload: any = {
      organizationOverview: payload.organizationOverview || '',
      keyActivities: buildKeyActivities(payload) || ''
    };
    
    // Add optional fields only if they have values
    if (payload.roleDescription) {
      cleanPayload.roleDescription = payload.roleDescription;
    }
    
    const toolsTech = payload.toolsTechnologies || payload.tools;
    if (toolsTech) {
      cleanPayload.toolsTechnologies = toolsTech;
    }
    
    if (payload.expectedDeliverables) {
      cleanPayload.expectedDeliverables = payload.expectedDeliverables;
    }
    
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

    // Build payload with only non-empty fields
    const cleanPayload: any = {};
    
    if (payload.organizationOverview) {
      cleanPayload.organizationOverview = payload.organizationOverview;
    }
    
    if (payload.roleDescription) {
      cleanPayload.roleDescription = payload.roleDescription;
    }
    
    if (payload.keyActivities) {
      const keyActivitiesStr = buildKeyActivities(payload);
      if (keyActivitiesStr) {
        cleanPayload.keyActivities = keyActivitiesStr;
      }
    }
    
    const toolsTech = payload.toolsTechnologies || payload.tools;
    if (toolsTech) {
      cleanPayload.toolsTechnologies = toolsTech;
    }
    
    if (payload.expectedDeliverables) {
      cleanPayload.expectedDeliverables = payload.expectedDeliverables;
    }
    
    // Ensure at least one field is being updated
    if (Object.keys(cleanPayload).length === 0) {
      throw new Error('At least one field to update must be provided');
    }
    
    const url = this.abs('/api/student/appex-c');
    const headers = this.jsonHeaders();
    console.log('📤 [updateAppExC] Sending updated payload:', JSON.stringify(cleanPayload, null, 2));
    return await firstValueFrom(this.http.put<any>(url, cleanPayload, { headers }));
  }

  // POST /api/student/appex-a (organization/company details)
  async submitAppexA(payload: {
    organization: string;
    address: string;
    industrySector: string;
    contactName: string;
    contactDesignation: string;
    contactPhone: string;
    contactEmail: string;
    internshipLocation: string;
    internshipNature: string;
    mode: string;
    numberOfInternship: string;
    startDate: string;
    endDate: string;
    workingDays: string;
    workingHours: string;
  }) {
    const url = this.abs('/api/student/appex-a');
    return await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // PATCH /api/student/appex-a (update organization/company details)
  async updateAppexA(payload: Partial<{
    organization: string;
    address: string;
    industrySector: string;
    contactName: string;
    contactDesignation: string;
    contactPhone: string;
    contactEmail: string;
    internshipLocation: string;
    internshipNature: string;
    mode: string;
    numberOfInternship: string;
    startDate: string;
    endDate: string;
    workingDays: string;
    workingHours: string;
  }>) {
    const url = this.abs('/api/student/appex-a');
    return await firstValueFrom(this.http.patch<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // POST /api/student/appex-b-verification
  async submitAppexBVerification(payload: {
    name: string;
    degreeProgram: string;
    email: string;
    semester: string;
    contactNo: string;
    preferredField: string;
    companyName: string;
    internshipRole: string;
    facultySupervisorNameDesig: string;
    siteSupervisorNameDesig: string;
    durationWeeks: number;
    startDate: string;
    endDate: string;
    agreementAccepted?: boolean;
  }) {
    const url = this.abs('/api/student/appex-b-verification');
    return await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // PATCH /api/student/appex-b-verification - Student verifies their APEX B after admin/faculty completion
  async verifyAppexB(): Promise<any> {
    const url = this.abs('/api/student/appex-b-verification');
    const payload = { action: 'approve' };
    return await firstValueFrom(this.http.patch<any>(url, payload, { headers: this.jsonHeaders() }));
  }

  // GET /api/student/appex-b-verification
  async getAppexBVerification(options?: StudentRequestOptions): Promise<any> {
    const key = this.cacheKey('appex-b-verification');
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs('/api/student/appex-b-verification');
    const token = this.getAuthToken();
    const headers = this.withRequestOptions(new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  // POST /api/student/weekly-logs
  async submitWeeklyLog(payload: {
    weekNo: number;
    activitiesDone: string;
    skillsLearned: string;
    challenges: string;
  }) {
    const url = this.abs('/api/student/weekly-logs');
    const res = await firstValueFrom(this.http.post<any>(url, payload, { headers: this.jsonHeaders() }));
    this.clearCache('weekly-logs');
    return res;
  }

  // GET /api/student/weekly-logs
  async getWeeklyLogs(options?: StudentRequestOptions): Promise<any> {
    const key = this.cacheKey('weekly-logs');
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs('/api/student/weekly-logs');
    const token = this.getAuthToken();
    const headers = this.withRequestOptions(new HttpHeaders({ 
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * GET /api/site/evaluations?internshipId=<id>[&type=<type>]
   * Retrieve evaluations for a specific internship.
   * Accessible to the student, their assigned faculty/site supervisor, and admins.
   * Optionally filter by evaluation type: 'site_mid' | 'site_final'.
   */
  async getEvaluations(internshipId: string, type?: 'site_mid' | 'site_final', options?: StudentRequestOptions): Promise<{ message: string; evaluations: any[] }> {
    const params: string[] = [`internshipId=${encodeURIComponent(internshipId)}`];
    if (type) params.push(`type=${encodeURIComponent(type)}`);
    const endpoint = `/api/site/evaluations?${params.join('&')}`;
    const key = this.cacheKey(endpoint);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs(endpoint);
    const headers = this.withRequestOptions(new HttpHeaders({
      Accept: 'application/json',
      ...(this.getAuthToken() ? { Authorization: `Bearer ${this.getAuthToken()}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * GET /api/student/internship  — resolves the student's own internship record & ID.
   * Falls back to GET /api/student/appex-a which wraps response in { internship: { id, appexA } }.
   */
  async getMyInternship(options?: StudentRequestOptions): Promise<any> {
    const key = this.cacheKey('my-internship');
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const headers = (opt?: StudentRequestOptions) => this.withRequestOptions(new HttpHeaders({
      Accept: 'application/json',
      ...(this.getAuthToken() ? { Authorization: `Bearer ${this.getAuthToken()}` } : {})
    }), opt);

    // Primary: /api/student/internship
    try {
      const res = await firstValueFrom(this.http.get<any>(this.abs('/api/student/internship'), { headers: headers(options) }));
      this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
      return res;
    } catch (primary) {
      // Fallback: /api/student/appex-a also returns { internship: { id, appexA } }
      try {
        const res = await firstValueFrom(this.http.get<any>(this.abs('/api/student/appex-a'), { headers: headers({ skipGlobalLoading: true }) }));
        this.writeCache(key, res, 60 * 1000);
        return res;
      } catch { throw primary; }
    }
  }

  /**
   * GET /api/faculty/evaluation-summary?internshipId=...
   * Retrieve evaluation summary (Faculty/Site/Office marks, total, pass/fail).
   * Accessible to student, faculty supervisor, site supervisor, and admin.
   */
  async getEvaluationSummary(internshipId: string, options?: StudentRequestOptions): Promise<any> {
    const endpoint = `/api/faculty/evaluation-summary?internshipId=${encodeURIComponent(internshipId)}`;
    const key = this.cacheKey(endpoint);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs(endpoint);
    const headers = this.withRequestOptions(new HttpHeaders({
      Accept: 'application/json',
      ...(this.getAuthToken() ? { Authorization: `Bearer ${this.getAuthToken()}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * GET /api/faculty/evaluation-form?internshipId=...
   * Retrieve the submitted faculty evaluation form.
   * Accessible to student, faculty supervisor, site supervisor, and admin.
   */
  async getFacultyEvaluationForm(internshipId: string, options?: StudentRequestOptions): Promise<any> {
    const endpoint = `/api/faculty/evaluation-form?internshipId=${encodeURIComponent(internshipId)}`;
    const key = this.cacheKey(endpoint);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs(endpoint);
    const headers = this.withRequestOptions(new HttpHeaders({
      Accept: 'application/json',
      ...(this.getAuthToken() ? { Authorization: `Bearer ${this.getAuthToken()}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * GET /api/admin/office-evaluation?internshipId=...
   * Retrieve the submitted office evaluation form.
   * Accessible to student, faculty supervisor, site supervisor, and admin.
   */
  async getAdminOfficeEvaluation(internshipId: string, options?: StudentRequestOptions): Promise<any> {
    const endpoint = `/api/admin/office-evaluation?internshipId=${encodeURIComponent(internshipId)}`;
    const key = this.cacheKey(endpoint);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = this.abs(endpoint);
    const headers = this.withRequestOptions(new HttpHeaders({
      Accept: 'application/json',
      ...(this.getAuthToken() ? { Authorization: `Bearer ${this.getAuthToken()}` } : {})
    }), options);
    const res = await firstValueFrom(this.http.get<any>(url, { headers }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }
}
