import { Component, input, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuthService } from '../../shared/services/auth.service';
import { StudentService } from '../../shared/services/student.service';

@Component({
  selector: 'app-assignment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-form.html'
})
export class AssignmentForm {
  selectedId = input<string | null>(null);
  submitted =signal<boolean>(false);
  loading = signal<boolean>(false);
  verificationLoading = signal<boolean>(false);
  
  // AppEx B verification status from backend
  appexBData: any = null;
  facultyApproved = signal<boolean>(false);
  adminApproved = signal<boolean>(false);
  studentApproved = signal<boolean>(false);

  model = {
    // Appendix-B: Student Information
    name: '',
    email: '',
    degreeProgram: '',
    semester: '',
    contactNo: '',
    preferredField: '',
    agreementAccepted: false,
    // Appendix-A: Organization Information (Backend: appexA)
    organization: '',
    address: '',
    industrySector: '',
    contactName: '',
    contactDesignation: '',
    contactPhone: '',
    contactEmail: '',
    internshipField: '', // Backend field name
    internshipLocation: '',
    mode: 'On-site',
    numberOfInternship: 0,
    startDate: '',
    endDate: '',
    workingDays: '',
    workingHours: '',
    status: 'pending',
    // Legacy fields for compatibility
    internshipNature: '', // Deprecated - use internshipField
    fullName: '',
    registrationNumber: '',
    contactNumber: '',
    emailAddress: '',
    acknowledged: false
  };

  constructor(
    private store: StoreService, 
    private toast: ToastService, 
    private auth: AuthService,
    private studentService: StudentService
  ) {
    // Auto-load when selectedId changes using effect
    effect(() => {
      const id = this.selectedId();
      if (!id) return;
      
      // Load existing AppEx B data from backend
      this.loadAppexBStatus();
      
      try {
        const list = this.store.agreements()[id] ?? [];
        if (!list.length) return;
        const latest = list[list.length - 1] as any;
        if (latest && latest.studentAgreementData) {
          this.model = { ...this.model, ...(latest.studentAgreementData || {}) };
        }
      } catch {}
      
      // Map legacy fields to new fields
      this.model.name = this.model.name || this.model.fullName;
      this.model.email = this.model.email || this.model.emailAddress;
      this.model.contactNo = this.model.contactNo || this.model.contactNumber;
      // Map deprecated internshipNature to internshipField
      this.model.internshipField = this.model.internshipField || this.model.internshipNature;
    });
  }

  submit() {
    try {
      // Prevent resubmission
      if (this.submitted()) {
        this.toast.warning('Assignment & Agreement already submitted');
        return;
      }

      // Prevent multiple simultaneous submissions
      if (this.loading()) {
        return;
      }

      // Auth barrier: Check if user is authenticated
      const authToken = this.getAuthToken();
      if (!authToken) {
        this.toast.danger('Authentication required. Please login to submit.');
        return;
      }

      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }

      // Validate all required fields before submission (AppEx-B fields)
      const requiredFields = {
        name: this.model.name,
        degreeProgram: this.model.degreeProgram,
        email: this.model.email,
        semester: this.model.semester,
        contactNo: this.model.contactNo,
        preferredField: this.model.preferredField
      };

      // Check for empty fields
      const emptyFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (emptyFields.length > 0) {
        this.toast.danger(`Please fill all required fields: ${emptyFields.join(', ')}`);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.model.email)) {
        this.toast.danger('Please enter a valid email address.');
        return;
      }

      // Validate agreement acceptance
      if (!this.model.agreementAccepted) {
        this.toast.danger('You must accept the agreement to submit.');
        return;
      }
      
      // Build payload for Backend API: /api/student/appex-b with auth
      const appexBPayload = {
        name: this.model.name.trim(),
        degreeProgram: this.model.degreeProgram.trim(),
        email: this.model.email.trim(),
        semester: this.model.semester.trim(),
        contactNo: this.model.contactNo.trim(),
        preferredField: this.model.preferredField.trim(),
        agreementAccepted: this.model.agreementAccepted
      };

      console.log('[AssignmentForm] Submitting AppEx B with payload:', appexBPayload);
      
      // Include auth token in payload headers (will be sent by store service)
      const requestConfig = {
        payload: appexBPayload,
        authToken: authToken,
        studentId: id
      };
      
      // Set loading state
      this.loading.set(true);
      
      // Submit to backend via store service with auth
      const result = this.store.submitAppexB(id, requestConfig as any);
      
