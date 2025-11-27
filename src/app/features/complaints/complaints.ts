import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './complaints.html',
  styleUrls: ['./complaints.css']
})
export class Complaints {
  constructor(public store: StoreService) {}

  complaint = { category: 'Other' as 'Technical'|'Supervisor'|'Organization'|'Other', message: '' };

  get isStudent() { return this.store.currentUser()?.role === 'student'; }
  get studentId() { return this.store.currentUser()?.studentId || null; }
  myComplaints() {
    const sid = this.studentId; if (!sid) return [] as any[];
    return this.store.complaints().filter(c => c.studentId === sid);
  }
  submitComplaint() {
    if (!this.isStudent || !this.studentId || !this.complaint.message) return;
    this.store.submitComplaint(this.studentId, this.complaint.category, this.complaint.message);
    this.complaint = { category: 'Other', message: '' };
  }
}
