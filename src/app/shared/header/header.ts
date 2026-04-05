import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  showMobileMenu = false;
  scrolled = false;

  private onScroll = () => {
    this.scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 8;
  };

  constructor(public store: StoreService, private router: Router) {}

  ngOnInit(): void {
    window.addEventListener('scroll', this.onScroll, { passive: true });
    // initialize state in case page is already scrolled (e.g., deep links)
    this.onScroll();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  // toggle mobile menu
  toggleMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  // logout and redirect to role-specific login screen
  logout() {
    const role = this.store.currentUser()?.role;
    this.store.logout();
    const qp = role && role !== 'student' ? { role } : {} as any;
    this.router.navigate(['/login'], { queryParams: qp });
  }

  // Faculty helper
  myFaculty() {
    const id = this.store.currentUser()?.facultyId;
    if (!id) return undefined;
    return this.store.facultySupervisors().find(f => f.id === id);
  }

  // Student helper
  myStudent() {
    const id = this.store.currentUser()?.studentId;
    if (!id) return undefined;
    return this.store.students().find(s => s.id === id);
  }

  // Site helper
  mySite() {
    const id = this.store.currentUser()?.siteId;
    if (!id) return undefined;
    return this.store.siteSupervisors().find(s => s.id === id);
  }

  // Admin helper
  myAdmin() {
    return this.store.adminProfile();
  }
}


