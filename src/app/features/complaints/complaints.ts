import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoreService, ComplaintCategory, Complaint } from '../../shared/services/store.service';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './complaints.html',
  styleUrls: ['./complaints.css']
})
export class Complaints {
  complaint = {
    subject: '',
    body: '',
    category: 'GENERAL' as ComplaintCategory,
    internshipId: ''
  };

  selectedComplaintDetails: Complaint | undefined;
  loadingComplaintDetails = false;
  complaintDetailsError: string | null = null;

  constructor(public store: StoreService) {}

  get isStudent() { return this.store.currentUser()?.role === 'student'; }
  get studentId() { return this.store.currentUser()?.studentId || null; }
  
  myComplaints() {
    const uid = this.store.currentUser()?.studentId;
    if (!uid) return [] as any[];
    return this.store.complaints().filter(c => c.submittedById === uid);
  }

  submitComplaint() {
    const uid = this.store.currentUser()?.studentId;
    if (!this.isStudent || !uid || !this.complaint.subject || !this.complaint.body) return;
    
    this.store.submitComplaint(
      this.complaint.subject,
      this.complaint.body,
      this.complaint.category,
      this.complaint.internshipId || undefined,
      uid
    );
    
    this.complaint = { subject: '', body: '', category: 'GENERAL', internshipId: '' };
  }

  getComplaintDetails(complaintId: string) {
    this.selectedComplaintDetails = this.store.getComplaint(complaintId);
  }

  getComplaintFromAPI(complaintId: string) {
    this.loadingComplaintDetails = true;
    this.complaintDetailsError = null;
    
    this.store.getComplaintFromAPI(complaintId).subscribe({
      next: (response) => {
        this.selectedComplaintDetails = response.complaint;
        this.loadingComplaintDetails = false;
      },
      error: (error) => {
        console.error('Error fetching complaint details:', error);
        this.complaintDetailsError = error?.error?.message || 'Failed to load complaint details. Please try again.';
        this.loadingComplaintDetails = false;
      }
    });
  }
}
