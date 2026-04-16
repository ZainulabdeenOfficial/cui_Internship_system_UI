import { CommonModule } from '@angular/common';
import { Component, signal, computed, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoreService, ComplaintCategory, Complaint } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
import { RequestTrackerService } from '../../core/services/request-tracker.service';

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadMyComplaints();
  }

  get isStudent() { return this.store.currentUser()?.role === 'student'; }
  get studentId() { return this.store.currentUser()?.studentId || null; }
  
  async loadMyComplaints(status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED') {
    try {
      this.loadingComplaints.set(true);
      this.complaintsError.set(null);
      const requestId = this.requestTracker.startRequest('load-complaints');
      
      console.log('[Complaints] Loading complaints with status:', status);
      const response = await this.studentService.getMyComplaints({
        status: status
      });
      
      console.log('[Complaints] Loaded complaints:', response);
      this.complaintsList.set(response.complaints || []);
      this.cdr.markForCheck();
    } catch (error: any) {
      console.error('[Complaints] Error loading complaints:', error);
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
    
    // Reload complaints after submission
    this.loadMyComplaints();
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
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching complaint details:', error);
        this.complaintDetailsError = error?.error?.message || 'Failed to load complaint details. Please try again.';
        this.loadingComplaintDetails = false;
        this.cdr.markForCheck();
      }
    });
  }
}
