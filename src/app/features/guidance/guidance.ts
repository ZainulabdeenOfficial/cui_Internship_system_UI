import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-guidance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './guidance.html',
  styleUrls: ['./guidance.css']
})
export class Guidance {
  constructor(public store: StoreService) {}
  get userRole() { return this.store.currentUser()?.role; }
}
