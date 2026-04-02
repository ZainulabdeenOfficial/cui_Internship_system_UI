import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { SILENT_ERROR, SKIP_GLOBAL_LOADING } from '../../core/interceptors/http.interceptor';

export interface FacultyInternship {
  id: string;
  studentId: string;
  facultyId: string;
  siteId?: string;
  type: string;
  startDate?: string;
  endDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  student: { id: string; name: string; email: string; regNo: string };
  faculty?: { id: string; name: string; email: string };
  site?: { id: string; name: string; email: string; company?: { id: string; name: string; industry: string } };
  finalResult?: {
    id: string;
    internshipId: string;
    facultyMarks: number;
    siteMarks: number;
    officeMarks: number;
    presentationMarks: number;
    totalMarks: number;
    status: string;
    hodSignatureUrl?: string;
  };
}

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

export interface WeeklyLog {
  id: string;
  internshipId: string;
  weekNo: number;
  activitiesDone: string;
  skillsLearned: string;
  challenges: string;
  submittedDate: string;
}

export interface WeeklyLogStatus {
  totalWeeks: number;
  currentWeek: number;
  submittedWeeks: number[];
  pendingWeeks: number[];
  hasStarted: boolean;
  hasEnded: boolean;
}

export interface StudentWeeklyLogs {
  internship: FacultyInternship;
  weeklyLogs: WeeklyLog[];
  weeklyLogStatus: WeeklyLogStatus;
}

