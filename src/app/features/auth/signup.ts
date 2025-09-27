import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  private store = inject(StoreService);
  private router = inject(Router);
  model = { name: '', email: '', password: '', registrationNo: '' };
  error: string | null = null;
  submit() {
    try {
      this.store.signup(this.model.name, this.model.email, this.model.password, this.model.registrationNo);
      this.router.navigate(['/student']);
    } catch (e: any) {
      this.error = e?.message ?? 'Signup failed';
    }
  }
}
