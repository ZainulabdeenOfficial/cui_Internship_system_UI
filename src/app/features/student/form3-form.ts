import { Component, input, effect } from '@angular/core';
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

  model = {
    organizationOverview: '',
    scopeOfWork: '',
    keyActivities: { 
      coding: false, 
      testing: false, 
      documentation: false, 
      dataAnalysis: false, 
      research: false, 
      technicalSupport: false, 
      dashboard: false, 
      other: false, 
      otherText: '' 
    },
    tools: '',
    expectedDeliverables: '',
    // Appendix-C: Role Description & Activities
    roleDescription: '',
    toolsTechnologies: ''
  };

  constructor(private store: StoreService, private studentService: StudentService, private toast: ToastService) {
    // Auto-load when selectedId changes using effect
    effect(() => {
      const id = this.selectedId();
      if (!id) return;
      
      try {
        const list = this.store.designStatements()[id] ?? [];
        if (!list.length) return;
        const latest = list[list.length - 1] as any;
        if (!latest) return;

        this.model.organizationOverview = latest.placement?.overview || '';
        const raw = (latest.scopeAndDeliverables || '').toString();
        
        if (raw) {
          const parts = raw.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
          const stripLabel = (text: string, label: string) => {
            if (!text) return '';
            const idx = text.toLowerCase().indexOf(label.toLowerCase());
            return idx === -1 ? text : text.slice(idx + label.length).trim();
          };
          
          if (parts[0]) this.model.scopeOfWork = stripLabel(parts[0], 'Scope:');
          
          if (parts[1]) {
            const kaRaw = stripLabel(parts[1], 'Key Activities:') || '';
            const items = kaRaw.split(',').map(s => s.trim()).filter(s => s.length);
            const k = { ...this.model.keyActivities };
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
            const itemNorms = items.map(norm);
            
            k.coding = itemNorms.includes('coding');
            k.testing = itemNorms.includes('testing');
            k.documentation = itemNorms.includes('documentation');
            k.dataAnalysis = itemNorms.includes('dataanalysis');
            k.research = itemNorms.includes('research');
            k.technicalSupport = itemNorms.includes('technicalsupport') || itemNorms.includes('technical');
            k.dashboard = itemNorms.includes('dashboardreportcreation') || itemNorms.includes('dashboard');
            
            const otherEntry = items.find(it => /other/i.test(it));
            if (otherEntry) {
              k.other = true;
              const m = otherEntry.split(/[:\-\(\)]/).slice(1).join(':').trim();
              k.otherText = m;
            }
            this.model.keyActivities = k;
          }
          
          if (parts[2]) this.model.tools = stripLabel(parts[2], 'Tools/Technologies:');
          if (parts[3]) this.model.expectedDeliverables = stripLabel(parts[3], 'Expected Deliverables:');
        }
      } catch {}
    });
  }

  async submit() {
    try {
      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }
      
      // Validate required fields
      if (!this.model.organizationOverview?.trim()) {
        this.toast.warning('Organization Overview is required');
        return;
      }

      // Build base payload for AppEx-C API
      const appexCPayload: any = {
        organizationOverview: this.model.organizationOverview.trim(),
        keyActivities: this.model.keyActivities
      };

      // Only add optional fields if they have values
      if (this.model.roleDescription?.trim()) {
        appexCPayload.roleDescription = this.model.roleDescription.trim();
      }
      
      const toolsTech = this.model.toolsTechnologies?.trim() || this.model.tools?.trim();
      if (toolsTech) {
        appexCPayload.toolsTechnologies = toolsTech;
      }
      
      if (this.model.expectedDeliverables?.trim()) {
        appexCPayload.expectedDeliverables = this.model.expectedDeliverables.trim();
      }

      console.log('[Form3Form] Submitting AppEx-C with payload:', appexCPayload);
      
      // Check if AppExC already exists to determine if we should create or update
      let existingData: any = null;
      try {
        existingData = await this.studentService.getAppExC();
      } catch (e: any) {
        console.log('[Form3Form] No existing AppExC data found, will create new');
      }
      
      // Submit to AppEx-C API
      if (existingData?.id || existingData?.appexCId) {
        console.log('[Form3Form] Updating existing AppEx-C');
        await this.studentService.updateAppExC(appexCPayload);
        this.toast.success('Organization Overview & Scope of Work (AppEx-C) updated successfully');
      } else {
        console.log('[Form3Form] Creating new AppEx-C');
        await this.studentService.submitAppExC(appexCPayload);
        this.toast.success('Organization Overview & Scope of Work (AppEx-C) submitted successfully');
      }
      
      // Reset form
      this.model = { 
        organizationOverview: '', 
        scopeOfWork: '', 
        keyActivities: { 
          coding: false, 
          testing: false, 
          documentation: false, 
          dataAnalysis: false, 
          research: false, 
          technicalSupport: false, 
          dashboard: false, 
          other: false, 
          otherText: '' 
        }, 
        tools: '', 
        expectedDeliverables: '',
        roleDescription: '',
        toolsTechnologies: ''
      };
    } catch (err: any) {
      console.error('[Form3Form] Submission error:', err);
      this.toast.danger('Failed to submit AppEx-C: ' + (err?.error?.message || err?.message || 'Unknown error'));
    }
  }
}
