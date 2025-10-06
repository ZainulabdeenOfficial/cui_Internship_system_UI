import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword implements OnInit {
  model = { token: '', password: '', confirm: '' };
  loading = false;
  slow = false;
  error: string | null = null;
  success = false;
  private slowTimer: any;
  private missingTokenRedirectTimer: any;

  constructor(private route: ActivatedRoute, private auth: AuthService, private router: Router) {
    const qpToken = this.route.snapshot.queryParamMap.get('token');
    if (qpToken) this.model.token = qpToken.trim();
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(map => {
      const t = map.get('token');
      this.model.token = t ? t.trim() : '';
      if (!this.model.token) {
        if (this.missingTokenRedirectTimer) clearTimeout(this.missingTokenRedirectTimer);
        this.missingTokenRedirectTimer = setTimeout(() => {
          if (!this.model.token && !this.loading && !this.success) {
            this.router.navigate(['/forgot-password']);
          }
        }, 2500);
      } else if (this.missingTokenRedirectTimer) {
        clearTimeout(this.missingTokenRedirectTimer);
        this.missingTokenRedirectTimer = null;
      }
    });
  }

  get passwordsMatch() { return !!this.model.password && this.model.password === this.model.confirm; }
  get canSubmit() { return this.model.token && this.passwordsMatch && this.model.password.length >= 6; }

  async submit() {
    if (!this.canSubmit || this.loading) return;
    this.error = null; this.success = false;
    this.loading = true; this.slow = false;
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.slow = true, 1500);
    try {
      const res = await this.auth.resetPassword(this.model.token.trim(), this.model.password);
      this.success = true;
     
      setTimeout(() => this.router.navigate(['/login']), 2500);
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to reset password';
    } finally {
      this.loading = false;
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false;
    }
  }
  // No manual token entry: token must come from the email link (?token=...)
}
