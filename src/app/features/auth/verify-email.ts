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
  email = '';
  message = '';
  loading = false;
  sentOnce = false;
  cooldownSec = 0;
  private cooldownTimer: any;
  slow = false;
  private slowTimer: any;

  constructor(private auth: AuthService) {}

  async resend() {
    if (!this.email) return;
    if (this.cooldownSec > 0) return;
    this.loading = true;
    this.message = 'Sending verification email...';
    this.slow = false; if (this.slowTimer) clearTimeout(this.slowTimer); this.slowTimer = setTimeout(() => this.slow = true, 1200);
    try {
      // Optimistic immediate feedback
      this.message = 'Request sent. Check your inbox.';
      const res = await this.auth.sendVerificationEmail(this.email, { timeoutMs: 3000 });
      if (res?.message && !/timeout/i.test(res.message)) {
        this.message = res.message;
      }
      this.sentOnce = true;
      this.startCooldown();
    } catch (e: any) {
      this.message = e?.error?.message || e?.message || 'Failed to send verification email';
    } finally {
      this.loading = false;
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false;
    }
  }

  private startCooldown(seconds: number = 20) {
    this.cooldownSec = seconds;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.cooldownSec--;
      if (this.cooldownSec <= 0) { clearInterval(this.cooldownTimer); this.cooldownTimer = null; }
    }, 1000);
  }
}
