import { Component, input, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-form3-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form3-form.html'
})
export class Form3Form {
  selectedId = input<string | null>(null);
  loading = signal<boolean>(false);
  submitted = signal<boolean>(false);
  form3Status = signal<'pending' | 'approved' | 'rejected'>('pending'); // Track approval status

  /** Emitted once after a successful POST so the parent can update internshipStarted() immediately. */
  @Output() apexCSubmitted = new EventEmitter<void>();

  model = {
    organizationOverview: '',
    roleDescription: '',
    keyActivities: '',
    toolsTechnologies: '',
    expectedDeliverables: ''
  };

  submittedData = signal<any>(null);

  constructor(private store: StoreService, private studentService: StudentService, private toast: ToastService) {}

  async submit() {
    try {
      // Check if already approved - prevent resubmission
      if (this.form3Status() === 'approved') {
        this.toast.warning('Your Organization Overview & Scope of Work form has been approved and cannot be resubmitted');
        return;
      }
      
      // Prevent multiple simultaneous submissions
      if (this.loading()) {
        return;
      }

      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }
      
      // Validate required field
      if (!this.model.organizationOverview?.trim()) {
        this.toast.warning('Organization Overview is required');
        return;
      }

      // Set loading state
      this.loading.set(true);

      // Build payload matching API schema exactly
      const payload = {
        organizationOverview: this.model.organizationOverview.trim(),
        roleDescription: this.model.roleDescription?.trim() || '',
        keyActivities: this.model.keyActivities?.trim() || '',
        toolsTechnologies: this.model.toolsTechnologies?.trim() || '',
        expectedDeliverables: this.model.expectedDeliverables?.trim() || ''
      };

      console.log('[Form3Form] Submitting AppEx-C with payload:', payload);
      
      // Submit to AppEx-C API (POST only — no GET)
      const response = await this.studentService.submitAppExC(payload);
      
      this.loading.set(false);
      this.submitted.set(true);
      this.submittedData.set(response?.internshipProposal);
      
      // Track approval status from POST response
      const status = response?.internshipProposal?.status || 'pending';
      if (status === 'approved' || status === 'APPROVED') {
        this.form3Status.set('approved');
      } else if (status === 'rejected' || status === 'REJECTED') {
        this.form3Status.set('rejected');
      } else {
        this.form3Status.set('pending');
      }
      
      this.toast.success('Organization Overview & Scope of Work submitted successfully!');

      // Notify parent so it can immediately recalculate internshipStarted()
      this.apexCSubmitted.emit();

      // Reset form after successful submission
      this.model = { 
        organizationOverview: '', 
        roleDescription: '',
        keyActivities: '',
        toolsTechnologies: '',
        expectedDeliverables: ''
      };
    } catch (err: any) {
      this.loading.set(false);
      console.error('[Form3Form] Submission error:', err);
      const errorMsg = err?.error?.message || err?.message || 'Unknown error';
      this.toast.danger('Failed to submit: ' + errorMsg);
    }
  }
}
