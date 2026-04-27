import { CommonModule } from '@angular/common';
import { Component, signal, computed, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoreService, ComplaintCategory, Complaint } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
import { RequestTrackerService } from '../../core/services/request-tracker.service';
import { DataCacheService } from '../../core/services/data-cache.service';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './complaints.html',
  styleUrls: ['./complaints.css']
})
export class Complaints implements OnInit {
  complaint = {
    subject: '',
    body: '',
    category: 'GENERAL' as ComplaintCategory,
    internshipId: ''
  };

  selectedComplaintDetails: Complaint | undefined;
  loadingComplaintDetails = false;
  complaintDetailsError: string | null = null;

  // Complaints list from API
  complaintsList = signal<Complaint[]>([]);
  selectedStatus = signal<'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'ALL'>('ALL');
  loadingComplaints = signal(false);
  complaintsError = signal<string | null>(null);

  // Computed filtered complaints
  filteredComplaints = computed(() => {
    const complaints = this.complaintsList();
    const status = this.selectedStatus();
    
    if (status === 'ALL') return complaints;
    return complaints.filter(c => c.status === status);
  });

  constructor(
    public store: StoreService,
    private studentService: StudentService,
    private requestTracker: RequestTrackerService,
    private cdr: ChangeDetectorRef,
    private cache: DataCacheService
  ) {}

  ngOnInit() {
    // Only fetch if data is not already cached (prevents spinner on every navigation)
    if (!this.cache.isFresh('complaints:mine')) {
      this.loadMyComplaints();
    }
  }

  get isStudent() { return this.store.currentUser()?.role === 'student'; }
  get studentId() { return this.store.currentUser()?.studentId || null; }
  
  async loadMyComplaints(status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED') {
    try {
      this.loadingComplaints.set(true);
      this.complaintsError.set(null);
      this.requestTracker.startRequest('load-complaints');
      const response = await this.studentService.getMyComplaints({ status });
      this.complaintsList.set(response.complaints || []);
      this.cache.mark('complaints:mine');
      this.cdr.markForCheck();
    } catch (error: any) {
      this.complaintsError.set(error?.error?.message || 'Failed to load complaints. Please try again.');
    } finally {
      this.loadingComplaints.set(false);
      this.cdr.markForCheck();
    }
  }

  onStatusChange(status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'ALL') {
    this.selectedStatus.set(status);
    
    // Load fresh data from API if specific status selected
    if (status !== 'ALL') {
      this.loadMyComplaints(status as 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED');
    }
  }

  myComplaints() {
    return this.filteredComplaints();
  }

  async submitComplaint() {
    const uid = this.store.currentUser()?.studentId;
    if (!this.isStudent || !uid || !this.complaint.subject || !this.complaint.body) return;
    
    try {
      await this.studentService.submitComplaint({
        subject: this.complaint.subject,
        body: this.complaint.body,
        category: this.complaint.category,
        internshipId: this.complaint.internshipId || ''
      });
      
      this.complaint = { subject: '', body: '', category: 'GENERAL', internshipId: '' };
      
      // Reload complaints after submission
      await this.loadMyComplaints();
    } catch (e) {
      console.error('Error submitting complaint:', e);
    }
  }

  getComplaintDetails(complaintId: string) {
    this.selectedComplaintDetails = this.store.getComplaint(complaintId);
  }

  getComplaintFromAPI(complaintId: string) {
    this.loadingComplaintDetails = true;
    this.complaintDetailsError = null;
    
    this.studentService.getComplaint(complaintId).then(
      (response) => {
        this.selectedComplaintDetails = response.complaint;
        this.loadingComplaintDetails = false;
        this.cdr.markForCheck();
      }
    ).catch(
      (error) => {
        console.error('Error fetching complaint details:', error);
        this.complaintDetailsError = error?.error?.message || 'Failed to load complaint details. Please try again.';
        this.loadingComplaintDetails = false;
        this.cdr.markForCheck();
      }
    );
  }
}
