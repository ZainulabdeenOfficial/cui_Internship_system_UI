import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
   showMobileMenu = false;
  scrolled = false;
  constructor(public store: StoreService, private router: Router) {}

  // toggle mobile menu
  toggleMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  // logout and redirect to role-specific login screen
  logout() {
    const role = this.store.currentUser()?.role;
    this.store.logout();
    if (role === 'student') {
      this.router.navigate(['/login']);
    } else if (role === 'faculty') {
      this.router.navigate(['/faculty-login']);
    } else if (role === 'site') {
      this.router.navigate(['/site-login']);
    } else if (role === 'admin') {
      this.router.navigate(['/admin-login']);
    } else {
      this.router.navigate(['/']);
    }
  }
 
}


