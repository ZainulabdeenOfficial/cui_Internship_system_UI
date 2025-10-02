import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { StudentRegisterRequest, RegisterResponse } from '../models/auth.models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}
  private base = environment.apiBaseUrl.replace(/\/$/, '');

  async registerStudent(input: StudentRegisterRequest): Promise<RegisterResponse> {
    const url = `${this.base}/api/auth/register`;
    try {
      const res = await firstValueFrom(this.http.post<RegisterResponse>(url, input));
      return res ?? { success: true } as RegisterResponse;
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Registration failed';
      return { success: false, message };
    }
  }
}
