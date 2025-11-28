import { Component, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
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
    expectedDeliverables: ''
  };

  constructor(private store: StoreService, private toast: ToastService) {
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

  submit() {
    try {
      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }
      
      const f = this.model as any;
      const ds = {
        careerGoal: '',
        learningObjectives: '',
        placement: { 
          organization: '', 
          mode: 'On-site', 
          functionalArea: '', 
          overview: f.organizationOverview || '' 
        },
        supervisor: { name: '', designation: '', email: '', contact: '' },
        scopeAndDeliverables: `Scope: ${f.scopeOfWork || ''}\n\nKey Activities: ${Object.entries(f.keyActivities).filter(([k,v]) => k !== 'other' && v).map(([k]) => k).join(', ')}${f.keyActivities.other ? (', ' + (f.keyActivities.otherText || 'Other')) : ''}\n\nTools/Technologies: ${f.tools || ''}\n\nExpected Deliverables: ${f.expectedDeliverables || ''}`,
        academicPreparation: '',
        comments: ''
      };
      
      this.store.submitDesignStatement(id, ds as any);
      this.toast.success('Form 3 (Organization Overview & Scope) saved');
      
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
        expectedDeliverables: '' 
      };
    } catch (err: any) {
      this.toast.danger('Failed to save Form 3');
    }
  }
}
