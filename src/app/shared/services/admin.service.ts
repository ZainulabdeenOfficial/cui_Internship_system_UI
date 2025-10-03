import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CreateAccountRequest, CreateAccountResponse } from '../models/admin/create-account.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}
  // In dev we rely on proxy for /api; in prod use absolute base
  private base = (environment.production ? environment.apiBaseUrl.replace(/\/$/, '') : '').replace(/\/$/, '');

  async createAccount(input: CreateAccountRequest): Promise<CreateAccountResponse> {
    const url = `${this.base}/api/admin/create-account`;
    return await firstValueFrom(
      this.http.post<CreateAccountResponse>(url, input, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) })
    );
  }
}
