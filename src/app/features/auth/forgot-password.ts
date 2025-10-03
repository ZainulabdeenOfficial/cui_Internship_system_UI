import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['../auth/login.css'] // reuse login/signup styles for consistent UI
})
export class ForgotPassword {
  email = '';
  loading = false;
  sent = false;
  resending = false;
  message: string | null = null;

  constructor(private auth: AuthService) {}

  async submit() {
    if (!this.email) return;
    this.loading = true;
    this.message = null;
    try {
      const res = await this.auth.forgotPassword(this.email.trim());
      this.sent = true;
      this.message = res?.message || 'If this email exists, we sent a reset link.';
    } catch (e: any) {
      const status = e?.status;
      if (status === 404) {
        this.message = 'User not found';
        this.sent = false;
      } else {
        this.message = e?.error?.message || e?.message || 'Failed to send email';
      }
    } finally {
      this.loading = false;
    }
  }

  async resend() {
    if (!this.email) return;
    this.resending = true;
    try {
      const res = await this.auth.forgotPassword(this.email.trim());
      this.message = res?.message || 'Verification email sent';
    } catch (e: any) {
      this.message = e?.error?.message || e?.message || 'Failed to resend email';
    } finally {
      this.resending = false;
    }
  }
}
