import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  constructor(public store: StoreService) {}

  // Whether the currently logged-in user is a student with approved status
  get studentApproved(): boolean {
    const user = this.store.currentUser();
    if (!user || user.role !== 'student' || !user.studentId) return false;
    const st = this.store.students().find(s => s.id === user.studentId);
    return !!st?.approved;
  }

  // Status text for the logged-in student: approved | pending | rejected
  get studentStatus(): 'approved'|'pending'|'rejected'|'' {
    const user = this.store.currentUser();
    if (!user || user.role !== 'student' || !user.studentId) return '';
    const st = this.store.students().find(s => s.id === user.studentId);
    if (st?.approved) return 'approved';
    const list = this.store.approvals()[user.studentId] ?? [];
    const last = list[list.length - 1];
    if (last?.status === 'rejected') return 'rejected';
    return 'pending';
  }
}
