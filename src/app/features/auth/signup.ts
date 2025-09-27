import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  private store = inject(StoreService);
  private router = inject(Router);
  private http = inject(HttpClient);
  model = { name: '', email: '', password: '', registrationNo: '' };
  error: string | null = null;
  submit() {
    // Fire-and-forget external registration API; log output to console as requested
    const payload = { name: this.model.name, email: this.model.email, password: this.model.password, role: 'student' } as const;
    const url = 'https://ranging-systems-genealogy-quest.trycloudflare.com/api/auth/register';
    this.http.post(url, payload).subscribe({
      next: (res) => console.log('Register API response:', res),
      error: (err) => console.error('Register API error:', err)
    });

    // Keep local signup to maintain app functionality
    try {
      this.store.signup(this.model.name.trim(), this.model.email.trim(), this.model.password.trim(), this.model.registrationNo.trim());
      this.router.navigate(['/student']);
    } catch (e: any) {
      this.error = e?.message ?? 'Signup failed';
    }
  }
}