      // Handle the response
      if (result && result.observable) {
        result.observable.subscribe({
          next: (response) => {
            this.loading.set(false);
            this.submitted.set(true);
            this.toast.success('Student Assignment & Agreement (AppEx B) submitted successfully');
            console.log('[AssignmentForm] AppEx B submitted successfully:', response);
            
            // Load AppEx B status to show approval badges
            this.loadAppexBStatus();
            
            // reset locally
            this.model = {
              name: '',
              email: '',
              degreeProgram: '',
              semester: '',
              contactNo: '',
              preferredField: '',
              agreementAccepted: false,
              organization: '',
              address: '',
              industrySector: '',
              contactName: '',
              contactDesignation: '',
              contactPhone: '',
              contactEmail: '',
              internshipField: '',
              internshipLocation: '',
              mode: 'On-site',
              numberOfInternship: 0,
              startDate: '',
              endDate: '',
              workingDays: '',
              workingHours: '',
              status: 'pending',
              internshipNature: '',
              fullName: '',
              registrationNumber: '',
              contactNumber: '',
              emailAddress: '',
              acknowledged: false
            };
          },
          error: (err) => {
            this.loading.set(false);
            console.error('[AssignmentForm] Error submitting AppEx B:', err);
            const errorMsg = err?.error?.message || err?.message || 'Failed to submit. Please try again.';
            this.toast.danger('Submission failed: ' + errorMsg);
          }
        });
      } else {
        // Fallback for synchronous error
        this.loading.set(false);
        this.toast.danger('Failed to initiate submission. Please check your connection.');
      }
    } catch (err: any) {
      this.loading.set(false);
      console.error('[AssignmentForm] Submission error:', err);
      this.toast.danger('Failed to submit internship application: ' + err.message);
    }
  }

  private resetModel() {
    this.model = { 
        name: '',
        email: '',
        degreeProgram: '',
        semester: '',
        contactNo: '',
        preferredField: '',
        agreementAccepted: false,
        organization: '',
        address: '',
        industrySector: '',
        contactName: '',
        contactDesignation: '',
        contactPhone: '',
        contactEmail: '',
        internshipField: '',
        internshipLocation: '',
        mode: 'On-site',
        numberOfInternship: 0,
        startDate: '',
        endDate: '',
        workingDays: '',
        workingHours: '',
        status: 'pending',
        internshipNature: '',
        fullName: '',
        registrationNumber: '',
        contactNumber: '',
        emailAddress: '',
        acknowledged: false
    };
  }

  private getAuthToken(): string | null {
    try {
      // Check session storage first (most common for current session)
      const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('accessToken');
      if (token) return token;
      
      // Fallback to local storage
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) return refreshToken;
      
      return null;
    } catch (err) {
      console.error('[AssignmentForm] Error retrieving auth token:', err);
      return null;
    }
  }

  async loadAppexBStatus() {
    try {
      const response = await this.studentService.getAppexBVerification();
      const data = response?.data || response;
      
      if (data && data.id) {
        this.appexBData = data;
        this.submitted.set(true);
        
        // Update model with admin-filled data
        if (data.companyName) this.model.organization = data.companyName;
        if (data.internshipRole) this.model.internshipField = data.internshipRole;
        if (data.startDate) this.model.startDate = data.startDate.slice(0, 10);
        if (data.endDate) this.model.endDate = data.endDate.slice(0, 10);
        if (data.durationWeeks) this.model.numberOfInternship = data.durationWeeks;
        
        // Check approval statuses
        this.facultyApproved.set(data.facultyVerified || data.assignment?.facultyVerified || false);
        this.adminApproved.set(
          data.adminApproved || 
          data.adminVerified || 
          data.status === 'approved' || 
          false
        );
        this.studentApproved.set(data.studentVerified || data.assignment?.studentVerified || false);
      }
    } catch (err: any) {
      // Silently handle error (no existing data)
      console.log('[AssignmentForm] No AppEx B data found:', err?.message);
    }
  }

  async approveAppexB() {
    if (this.verificationLoading()) return;
    
    this.verificationLoading.set(true);
    try {
      const response = await this.studentService.verifyAppexB();
      this.toast.success(response?.message || 'AppEx B approved successfully');
      this.studentApproved.set(true);
      
      // Reload status
      await this.loadAppexBStatus();
    } catch (err: any) {
      const errorMsg = err?.error?.message || err?.message || 'Failed to approve';
      this.toast.danger(errorMsg);
    } finally {
      this.verificationLoading.set(false);
    }
  }

  async rejectAppexB() {
    if (this.verificationLoading()) return;
    
    if (!confirm('Are you sure you want to reject this AppEx B? This action cannot be undone.')) {
      return;
    }
    
    this.verificationLoading.set(true);
    try {
      // Call API to reject (you may need to add this endpoint)
      const response = await this.studentService.verifyAppexB(); // Same endpoint, backend should handle rejection
      this.toast.warning(response?.message || 'AppEx B rejected');
      
      // Reload status
      await this.loadAppexBStatus();
    } catch (err: any) {
      const errorMsg = err?.error?.message || err?.message || 'Failed to reject';
      this.toast.danger(errorMsg);
    } finally {
      this.verificationLoading.set(false);
    }
  }
}
