import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CreateAccountRequest, CreateAccountResponse } from '../models/admin/create-account.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}
  
  private createUrl = (environment.adminCreateAccountUrl?.trim() || '/api/admin/create-account');

  async createAccount(input: CreateAccountRequest): Promise<CreateAccountResponse> {
    const body = {
      email: (input.email || '').trim(),
      name: (input.name || '').trim(),
      password: input.password,
      role: input.role || 'ADMIN'
    } as CreateAccountRequest;
    if (!body.email || !body.name || !body.password) throw new Error('Missing required fields');
   
    if (environment.production && this.createUrl.startsWith('http:')) throw new Error('Insecure endpoint');
    return await firstValueFrom(
      this.http.post<CreateAccountResponse>(this.createUrl, body, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        withCredentials: true
      })
    );
  }
}
