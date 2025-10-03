import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

export class Login implements OnDestroy {
  constructor(private store: StoreService, private router: Router, private auth: AuthService, private route: ActivatedRoute, private toast: ToastService) {
    this.generateCaptcha();
    // Warm up the student route chunk in the background to speed up post-login navigation
    try { import('../../features/student/student'); } catch {}
  }
  model = { email: '', password: '' };
  error: string | null = null;
  showPassword = false;
  remember = false;
  loading = false;
  slow = false;
  private slowTimer: any;
  failedAttempts = 0;
  cooldownUntil = 0; // epoch ms
  now = Date.now();
  private ticker: any;
  challenge: { a: number; b: number } | null = null;
  challengeAnswer = '';
  captchaCode = '';
  captchaInput = '';
  captchaError: string | null = null;
  signupMsg = '';
  apiMessage: string | null = null;

  // Initialize optional success message if redirected from signup
  // no ngOnInit lifecycle hook, do initialization inline for simplicity
  private initFromQueryOnce = (() => {
    try {
      this.route.queryParamMap.subscribe(p => {
        if (p.get('created') === '1') { this.signupMsg = 'Account created. Please login.'; }
      });
    } catch {}
    return true;
  })();

  ngOnDestroy(): void { if (this.ticker) clearInterval(this.ticker); }
  private startTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = setInterval(() => { this.now = Date.now(); if (this.cooldownRemaining() === 0) { clearInterval(this.ticker); this.ticker = null; } }, 500);
  }
  cooldownRemaining(): number { return Math.max(0, Math.ceil((this.cooldownUntil - this.now) / 1000)); }
  private newChallenge() { this.challenge = { a: Math.floor(Math.random()*10)+1, b: Math.floor(Math.random()*10)+1 }; this.challengeAnswer = ''; }
  get challengeActive() { return this.failedAttempts >= 3; }
  isChallengeCorrect(): boolean { return !!this.challenge && Number(this.challengeAnswer) === (this.challenge.a + this.challenge.b); }
  private minDelay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  generateCaptcha(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    this.captchaCode = out;
    this.captchaInput = '';
  }

  private ensureCaptcha() { if (!this.captchaCode) this.generateCaptcha(); }

  async submit() {
    this.error = null;
    this.apiMessage = null;
    this.captchaError = null;
    this.ensureCaptcha();
    if (this.captchaInput.trim().toUpperCase() !== this.captchaCode.toUpperCase()) {
      this.captchaError = 'Captcha does not match.';
      return;
    }
    const now = Date.now();
    if (now < this.cooldownUntil) {
      this.error = `Too many attempts. Please wait ${this.cooldownRemaining()}s and try again.`;
      return;
    }
    if (this.challengeActive) {
      if (!this.challenge) this.newChallenge();
      if (!this.isChallengeCorrect()) {
        this.error = 'Please solve the challenge to continue.';
        return;
      }
    }
  this.loading = true;
  this.slow = false;
  if (this.slowTimer) clearTimeout(this.slowTimer);
  this.slowTimer = setTimeout(() => { this.slow = true; }, 1500);
    try {
      // enforce a minimum response time to reduce timing side-channels
      const email = this.model.email.trim();
      const password = this.model.password;
    // First try backend API login
  const apiRes = await this.auth.login({ email, password }, { timeoutMs: 4000 });
  if (apiRes?.message) { this.apiMessage = apiRes.message; this.toast.info(apiRes.message); }
      if (apiRes && apiRes.success) {
        if (apiRes.token) localStorage.setItem('authToken', apiRes.token);
        if (this.remember) localStorage.setItem('lastStudentEmail', email);
        // Determine role from API user if provided; default to student
        const apiRole = (apiRes.user?.role as string | undefined)?.toLowerCase();
        if (apiRole === 'admin') {
          this.store.currentUser.set({ role: 'admin' });
          this.store.currentStudentId.set(null);
          this.toast.success('Logged in as Admin');
          this.router.navigate(['/admin']);
        } else if (apiRole === 'faculty') {
          // Try to find existing local faculty by email or create one placeholder
          const lower = email.toLowerCase();
          let f = this.store.facultySupervisors().find(u => u.email.toLowerCase() === lower);
          if (!f) { this.store.addFacultySupervisor(apiRes.user?.name || email.split('@')[0], email, undefined, password); f = this.store.facultySupervisors().find(u => u.email.toLowerCase() === lower)!; }
          this.store.currentUser.set({ role: 'faculty', facultyId: f.id });
          this.store.currentStudentId.set(null);
          this.toast.success('Logged in as Faculty');
          this.router.navigate(['/faculty']);
        } else if (apiRole === 'site') {
          const lower = email.toLowerCase();
          let ssv = this.store.siteSupervisors().find(u => u.email.toLowerCase() === lower);
          if (!ssv) { const companyId = undefined; this.store.addSiteSupervisor(apiRes.user?.name || email.split('@')[0], email, companyId, password); ssv = this.store.siteSupervisors().find(u => u.email.toLowerCase() === lower)!; }
          this.store.currentUser.set({ role: 'site', siteId: ssv.id });
          this.store.currentStudentId.set(null);
          this.toast.success('Logged in as Site Supervisor');
          this.router.navigate(['/site']);
        } else {
          // Default student flow
          const lower = email.toLowerCase();
          let s = this.store.students().find(u => u.email.toLowerCase() === lower);
          if (!s) {
            const name = (apiRes.user?.name as string) || email.split('@')[0];
            const regNo = (apiRes.user?.regNo as string) || (apiRes.user?.registrationNo as string) || '';
            s = this.store.createStudent({ name, email, password, registrationNo: regNo });
          }
          this.store.currentStudentId.set(s.id);
          this.store.currentUser.set({ role: 'student', studentId: s.id });
          try {
            localStorage.setItem('currentStudentId', JSON.stringify(s.id));
            localStorage.setItem('currentUser', JSON.stringify({ role: 'student', studentId: s.id }));
          } catch {}
          this.toast.success('Logged in as Student');
          this.router.navigate(['/student']);
        }
      } else {
        // If API responded with failure (non-timeout), show server message and fallback to local roles
        if (apiRes && apiRes.message) { this.error = apiRes.message; this.toast.danger(apiRes.message); }
        let navigated = false;
        const tryLogin = async (fn: () => any, path: string) => {
          try {
            const res = await Promise.resolve(fn());
            if (!navigated) {
              navigated = true;
              if (path === '/admin') this.toast.success('Logged in as Admin (local)');
              else if (path === '/faculty') this.toast.success('Logged in as Faculty (local)');
              else if (path === '/site') this.toast.success('Logged in as Site Supervisor (local)');
              else this.toast.success('Logged in as Student (local)');
              this.router.navigate([path]);
            }
            return res;
          } catch { throw 'fail'; }
        };
        await Promise.allSettled([
          (async () => {
            try {
              await tryLogin(() => this.store.loginAdmin(email, password), '/admin');
            } catch {
              try { await tryLogin(() => this.store.loginFaculty(email, password), '/faculty'); }
              catch {
                try { await tryLogin(() => this.store.loginSite(email, password), '/site'); }
                catch {
                  const s = await tryLogin(() => this.store.login(email, password), '/student');
                  if (this.remember) localStorage.setItem('lastStudentEmail', email);
                  return s;
                }
              }
            }
          })(),
          this.minDelay(500)
        ]);
      }
      // reset counters on success
      this.failedAttempts = 0; this.cooldownUntil = 0; this.challenge = null; this.challengeAnswer = ''; this.generateCaptcha();
    } catch (e: any) {
      // Handle timeouts without penalizing attempts
      if (e && (e.message?.toString().toLowerCase().includes('timeout') || e.code === 'timeout')) {
        this.error = 'Server took too long to respond. Please try again.';
        this.toast.warning(this.error);
      } else {
        // generic error to avoid user enumeration
        this.error = 'Invalid email or password';
        this.toast.danger(this.error);
        this.failedAttempts++;
      }
      if (this.failedAttempts >= 3) {
        if (!this.challenge) this.newChallenge();
        const backoff = Math.min(60, Math.pow(2, this.failedAttempts - 2));
        this.cooldownUntil = Date.now() + backoff * 1000;
        this.startTicker();
      }
      // Refresh captcha on any failure
      this.generateCaptcha();
    } finally {
      this.loading = false;
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false;
    }
  }

}
