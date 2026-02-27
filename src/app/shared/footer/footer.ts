import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StoreService } from '../services/store.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  year = new Date().getFullYear();
  constructor(public store: StoreService, private router: Router) {}

  // Whether the footer should be visible on the current route
  get isVisible(): boolean {
    // Show footer on all pages
    return true;
  }
}
