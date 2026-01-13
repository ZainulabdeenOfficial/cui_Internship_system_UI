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
      
      // Submit to backend via store service with auth
      this.store.submitAppexB(id, requestConfig as any);
      this.toast.success('Student Assignment & Agreement (AppEx B) submitted successfully');
      
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
