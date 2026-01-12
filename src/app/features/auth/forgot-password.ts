import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['../auth/login.css'] // reuse login/signup styles for consistent UI
})
export class ForgotPassword implements OnInit, OnDestroy {
  email = '';
  loading = false;
  sent = false;
  resending = false;
  message: string | null = null;
  redirectCountdown = 0;
  private redirectTimer: any;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(){ document.body.classList.add('auth-light'); }
  ngOnDestroy(){ 
    document.body.classList.remove('auth-light');
    if (this.redirectTimer) clearInterval(this.redirectTimer);
  }

  async submit() {
    if (!this.email) return;
    this.loading = true;
    this.message = null;
    try {
      const res = await this.auth.forgotPassword(this.email.trim());
      this.sent = true;
      this.message = res?.message || 'If this email exists, we sent a reset link.';
      // Auto-redirect to login after 3 seconds
      this.startRedirectCountdown(3);
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

  private startRedirectCountdown(seconds: number) {
    this.redirectCountdown = seconds;
    this.redirectTimer = setInterval(() => {
      this.redirectCountdown--;
      if (this.redirectCountdown <= 0) {
        clearInterval(this.redirectTimer);
        this.router.navigate(['/login']);
      }
    }, 1000);
  }

  async resend() {
    if (!this.email) return;
    this.resending = true;
    try {
      const res = await this.auth.forgotPassword(this.email.trim());
      this.message = res?.message || 'Verification email sent';
      this.sent = true;
    } catch (e: any) {
      this.message = e?.error?.message || e?.message || 'Failed to resend email';
    } finally {
      this.resending = false;
    }
  }
}
