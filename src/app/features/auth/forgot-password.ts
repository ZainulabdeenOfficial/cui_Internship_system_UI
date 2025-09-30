import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['../auth/login.css'] // reuse login/signup styles for consistent UI
})
export class ForgotPassword {
  email = '';
  loading = false;
  sent = false;
  resending = false;

  async submit() {
    if (!this.email) return;
    this.loading = true;
    // Simulate async send
    await new Promise(r => setTimeout(r, 800));
    this.loading = false;
    this.sent = true;
  }

  async resend() {
    this.resending = true;
    await new Promise(r => setTimeout(r, 800));
    this.resending = false;
  }
}
