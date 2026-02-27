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
}
