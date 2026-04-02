import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { SiteInternship, GetSiteInternshipsResponse } from '../models/site/internship.models';

export interface SiteEvaluationCriteria {
  punctualityAttendance: number;
  linkTheoryToPractice: number;
  criticalThinking: number;
  technicalKnowledge: number;
  creativity: number;
  adaptability: number;
  timeManagement: number;
  professionalBehavior: number;
  assignmentsPerformance: number;
  communicationSkills: number;
}

export interface SiteEvaluationPayload {
  internshipId: string;
  type: 'site_mid' | 'site_final';
  criteria: SiteEvaluationCriteria;
  totalMarks: number;
  comments?: string;
}

export interface SiteEvaluationResponse {
  success?: boolean;
  message?: string;
  data?: any;
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private base = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  private getAuthToken(): string {
    return sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || '';
  }

  private jsonHeaders(includeAuth: boolean = true): HttpHeaders {
    const token = includeAuth ? this.getAuthToken() : '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }

  async submitEvaluation(payload: SiteEvaluationPayload): Promise<SiteEvaluationResponse> {
    // Use absolute URL directly to avoid any proxy/routing issues
    const url = `${this.base}/api/site/evaluations`;
    try {
      console.log('🔄 [SiteService.submitEvaluation] Posting to:', url);
      console.log('📦 [SiteService.submitEvaluation] Payload:', JSON.stringify(payload, null, 2));
      
      const res = await firstValueFrom(
        this.http.post<SiteEvaluationResponse>(url, payload, { headers: this.jsonHeaders() })
      );
      
      console.log('✅ [SiteService.submitEvaluation] Success response:', res);
      return { success: true, ...res };
    } catch (err: any) {
      // Log comprehensive error details
      console.error('❌ [SiteService.submitEvaluation] API error full details:', {
        status: err?.status,
        statusText: err?.statusText,
        statusCode: err?.status,
        message: err?.message,
        errorBody: err?.error,
        url: url,
        errorString: typeof err?.error === 'string' ? err.error : JSON.stringify(err?.error)
      });
      
      // Log error body for debugging
      if (err?.error) {
        console.error('❌ [SiteService.submitEvaluation] Error Response Body:', err.error);
      }
      
      // Always throw - don't retry since we already used absolute URL
      throw err;
    }
  }
  
  /**
   * GET /api/site/internships?status=all
   * Returns internships where the authenticated site supervisor is assigned.
   * Sends Authorization Bearer token in the request header.
   * Properly handles nullable fields in finalResult and optional internship IDs.
   * @param status Optional filter: 'pending' | 'approved' | 'completed' | 'rejected' | 'all' (default 'all')
   */
  async getSiteInternships(status: 'pending' | 'approved' | 'completed' | 'rejected' | 'all' = 'all'): Promise<GetSiteInternshipsResponse> {
    const token = this.getAuthToken();
    if (!token) {
      console.warn('⚠️ [SiteService] No auth token found for getSiteInternships');
    }
    const url = `/api/site/internships?status=${encodeURIComponent(status)}`;
    try {
      console.log(`🔄 [SiteService] GET ${url} with Bearer token`);
      const res = await firstValueFrom(
        this.http.get<GetSiteInternshipsResponse>(url, { headers: this.jsonHeaders(true), withCredentials: true })
      );
      console.log('✅ [SiteService] Site internships retrieved successfully', {
        count: res?.data?.length ?? 0,
        message: res?.message
      });
      // Validate and sanitize response data
      if (res?.data && Array.isArray(res.data)) {
        res.data = res.data.map(inv => this.sanitizeSiteInternship(inv));
      }
      return res;
    } catch (err: any) {
      const statusCode = err?.status ?? 0;
      console.error(`❌ [SiteService] GET ${url} failed (HTTP ${statusCode}):`, {
        message: err?.error?.message || err?.message,
        error: err?.error
      });
      // Retry with absolute URL if it's a CORS/network error
      if (statusCode === 0 || statusCode === 403 || statusCode === 0) {
        const abs = `${this.base}${url}`;
        try {
          console.log(`🔄 [SiteService] Retrying GET ${abs} with Bearer token (absolute URL)`);
          const res = await firstValueFrom(
            this.http.get<GetSiteInternshipsResponse>(abs, { headers: this.jsonHeaders(true), withCredentials: true })
          );
          console.log('✅ [SiteService] Site internships retrieved (absolute URL)', {
            count: res?.data?.length ?? 0
          });
          if (res?.data && Array.isArray(res.data)) {
            res.data = res.data.map(inv => this.sanitizeSiteInternship(inv));
          }
          return res;
        } catch (absErr: any) {
          const absStatus = absErr?.status ?? 0;
          console.error(`❌ [SiteService] GET ${abs} failed (HTTP ${absStatus}):`, absErr?.error?.message || absErr?.message);
          throw absErr;
        }
      }
      throw err;
    }
  }

  /**
   * Sanitize site internship data to ensure all fields are properly typed
   * Handles null values and missing optional fields
   */
  private sanitizeSiteInternship(inv: any): SiteInternship {
    return {
      id: inv.id || '',
      studentId: inv.studentId || '',
      facultyId: inv.facultyId || '',
      siteId: inv.siteId || '',
      type: inv.type || 'ONSITE',
      startDate: inv.startDate || new Date().toISOString(),
      endDate: inv.endDate || new Date().toISOString(),
      status: inv.status || 'PENDING',
      createdAt: inv.createdAt || new Date().toISOString(),
      updatedAt: inv.updatedAt || new Date().toISOString(),
      internshipApprovalId: inv.internshipApprovalId ?? null,
      internshipAssignmentId: inv.internshipAssignmentId ?? null,
      internshipProposalId: inv.internshipProposalId ?? null,
      student: inv.student || { id: '', name: '', email: '', regNo: '' },
      faculty: inv.faculty || { id: '', name: '', email: '' },
      site: inv.site || { id: '', name: '', email: '', company: { id: '', name: '', industry: '' } },
      finalResult: inv.finalResult ? {
        id: inv.finalResult.id || '',
        internshipId: inv.finalResult.internshipId || inv.id || '',
        facultyMarks: inv.finalResult.facultyMarks ?? null,
        siteMarks: inv.finalResult.siteMarks ?? null,
        officeMarks: inv.finalResult.officeMarks ?? null,
        presentationMarks: inv.finalResult.presentationMarks ?? null,
        totalMarks: inv.finalResult.totalMarks ?? null,
        status: inv.finalResult.status || 'pending',
        hodSignatureUrl: inv.finalResult.hodSignatureUrl ?? null
      } : null
    };
  }

  /**
   * Fetch site evaluations by internshipId and optional type filter (site_mid | site_final).
   * When type is omitted all evaluations for the internship are returned.
   * Accessible to the student, their assigned faculty/site supervisor, and admins.
   */
  async getEvaluations(internshipId: string, type?: 'site_mid' | 'site_final'): Promise<SiteEvaluationResponse> {
    const params: string[] = [`internshipId=${encodeURIComponent(internshipId)}`];
    if (type) params.push(`type=${encodeURIComponent(type)}`);
    const qs = `?${params.join('&')}`;
    const url = `/api/site/evaluations${qs}`;
    try {
      const res = await firstValueFrom(
        this.http.get<SiteEvaluationResponse>(url, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status && status !== 0) throw err;
      const abs = `${this.base}${url}`;
      const res = await firstValueFrom(
        this.http.get<SiteEvaluationResponse>(abs, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
    }
  }
}
