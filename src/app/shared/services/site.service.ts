import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

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

export interface SiteInternship {
  id: string;
  studentId?: string;
  facultyId?: string;
  siteId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  student?: { id: string; name: string; email: string; regNo?: string };
  faculty?: { id: string; name: string; email: string };
  site?: { id: string; name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private base = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

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
   * GET /api/site/internships
   * Returns internships where the authenticated user is the assigned site supervisor.
   */
  async getSiteInternships(): Promise<{ success?: boolean; data?: SiteInternship[]; message?: string }> {
    const url = `/api/site/internships`;
    try {
      const res = await firstValueFrom(
        this.http.get<any>(url, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status && status !== 0) throw err;
      const abs = `${this.base}${url}`;
      const res = await firstValueFrom(
        this.http.get<any>(abs, { headers: this.jsonHeaders() })
      );
      return { success: true, ...res };
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
