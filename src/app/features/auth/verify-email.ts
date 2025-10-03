import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.html'
})
export class VerifyEmail {
  token = '';
  email = '';
  message = '';
  loading = false;

  constructor(private auth: AuthService) {}

  async submitVerify() {
    if (!this.token) return;
    this.loading = true;
    this.message = 'Verifying email...';
    try {
      const res = await this.auth.verifyEmail(this.token);
      this.message = res?.message || 'Email verified successfully';
    } catch (e: any) {
      this.message = e?.error?.message || e?.message || 'Verification failed';
    } finally {
      this.loading = false;
    }
  }

  async resend() {
    if (!this.email) return;
    this.loading = true;
    this.message = 'Sending verification email...';
    try {
      const res = await this.auth.sendVerificationEmail(this.email);
      this.message = res?.message || 'Verification email sent';
    } catch (e: any) {
      this.message = e?.error?.message || e?.message || 'Failed to send verification email';
    } finally {
      this.loading = false;
    }
  }
}
