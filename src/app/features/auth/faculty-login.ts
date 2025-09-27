import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-faculty-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faculty-login.html',
  styleUrl: './faculty-login.css'
})
export class FacultyLogin {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { email: '', password: '' };
  error: string | null = null;
  submit() {
    try {
      this.store.loginFaculty(this.model.email.trim(), this.model.password.trim());
      this.router.navigate(['/faculty']);
    } catch (e: any) {
      this.error = e?.message || 'Invalid credentials';
    }
  }
}
