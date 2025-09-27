import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
  constructor(public store: StoreService) {}

  // toggle mobile menu
  toggleMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

 
}