export interface FacultyRequestOptions {
  skipGlobalLoading?: boolean;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  /** Suppress the global error toast — use for non-critical background fetches. */
  silentError?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FacultyService {
  private base = environment.apiBaseUrl;
  private readonly cachePrefix = 'faculty.api.cache.';
  private readonly defaultCacheTtlMs = 2 * 60 * 1000;
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
  private async authHeaders(json = true, options?: FacultyRequestOptions): Promise<HttpHeaders> {
    const token = await this.ensureFreshToken();
    const base: Record<string, string> = { Accept: 'application/json' };
    if (json) base['Content-Type'] = 'application/json';
    if (token) base['Authorization'] = `Bearer ${token}`;
    return new HttpHeaders(base);
  }

  private buildContext(options?: FacultyRequestOptions): HttpContext {
    return new HttpContext()
      .set(SKIP_GLOBAL_LOADING, options?.skipGlobalLoading ?? false)
      .set(SILENT_ERROR, options?.silentError ?? false);
  }

  private cacheKey(endpoint: string): string {
    const token = this.getTokenFromStorage();
    const userPart = token ? token.slice(-16) : 'anon';
    return `${this.cachePrefix}${userPart}:${endpoint}`;
  }

  private readCache<T>(key: string, options?: FacultyRequestOptions): T | null {
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

  private clearCacheByPrefix(endpointPrefix: string): void {
    const token = this.getTokenFromStorage();
    const userPart = token ? token.slice(-16) : 'anon';
    const storagePrefix = `${this.cachePrefix}${userPart}:${endpointPrefix}`;
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(storagePrefix)) keys.push(key);
      }
      keys.forEach(key => sessionStorage.removeItem(key));
    } catch {}
  }

  async getProfile(options?: FacultyRequestOptions): Promise<{ message?: string; profile?: FacultyProfile }> {
    const key = this.cacheKey('profile');
    const cached = this.readCache<{ message?: string; profile?: FacultyProfile }>(key, options);
    if (cached) return cached;

    const url = `${this.base}/api/faculty/profile`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    const mapped = { message: res?.message, profile: res?.profile as FacultyProfile };
    this.writeCache(key, mapped, options?.cacheTtlMs ?? 5 * 60 * 1000);
    return mapped;
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
    const mapped = { message: res?.message, profile: res?.profile as FacultyProfile };
    this.clearCache('profile');
    return mapped;
  }

  async getAppexAApprovals(status?: string, page?: number, limit?: number, options?: FacultyRequestOptions): Promise<any> {
    let url = `${this.base}/api/faculty/appex-a-approval`;
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length) url += '?' + params.join('&');
    const key = this.cacheKey(`appex-a-approval?${params.join('&')}`);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    this.writeCache(key, res, options?.cacheTtlMs);
    return res;
  }

  async updateAppexAApproval(appexAId: string, status: 'approved' | 'rejected', comments?: string): Promise<any> {
    const url = `${this.base}/api/faculty/appex-a-approval`;
    const body = { appexAId, status, comments: comments || '' };
    const res = await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
    this.clearCacheByPrefix('appex-a-approval?');
    return res;
  }

  async getAppexBVerifications(status?: string, page?: number, limit?: number, options?: FacultyRequestOptions): Promise<any> {
    let url = `${this.base}/api/faculty/appex-b-verification`;
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length) url += '?' + params.join('&');

    const key = this.cacheKey(`appex-b-verification?${params.join('&')}`);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;
    
    console.log('🔍 [Faculty Service - Get APEX B Verifications] Request:', { url, status, page, limit });
    
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    
    console.log('✅ [Faculty Service - Get APEX B Verifications] Response:', {
      total: res?.total || res?.verifications?.length || 0,
      verifications: res?.verifications || res?.data || [],
      page: res?.page,
      totalPages: res?.totalPages
    });
    
    this.writeCache(key, res, options?.cacheTtlMs);
    return res;
  }

  async updateAppexBVerification(assignmentId: string, action: 'approve' | 'request_changes', comments?: string): Promise<any> {
    const url = `${this.base}/api/faculty/appex-b-verification`;
    const body = { assignmentId, action, comments: comments || '' };
    
    console.log('📤 [Faculty Service - Update APEX B Verification] Request:', {
      url,
      payload: body
    });
    
    const res = await firstValueFrom(this.http.patch<any>(url, body, { headers: await this.authHeaders(true) }));
    this.clearCacheByPrefix('appex-b-verification?');
    
    console.log('✅ [Faculty Service - Update APEX B Verification] Response:', {
      success: !!res,
      message: res?.message,
      data: res?.data,
      status: res?.status
    });
    
    return res;
  }

  /**
   * POST /api/faculty/evaluation-summary
   * Faculty supervisor submits their marks (0-40) for an internship.
   */
  async submitEvaluationSummary(payload: { internshipId: string; marks: number }): Promise<any> {
    const url = `${this.base}/api/faculty/evaluation-summary`;
    const body = { internshipId: payload.internshipId, marks: payload.marks };
    const res = await firstValueFrom(this.http.post<any>(url, body, { headers: await this.authHeaders(true) }));
    this.clearCache(`eval-summary-${payload.internshipId}`);
    return res;
  }

  /**
   * GET /api/faculty/evaluation-summary?internshipId=...
   * Retrieve evaluation summary (Faculty/Site/Office marks, total, pass/fail).
   * Accessible to student, faculty supervisor, site supervisor, and admin.
   */
  async getEvaluationSummary(internshipId: string, options?: FacultyRequestOptions): Promise<any> {
    const key = this.cacheKey(`eval-summary-${internshipId}`);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = `${this.base}/api/faculty/evaluation-summary?internshipId=${encodeURIComponent(internshipId)}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * POST /api/faculty/evaluation-form
   * Submit the faculty evaluation form with 6 criteria (each 1-10, total max 60, scaled to 40).
   */
  async submitEvaluationForm(payload: {
    internshipId: string;
    criteria: {
      platformActivityEngagement: number;
      completionOfInternshipProjects: number;
      earningsAchieved: number;
      skillDevelopmentLearning: number;
      clientRatingAndFeedback: number;
      professionalismCommunication: number;
    };
    comments?: string;
  }): Promise<any> {
    const url = `${this.base}/api/faculty/evaluation-form`;
    const res = await firstValueFrom(this.http.post<any>(url, payload, { headers: await this.authHeaders(true) }));
    this.clearCache(`eval-form-${payload.internshipId}`);
    this.clearCache(`eval-summary-${payload.internshipId}`);
    return res;
  }

  /**
   * GET /api/faculty/evaluation-form?internshipId=...
   * Retrieve the submitted faculty evaluation form.
   * Response: { message, evaluation: { id, type, totalMarks, maxMarks, criteria, comments, submittedDate, evaluator } }
   */
  async getEvaluationForm(internshipId: string, options?: FacultyRequestOptions): Promise<any> {
    const key = this.cacheKey(`eval-form-${internshipId}`);
    const cached = this.readCache<any>(key, options);
    if (cached) return cached;

    const url = `${this.base}/api/faculty/evaluation-form?internshipId=${encodeURIComponent(internshipId)}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 60 * 1000);
    return res;
  }

  /**
   * GET /api/faculty/internships?status=all
   * Returns internships where the authenticated faculty user is assigned as faculty supervisor.
   * Includes student, site, company, and finalResult data.
   */
  async getFacultyInternships(status = 'all', options?: FacultyRequestOptions): Promise<{ message?: string; data?: FacultyInternship[] }> {
    const key = this.cacheKey(`internships?status=${status}`);
    const cached = this.readCache<{ message?: string; data?: FacultyInternship[] }>(key, options);
    if (cached) return cached;

    const url = `${this.base}/api/faculty/internships?status=${encodeURIComponent(status)}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 2 * 60 * 1000);
    return res;
  }

  /**
   * GET /api/faculty/weekly-logs
   * Retrieve weekly logs for internships where the authenticated user is the faculty supervisor.
   * Optional internshipId returns a single internship if accessible.
   */
  async getWeeklyLogs(internshipId?: string, options?: FacultyRequestOptions): Promise<{ message?: string; data?: StudentWeeklyLogs[] }> {
    let endpoint = 'weekly-logs';
    if (internshipId) {
      endpoint += `?internshipId=${encodeURIComponent(internshipId)}`;
    }
    const key = this.cacheKey(endpoint);
    const cached = this.readCache<{ message?: string; data?: StudentWeeklyLogs[] }>(key, options);
    if (cached) return cached;

    const url = `${this.base}/api/faculty/${endpoint}`;
    const res = await firstValueFrom(this.http.get<any>(url, { headers: await this.authHeaders(false, options), context: this.buildContext(options) }));
    this.writeCache(key, res, options?.cacheTtlMs ?? 2 * 60 * 1000);
    return res;
  }

  clearFacultyInternshipsCache(): void {
    this.clearCacheByPrefix('internships?');
  }

  clearWeeklyLogsCache(): void {
    this.clearCacheByPrefix('weekly-logs');
  }
