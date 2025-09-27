import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { username: '', password: '' };
  error: string | null = null;
  submit() {
    // Demo authentication: accept username 'admin' and password 'admin123'
    if (this.model.username === 'admin' && this.model.password === 'admin123') {
      this.store.loginAsRole('admin');
      this.router.navigate(['/admin']);
    } else {
      this.error = 'Invalid admin credentials';
    }
  }
}
