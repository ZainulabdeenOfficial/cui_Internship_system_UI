import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { AuthService } from '../../shared/services/auth.service';
import type { StudentRegisterRequest } from '../../shared/models/auth.models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  constructor(private store: StoreService, private router: Router, private auth: AuthService) {}
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

    const res = await this.auth.registerStudent(payload, { timeoutMs: 5000 });
    if (!res.success) {
      this.error = res.message || 'Registration failed';
      if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
      this.slow = false;
      return;
    }

    // Immediately login via API to fetch token and sync state
    const loginRes = await this.auth.login({ email, password }, { timeoutMs: 5000 });
    if (loginRes && loginRes.success) {
      if (loginRes.token) localStorage.setItem('authToken', loginRes.token);
      // Sync with local store for app state (avoid duplicate student creation)
      const lower = email.toLowerCase();
      let s = this.store.students().find(u => u.email.toLowerCase() === lower);
      if (!s) {
        const nameFromApi = (loginRes.user?.name as string) || name;
        const regFromApi = (loginRes.user?.regNo as string) || (loginRes.user?.registrationNo as string) || regNo;
        s = this.store.createStudent({ name: nameFromApi, email, password, registrationNo: regFromApi });
      }
      this.store.currentStudentId.set(s.id);
      this.store.currentUser.set({ role: 'student', studentId: s.id });
      try {
        localStorage.setItem('currentStudentId', JSON.stringify(s.id));
        localStorage.setItem('currentUser', JSON.stringify({ role: 'student', studentId: s.id }));
      } catch {}
      this.router.navigate(['/student']);
    } else {
      // fallback: navigate to login so user can sign in
      this.router.navigate(['/login']);
    }
    if (this.slowTimer) { clearTimeout(this.slowTimer); this.slowTimer = null; }
    this.slow = false;
  }
}
