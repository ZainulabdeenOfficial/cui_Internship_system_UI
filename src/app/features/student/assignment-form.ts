import { Component, input, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';

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

  constructor(private store: StoreService, private toast: ToastService) {
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
      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }
      
      // Build payload for Backend API: /api/student/appex-a
      const appexAPayload = {
        organization: this.model.organization,
        address: this.model.address,
        industrySector: this.model.industrySector,
        contactName: this.model.contactName,
        contactDesignation: this.model.contactDesignation,
        contactPhone: this.model.contactPhone,
        contactEmail: this.model.contactEmail,
        internshipField: this.model.internshipField, // Backend expects this field name
        internshipLocation: this.model.internshipLocation,
        mode: this.model.mode,
        numberOfInternship: Number(this.model.numberOfInternship),
        startDate: this.model.startDate, // ISO format: YYYY-MM-DD
        endDate: this.model.endDate, // ISO format: YYYY-MM-DD
        workingDays: this.model.workingDays,
        workingHours: this.model.workingHours
      };
      
      // Also maintain legacy payload for store compatibility
      const legacyPayload: any = {
        policyAcknowledgement: !!this.model.agreementAccepted,
        confidentialityAgreement: true,
        safetyTraining: true,
        studentAgreementData: { ...this.model }
      };
      
      // Submit to backend via store service
      this.store.submitAppexA(id, appexAPayload as any);
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
      this.toast.danger('Failed to submit internship application');
    }
  }
}
