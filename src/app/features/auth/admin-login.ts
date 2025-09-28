import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { username: '', password: '' };
  error: string | null = null;
  showPassword = false;
  loading = false;
  private minDelay(ms:number){ return new Promise(res=>setTimeout(res, ms)); }
  async submit() {
    // Demo authentication: accept username 'admin' and password 'admin123'
    this.error = null;
    this.loading = true;
    try {
      await this.minDelay(500);
      if (this.model.username === 'admin' && this.model.password === 'admin123') {
        this.store.loginAsRole('admin');
        this.router.navigate(['/admin']);
      } else {
        this.error = 'Invalid credentials';
      }
    } finally {
      await this.minDelay(200);
      this.loading = false;
    }
  }
}
