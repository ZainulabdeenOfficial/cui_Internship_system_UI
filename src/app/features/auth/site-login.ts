import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-site-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-login.html',
  styleUrl: './site-login.css'
})
export class SiteLogin {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { email: '', password: '' };
  error: string | null = null;
  submit() {
    try {
      this.store.loginSite(this.model.email.trim(), this.model.password.trim());
      this.router.navigate(['/site']);
    } catch (e: any) {
      this.error = e?.message || 'Invalid credentials';
    }
  }
}
