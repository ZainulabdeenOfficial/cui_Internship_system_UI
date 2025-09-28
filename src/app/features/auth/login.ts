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

  async submit() {
    this.error = null;
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
      const p = this.store.login(this.model.email.trim(), this.model.password);
      await Promise.allSettled([Promise.resolve(p), this.minDelay(500)]);
      // simple remember-me persistence of last email
      if (this.remember) localStorage.setItem('lastStudentEmail', this.model.email.trim());
      // reset counters on success
      this.failedAttempts = 0; this.cooldownUntil = 0; this.challenge = null; this.challengeAnswer = '';
      this.router.navigate(['/student']);
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
    } finally {
      await this.minDelay(200); // small UX delay for spinner smoothness
      this.loading = false;
    }
  }
}
