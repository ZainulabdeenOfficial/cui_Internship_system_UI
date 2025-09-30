import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

export class Login implements OnDestroy {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { email: '', password: '' };
  error: string | null = null;
  showPassword = false;
  remember = false;
  loading = false;
  // anti-bruteforce state
  failedAttempts = 0;
  cooldownUntil = 0; // epoch ms
  now = Date.now();
  private ticker: any;
  challenge: { a: number; b: number } | null = null;
  challengeAnswer = '';
  // Simple custom captcha state (replaces Google reCAPTCHA)
  captchaCode = '';
  captchaInput = '';
  captchaError: string | null = null;

  // no ngOnInit needed

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

  // Always require captcha (can change policy easily)
  private ensureCaptcha() { if (!this.captchaCode) this.generateCaptcha(); }

  async submit() {
    this.error = null;
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
    try {
      // enforce a minimum response time to reduce timing side-channels
      const email = this.model.email.trim();
      const password = this.model.password;
      // Try admin -> faculty -> site -> student
      let navigated = false;
      const tryLogin = async (fn: () => any, path: string) => {
        try { const res = await Promise.resolve(fn()); if (!navigated) { navigated = true; this.router.navigate([path]); } return res; } catch { throw 'fail'; }
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
      // reset counters on success
      this.failedAttempts = 0; this.cooldownUntil = 0; this.challenge = null; this.challengeAnswer = ''; this.generateCaptcha();
    } catch (e: any) {
      // generic error to avoid user enumeration
  this.error = 'Invalid email or password';
      this.failedAttempts++;
      if (this.failedAttempts >= 3) {
        if (!this.challenge) this.newChallenge();
        const backoff = Math.min(60, Math.pow(2, this.failedAttempts - 2));
        this.cooldownUntil = Date.now() + backoff * 1000;
        this.startTicker();
      }
      // Refresh captcha on any failure
      this.generateCaptcha();
    } finally {
      await this.minDelay(200); // small UX delay for spinner smoothness
      this.loading = false;
    }
  }

  constructor() {
    this.generateCaptcha();
  }
}
