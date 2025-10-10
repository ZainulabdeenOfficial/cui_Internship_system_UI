import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CreateAccountRequest, CreateAccountResponse } from '../models/admin/create-account.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}
  
  private createUrl = (() => {
    const path = (environment.adminCreateAccountUrl?.trim() || '/api/admin/create-account');
    const absBase = environment.apiBaseUrl.replace(/\/$/, '');
    return path.startsWith('http') ? path : `${absBase}${path.startsWith('/') ? '' : '/'}${path}`;
  })();

  async createAccount(input: CreateAccountRequest): Promise<CreateAccountResponse> {
    const body = {
      email: (input.email || '').trim(),
      name: (input.name || '').trim(),
      password: input.password,
      role: input.role || 'ADMIN'
    } as CreateAccountRequest;
    if (!body.email || !body.name || !body.password) throw new Error('Missing required fields');
   
    if (environment.production && this.createUrl.startsWith('http:')) throw new Error('Insecure endpoint');
    const post = (url: string) => this.http.post<CreateAccountResponse>(url, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
    try {
      return await firstValueFrom(post(this.createUrl));
    } catch (err: any) {
      // Fallback: only on true network/CORS error (status 0). Do NOT fallback on 401/403/etc.
      if (err && err.status === 0) {
        const rel = (environment.adminCreateAccountUrl?.trim() || '/api/admin/create-account');
        return await firstValueFrom(post(rel));
      }
      throw err;
    }
  }
}
