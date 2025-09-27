import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { email: '', password: '' };
  error: string | null = null;
  submit() {
    try {
      this.store.login(this.model.email, this.model.password);
      this.router.navigate(['/student']);
    } catch (e: any) {
      this.error = e?.message ?? 'Login failed';
    }
  }
}
