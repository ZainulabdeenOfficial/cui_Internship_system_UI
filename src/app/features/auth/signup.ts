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
  get regNoDisplay(): string {
    const v = (this.model.registrationNo || '').trim();
    return v;
  }
  onRegNoChange(val: string) {
    if (val == null) return;
   
    let v = String(val).toUpperCase().replace(/_/g, '-');
    
    v = v.replace(/-+/g, '-');
  
    v = v.replace(/[^A-Z0-9-]/g, '');
   
    v = v.replace(/\s+/g, '');
    
    const m = v.match(/^([A-Z]{2})(\d{0,2})(?:-)?([A-Z]{0,4})(?:-)?(\d{0,3})$/);
    if (m) {
      const part1 = m[1] + (m[2] ?? '');
      const part2 = m[3] ?? '';
      const part3 = m[4] ?? '';
      const segs: string[] = [];
      if (part1) segs.push(part1);
      if (part2) segs.push(part2);
      if (part3) segs.push(part3);
      v = segs.join('-');
    }
    this.model.registrationNo = v;
  }
  async submit() {
    this.error = null;
    this.slow = false; if (this.slowTimer) clearTimeout(this.slowTimer); this.slowTimer = setTimeout(() => this.slow = true, 1500);
    const name = this.model.name.trim();
    const email = this.model.email.trim();
    const password = this.model.password.trim();
    const regNo = this.model.registrationNo.trim();
    if (!name || !email || !password || !regNo) {
      this.error = 'All fields are required.';
      return;
    }
    const payload: StudentRegisterRequest = { name, email, password,  regNo };

  const res = await this.auth.registerStudent(payload, { timeoutMs: 4000 });
    if (!res.success) {
      this.error = res.message || 'Registration failed';
      try { this.toast.danger(this.error); } catch {}
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false;
      return;
    }
    if (res.message) { try { this.toast.info(res.message); } catch {} }

  // Redirect to login so the user can sign in after successful registration
  this.toast.success('Account created. Please login.');
  this.router.navigate(['/login'], { queryParams: { created: '1' } });
    if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
    this.slow = false;
  }
}
