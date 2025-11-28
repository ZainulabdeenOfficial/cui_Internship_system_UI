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
    fullName: '',
    registrationNumber: '',
    degreeProgram: '',
    semester: '',
    contactNumber: '',
    emailAddress: '',
    preferredField: '',
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
    });
  }

  submit() {
    try {
      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }
      
      const payload: any = {
        policyAcknowledgement: !!this.model.acknowledged,
        confidentialityAgreement: true,
        safetyTraining: true,
        studentAgreementData: { ...this.model }
      };
      
      this.store.submitAgreement(id, payload as any);
      this.toast.success('Student Assignment & Agreement form saved');
      
      // reset locally
      this.model = { 
        fullName: '', 
        registrationNumber: '', 
        degreeProgram: '', 
        semester: '', 
        contactNumber: '', 
        emailAddress: '', 
        preferredField: '', 
        acknowledged: false 
      };
    } catch (err: any) {
      this.toast.danger('Failed to save agreement');
    }
  }
}
