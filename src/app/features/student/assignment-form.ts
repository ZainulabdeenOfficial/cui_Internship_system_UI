import { Component, input, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-assignment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-form.html'
})
export class AssignmentForm {
  selectedId = input<string | null>(null);

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

  constructor(private store: StoreService, private toast: ToastService, private auth: AuthService) {
    // Auto-load when selectedId changes using effect
    effect(() => {
      const id = this.selectedId();
      if (!id) return;
      
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

      // Validate all required fields before submission
      const requiredFields = {
        organization: this.model.organization,
        address: this.model.address,
        industrySector: this.model.industrySector,
        contactName: this.model.contactName,
        contactDesignation: this.model.contactDesignation,
        contactPhone: this.model.contactPhone,
        contactEmail: this.model.contactEmail,
        internshipLocation: this.model.internshipLocation,
        internshipNature: this.model.internshipField || this.model.internshipNature,
        mode: this.model.mode,
        numberOfInternship: this.model.numberOfInternship,
        startDate: this.model.startDate,
        endDate: this.model.endDate,
        workingDays: this.model.workingDays,
        workingHours: this.model.workingHours
      };

      // Check for empty fields
      const emptyFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (emptyFields.length > 0) {
        this.toast.danger(`Please fill all required fields: ${emptyFields.join(', ')}`);
        return;
      }

      // Validate dates
      try {
        const startDate = new Date(this.model.startDate);
        const endDate = new Date(this.model.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          this.toast.danger('Invalid date format. Please use YYYY-MM-DD format.');
          return;
        }

        if (startDate >= endDate) {
          this.toast.danger('Start date must be before end date.');
          return;
        }
      } catch (err: any) {
        this.toast.danger('Date validation error: ' + err.message);
        return;
      }

      // Validate number
      const numInternship = Number(this.model.numberOfInternship);
      if (isNaN(numInternship) || numInternship < 1) {
        this.toast.danger('Number of Internship must be a valid positive number.');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.model.contactEmail)) {
        this.toast.danger('Please enter a valid contact email address.');
        return;
      }
      
      // Build payload for Backend API: /api/student/appex-a with auth
      const appexAPayload = {
        organization: this.model.organization.trim(),
        address: this.model.address.trim(),
        industrySector: this.model.industrySector.trim(),
        contactName: this.model.contactName.trim(),
        contactDesignation: this.model.contactDesignation.trim(),
        contactPhone: this.model.contactPhone.trim(),
        contactEmail: this.model.contactEmail.trim(),
        internshipLocation: this.model.internshipLocation.trim(),
        internshipNature: (this.model.internshipField || this.model.internshipNature).trim(),
        mode: this.model.mode,
        numberOfInternship: numInternship,
        startDate: this.model.startDate, // ISO format: YYYY-MM-DD
        endDate: this.model.endDate, // ISO format: YYYY-MM-DD
        workingDays: this.model.workingDays.trim(),
        workingHours: this.model.workingHours.trim()
      };

      console.log('[AssignmentForm] Submitting AppEx A with payload:', appexAPayload);
      
      // Include auth token in payload headers (will be sent by store service)
      const requestConfig = {
        payload: appexAPayload,
        authToken: authToken,
        studentId: id
      };
      
      // Submit to backend via store service with auth
      this.store.submitAppexA(id, requestConfig as any);
      this.toast.success('Internship Application (AppEx A) submitted successfully');
      
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
    } catch (err: any) {
      console.error('[AssignmentForm] Submission error:', err);
      this.toast.danger('Failed to submit internship application: ' + err.message);
    }
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
}
