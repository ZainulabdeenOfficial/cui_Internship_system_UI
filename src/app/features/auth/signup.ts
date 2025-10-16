import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { AuthService } from '../../shared/services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import type { StudentRegisterRequest } from '../../shared/models/auth.models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  constructor(private store: StoreService, private router: Router, private auth: AuthService, private toast: ToastService) {}
  model = { name: '', email: '', password: '', registrationNo: '' };
  error: string | null = null;
  slow = false;
  private slowTimer: any;
  loading = false;
  emailTaken = false;
  // Validation regexes
  private universityEmailRegex = /^[a-z]{2}\d{2}-[a-z]{3}-\d{3}@students\.cuisahiwal\.edu\.pk$/i; // aa00-bbb-000@students.cuisahiwal.edu.pk
  private regNoRegex = /^[A-Z]{2}\d{2}-[A-Z]{3}-\d{3}$/; // AA00-BBB-000
  get regNoDisplay(): string {
    const v = (this.model.registrationNo || '').trim();
    return v;
  }
  onRegNoChange(val: string) {
    if (val == null) return;
    const prevReg = this.model.registrationNo;
    const out = this.sanitizeRegNo(String(val));
    this.model.registrationNo = out;
    const newDerived = this.regNoRegex.test(out) ? out.toLowerCase() + '@students.cuisahiwal.edu.pk' : '';
    this.model.email = newDerived; // Always overwrite so email stays in sync
    if (this.model.email) {
      const lower = this.model.email.toLowerCase();
      this.emailTaken = this.store.students().some(s => (s.email || '').toLowerCase() === lower);
    } else {
      this.emailTaken = false;
    }
  }
  private sanitizeRegNo(input: string): string {
    const raw = input.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
    const letters = /[A-Z]/;
    const digit = /[0-9]/;
    let seg0 = '', seg1 = '', seg2 = '', seg3 = '';
    for (const ch of raw) {
      if (seg0.length < 2) { if (letters.test(ch)) { seg0 += ch; } continue; }
      if (seg1.length < 2) { if (digit.test(ch)) { seg1 += ch; } continue; }
      if (seg2.length < 3) { if (letters.test(ch)) { seg2 += ch; } continue; }
      if (seg3.length < 3) { if (digit.test(ch)) { seg3 += ch; } continue; }
      break; // all segments full
    }
    let out = seg0;
    if (seg0.length === 2) out += seg1; // attach year digits when present
    if (seg0.length === 2 && seg1.length === 2) {
      if (seg2.length > 0) out += '-' + seg2;
      if (seg2.length === 3 && seg3.length > 0) out += '-' + seg3;
    }
    return out;
  }
  filterRegKey(ev: KeyboardEvent) {
    const allowedControl = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowedControl.includes(ev.key)) return; // allow navigation
    const key = ev.key.toUpperCase();
    if (key.length !== 1) return; // ignore other keys (e.g., F1)
    const current = this.model.registrationNo;
    // Determine logical position ignoring hyphens
    const logicalLen = current.replace(/-/g, '').length;
    if (logicalLen >= 10) { ev.preventDefault(); return; }
    if (logicalLen < 2) { // letters
      if (!/[A-Z]/.test(key)) { ev.preventDefault(); }
    } else if (logicalLen < 4) { // digits
      if (!/[0-9]/.test(key)) { ev.preventDefault(); }
    } else if (logicalLen < 7) { // dept letters
      if (!/[A-Z]/.test(key)) { ev.preventDefault(); }
    } else if (logicalLen < 10) { // roll digits
      if (!/[0-9]/.test(key)) { ev.preventDefault(); }
    }
  }
  onRegPaste(ev: ClipboardEvent) {
    ev.preventDefault();
    const txt = ev.clipboardData?.getData('text') || '';
    this.model.registrationNo = this.sanitizeRegNo(txt);
    // Trigger auto email if complete
    if (this.regNoRegex.test(this.model.registrationNo) && (!this.model.email || this.emailMatchesReg)) {
      this.model.email = this.model.registrationNo.toLowerCase() + '@students.cuisahiwal.edu.pk';
    }
  }
  get computedEmail(): string { return this.regNoRegex.test(this.model.registrationNo.trim()) ? this.model.registrationNo.trim().toLowerCase() + '@students.cuisahiwal.edu.pk' : ''; }
  get emailMatchesReg(): boolean {
    const reg = this.model.registrationNo.trim();
    if (!this.regNoRegex.test(reg)) return false;
    return this.model.email.trim().toLowerCase() === reg.toLowerCase() + '@students.cuisahiwal.edu.pk';
  }
  get regNoValid(): boolean { return this.regNoRegex.test(this.model.registrationNo.trim()); }
  async submit() {
    this.error = null;
    this.slow = false; if (this.slowTimer) clearTimeout(this.slowTimer); this.slowTimer = setTimeout(() => this.slow = true, 1500);
    // We'll set loading only after all client-side validation passes
    const name = this.model.name.trim();
  // Derive email from reg no, user cannot edit email directly
  const email = this.model.email.trim().toLowerCase(); // Already auto-derived
    const password = this.model.password.trim();
    const regNo = this.model.registrationNo.trim().toUpperCase();
    if (!name || !email || !password || !regNo) {
      this.error = 'All fields are required.';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    if (this.emailTaken) {
      this.error = 'Account already exists for this email.';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    // Enforce registration number format strictly AA00-XXXX-000 (X=dept letters 3-4)
    if (!this.regNoRegex.test(regNo)) {
      this.error = 'Registration No must be like FA22-BCS-090 (AA00-DEPT-000).';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    // Enforce university student email pattern
    if (!this.universityEmailRegex.test(email)) {
      this.error = 'Email must follow aa00-bbb-000@students.cuisahiwal.edu.pk pattern.';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    if (!this.emailMatchesReg) {
      this.error = 'Email local part must match Registration No.';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    // All validations passed; now show loader
    this.loading = true;
    // Normalize model after validation
    this.model.registrationNo = regNo;
    this.model.email = email; // store derived
    const payload: StudentRegisterRequest = { name, email, password,  regNo };

    let res;
    try {
      res = await this.auth.registerStudent(payload, { timeoutMs: 4000 });
    } catch (e:any) {
      this.error = e?.error?.message || e?.message || 'Network error';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.loading = false; this.slow = false; return;
    }
    if (!res.success) {
      this.error = res.message || 'Registration failed';
      try { this.toast.danger(this.error); } catch {}
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false; this.loading = false;
      return;
    }
    if (res.message) { try { this.toast.info(res.message); } catch {} }

  // Redirect to verify email so user can complete verification before login
  this.toast.success('Account created. Please verify your email (we sent a link).');
  this.loading = false; // stop loader before navigation
  this.router.navigate(['/verify-email']);
    if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
    this.slow = false; this.loading = false;
  }
  ngOnInit(){ document.body.classList.add('auth-light'); }
  ngOnDestroy(){ document.body.classList.remove('auth-light'); }
}
