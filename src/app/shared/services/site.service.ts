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
  comments: string;
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
    const url = `/api/site/evaluations`;
    try {
      const res = await firstValueFrom(
        this.http.post<SiteEvaluationResponse>(url, payload, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
    } catch (err: any) {
      // Fallback to absolute URL on network/CORS errors
      const status = err?.status ?? 0;
      if (status && status !== 0) throw err;
      const abs = `${this.base}${url}`;
      const res = await firstValueFrom(
        this.http.post<SiteEvaluationResponse>(abs, payload, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
    }
  }
  
  /**
   * GET /api/site/internships?status=all
   * Returns internships where the authenticated site supervisor is assigned.
   * Sends Authorization Bearer token in the request header.
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
      console.log('✅ [SiteService] Site internships retrieved successfully');
      return res;
    } catch (err: any) {
      const statusCode = err?.status ?? 0;
      console.error(`❌ [SiteService] GET ${url} failed (HTTP ${statusCode}):`, err?.error?.message || err?.message);
      if (statusCode && statusCode !== 0) throw err;
      const abs = `${this.base}${url}`;
      try {
        console.log(`🔄 [SiteService] Retrying GET ${abs} with Bearer token`);
        const res = await firstValueFrom(
          this.http.get<GetSiteInternshipsResponse>(abs, { headers: this.jsonHeaders(true), withCredentials: true })
        );
        console.log('✅ [SiteService] Site internships retrieved (absolute URL)');
        return res;
      } catch (absErr: any) {
        const absStatus = absErr?.status ?? 0;
        console.error(`❌ [SiteService] GET ${abs} failed (HTTP ${absStatus}):`, absErr?.error?.message || absErr?.message);
        throw absErr;
      }
    }
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
