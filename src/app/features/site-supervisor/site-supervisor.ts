import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { SiteService, SiteEvaluationCriteria, SiteEvaluationPayload } from '../../shared/services/site.service';
import { SiteInternship } from '../../shared/models/site/internship.models';

@Component({
  selector: 'app-site-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './site-supervisor.html',
  styleUrl: './site-supervisor.css'
})
export class SiteSupervisor implements OnInit {
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private siteService: SiteService) {
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','details','reports','evaluations','profile','password'] as const;
        if ((allowed as readonly string[]).includes(t)) this.currentTab = t as any;
      });
    } catch {}
  }
  
  // Expose Object methods to template
  readonly Object = Object;

  ngOnInit() {
    this.loadSiteInternships();
  }
  get students() { return this.store.students; }
  selectedId: string | null = null;
  currentTab: 'students'|'details'|'reports'|'evaluations'|'profile'|'password' = 'students';
  page = { students: 1 };
  pageSize = 10;
  
  // Status filter for students list
  statusFilter = signal<'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'all'>('all');
  
  selectTab(tab: SiteSupervisor['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
  }
  selectedStudent = computed(() => this.selectedId ? this.students().find(s => s.id === this.selectedId!) : undefined);
  logs() { return this.selectedId ? (this.store.logs()[this.selectedId] ?? []) : []; }
  reports() { return this.selectedId ? (this.store.reports()[this.selectedId] ?? []) : []; }
  mySiteId = computed(() => this.store.currentUser()?.siteId);
  
  // Signal to store API internships
  private apiInternships = signal<SiteInternship[]>([]);
  
  // Computed students from API internships
  apiStudents = computed(() => {
    const internships = this.apiInternships();
    console.log('🔄 [apiStudents] Recalculating with', internships.length, 'internships');
    
    if (!internships.length) {
      console.log('📭 [apiStudents] No internships available');
      return [];
    }
    
    // The API already filters by the current site supervisor, so show all returned internships
    // Don't apply additional siteId filtering - trust the API response
    const students = internships.map(inv => {
      const student = {
        id: inv.studentId || inv.student?.id || '',
        name: inv.student?.name || '',
        email: inv.student?.email || '',
        registrationNo: inv.student?.regNo || '',
        siteId: inv.siteId,
        // Add internship-specific data
        internshipId: inv.id,
        internshipStatus: inv.status,
        company: inv.site?.company?.name || ''
      };
      console.log('📌 [apiStudents] Mapped student:', student.name, '→', student.id);
      return student;
    });
    
    console.log('✅ [apiStudents] Final count:', students.length);
    return students;
  });
  
  // Use API students if available, otherwise fall back to store students
  myStudents = computed(() => {
    const apiStu = this.apiStudents();
    console.log('🔄 [myStudents] API students:', apiStu.length);
    
    if (apiStu.length > 0) {
      console.log('✅ [myStudents] Using API students (count:', apiStu.length + ')');
      return apiStu;
    }
    
    // Fallback to store students
    const sid = this.mySiteId();
    const storeStu = sid 
      ? this.students().filter(s => s.siteId === sid) 
      : this.students();
    console.log('📦 [myStudents] Using store students (count:', storeStu.length + ', site:', sid + ')');
    return storeStu;
  });

  // Filtered students based on status filter
  filteredStudents = computed(() => {
    const students = this.myStudents();
    const status = this.statusFilter();
    
    if (status === 'all') {
      return students;
    }
    
    // Filter by internship status
    return students.filter(s => {
      const internship = this.siteInternshipsByStudentId[s.id];
      return internship?.status === status;
    });
  });
  // Batch marking buffers
  batchMid: Record<string, number> = {};
  batchFinal: Record<string, number> = {};
  // Helper to get latest report by type for a student
  private latestReportOf(studentId: string, type: 'mid'|'site-final') {
    const list = this.store.reports()[studentId] ?? [];
    const filtered = list.filter(r => r.type === type);
    return filtered.length ? filtered[filtered.length - 1] : null;
  }
  midReportId(studentId: string) { return this.latestReportOf(studentId, 'mid')?.id || null; }
  finalReportId(studentId: string) { return this.latestReportOf(studentId, 'site-final')?.id || null; }
  midScore(studentId: string) { return this.latestReportOf(studentId, 'mid')?.score; }
  finalScore(studentId: string) { return this.latestReportOf(studentId, 'site-final')?.score; }
  saveBatchRow(studentId: string) {
    const midId = this.midReportId(studentId);
    const finId = this.finalReportId(studentId);
    const mid = this.batchMid[studentId];
    const fin = this.batchFinal[studentId];
  if (midId != null && mid != null && !isNaN(mid as any)) this.store.setReportScore(studentId, midId, Math.max(0, Number(mid)));
  if (finId != null && fin != null && !isNaN(fin as any)) this.store.setReportScore(studentId, finId, Math.max(0, Number(fin)));
    this.toast.success('Scores saved');
  }
  saveBatchAll() {
    for (const s of this.myStudents()) this.saveBatchRow(s.id);
    this.toast.success('All scores saved');
  }
  mid = { title: '', content: '' };
  fin = { title: '', content: '' };
  setSiteMarks(v: number) { if (this.selectedId) { this.store.setSiteMarks(this.selectedId, Math.max(0, Number(v))); this.toast.success('Site marks updated'); } }
  submitMid() { if (this.selectedId && this.mid.title) { this.store.submitReport(this.selectedId, { type: 'mid', title: this.mid.title, content: this.mid.content }); this.mid = { title: '', content: '' }; this.toast.success('Mid report submitted'); } }
  submitFinal() { if (this.selectedId && this.fin.title) { this.store.submitReport(this.selectedId, { type: 'site-final', title: this.fin.title, content: this.fin.content }); this.fin = { title: '', content: '' }; this.toast.success('Final report submitted'); } }
  // --- Site Evaluation ---
  evaluationType: 'site_mid' | 'site_final' = 'site_mid';
  evaluationCriteria: SiteEvaluationCriteria = this.defaultCriteria();
  evaluationComments = '';
  evaluationTotalInput: number | null = null;
  submittingEvaluation = false;
  loadingEvaluation = false;
  // Loaded evaluation (null = not yet submitted, object = already submitted)
  loadedEvalMid: any | null = null;
  loadedEvalFinal: any | null = null;

  // Internship IDs from API (studentId → internshipId)
  private siteInternships: SiteInternship[] = [];
  internshipIdByStudentId: Record<string, string> = {};
  // Enhanced student data from API (includes regNo, company info, final results)
  siteInternshipsByStudentId: Record<string, SiteInternship> = {};
  loadingInternships = false;

  private async loadSiteInternships() {
    this.loadingInternships = true;
    try {
      const res = await this.siteService.getSiteInternships('all');
      const raw: any = res.data;
      const list: SiteInternship[] = Array.isArray(raw) ? raw : (raw?.items || []);
      
      console.log('📥 [SiteSupervisor.loadSiteInternships] Raw API response:', {
        count: list.length,
        currentMySiteId: this.mySiteId(),
        siteIds: list.map(inv => inv.siteId),
        studentIds: list.map(inv => inv.studentId || inv.student?.id)
      });
      
      // Update the signal so UI re-renders with API data
      this.apiInternships.set(list);
      console.log('📍 [SiteSupervisor] Signal updated with', list.length, 'internships');
      
      this.siteInternships = list;
      this.internshipIdByStudentId = {};
      this.siteInternshipsByStudentId = {};
      
      // Map internships by student ID for easy access to rich data
      for (const inv of list) {
        const studentId = inv.studentId || inv.student?.id;
        if (studentId) {
          if (inv.id) {
            this.internshipIdByStudentId[studentId] = inv.id;
          }
          // Store full internship data for access to regNo, company, final results
          this.siteInternshipsByStudentId[studentId] = inv;
          console.log(`✅ [SiteSupervisor] Mapped internship for student ${studentId}`, {
            name: inv.student?.name,
            regNo: inv.student?.regNo,
            company: inv.site?.company?.name,
            status: inv.status,
            finalResult: inv.finalResult?.status
          });
        }
      }
      
      // Force recalculation by logging computed values
      const apiStudentsCount = this.apiStudents().length;
      const myStudentsCount = this.myStudents().length;
      
      console.log(`📊 [SiteSupervisor] Loaded ${list.length} internships`, {
        internshipCount: list.length,
        studentCount: Object.keys(this.internshipIdByStudentId).length,
        apiStudents: apiStudentsCount,
        myStudents: myStudentsCount,
        loadingStatus: this.loadingInternships
      });
    } catch (err: any) {
      console.error('❌ [SiteSupervisor] Failed to load internships:', err?.message);
      this.toast.danger('Unable to load internship data. Please refresh the page.');
    } finally {
      this.loadingInternships = false;
    }
  }

  private getEffectiveInternshipId(): string | null {
    if (!this.selectedId) return null;
    return this.internshipIdByStudentId[this.selectedId] || this.selectedId;
  }

  /**
   * Get registration number from API internship data or fallback to store student data
   */
  getStudentRegNo(studentId: string): string | undefined {
    // First try to get from API internship data
    const internship = this.siteInternshipsByStudentId[studentId];
    if (internship?.student?.regNo) {
      return internship.student.regNo;
    }
    // Then try from apiStudents computed array
    const apiStudent = this.apiStudents().find(s => s.id === studentId);
    if (apiStudent?.registrationNo) {
      return apiStudent.registrationNo;
    }
    // Fallback to store student data
    const student = this.store.students().find(s => s.id === studentId);
    return student?.registrationNo;
  }

  /**
   * Get internship company info from API data
   */
  getStudentCompany(studentId: string): { name?: string; industry?: string } | null {
    const internship = this.siteInternshipsByStudentId[studentId];
    return internship?.site?.company || null;
  }

  /**
   * Get final result/marks from internship data
   */
  getStudentFinalResult(studentId: string): any | null {
    const internship = this.siteInternshipsByStudentId[studentId];
    return internship?.finalResult || null;
  }

  get loadedEvalForCurrentType(): any | null {
    return this.evaluationType === 'site_mid' ? this.loadedEvalMid : this.loadedEvalFinal;
  }

  criteriaEntries(criteria: Record<string, number>): { label: string; value: number }[] {
    return Object.entries(criteria).map(([k, v]) => ({
      label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      value: v
    }));
  }

  // Load existing evaluation when student or type changes
  async onEvalStudentChange() {
    await this.loadBothEvaluations();
  }
  async onEvalTypeChange() {
    // no reload needed; switching view only
  }

  private defaultCriteria(): SiteEvaluationCriteria {
    return {
      punctualityAttendance: 0,
      linkTheoryToPractice: 0,
      criticalThinking: 0,
      technicalKnowledge: 0,
      creativity: 0,
      adaptability: 0,
      timeManagement: 0,
      professionalBehavior: 0,
      assignmentsPerformance: 0,
      communicationSkills: 0
    };
  }

  get evaluationTotal(): number {
    const c = this.evaluationCriteria;
    return (c.punctualityAttendance + c.linkTheoryToPractice + c.criticalThinking +
      c.technicalKnowledge + c.creativity + c.adaptability + c.timeManagement +
      c.professionalBehavior + c.assignmentsPerformance + c.communicationSkills);
  }

  async submitEvaluation() {
    const internshipId = this.getEffectiveInternshipId();
    if (!internshipId) { this.toast.warning('Please select a student first'); return; }
    
    // Validate all criteria are within 0-5 range
    for (const [key, value] of Object.entries(this.evaluationCriteria)) {
      if (value < 0 || value > 5) {
        this.toast.danger(`${key}: Value must be between 0-5`);
        return;
      }
    }
    
    // Use input total if provided, otherwise calculate from criteria
    const totalMarks = this.evaluationTotalInput !== null && this.evaluationTotalInput !== undefined 
      ? this.evaluationTotalInput 
      : this.evaluationTotal;
    
    // Validate total marks are within 0-50 range
    if (totalMarks < 0 || totalMarks > 50) {
      this.toast.danger('Total marks must be between 0-50');
      return;
    }
    
    if (totalMarks === 0 && this.evaluationTotalInput === null) {
      this.toast.warning('Please enter marks or rate the criteria');
      return;
    }
    
    this.submittingEvaluation = true;
    try {
      const payload: SiteEvaluationPayload = {
        internshipId,
        type: this.evaluationType,
        criteria: { ...this.evaluationCriteria },
        totalMarks: Math.round(totalMarks),
        ...(this.evaluationComments?.trim() ? { comments: this.evaluationComments.trim() } : {})
      };
      
      console.log('📤 [submitEvaluation] Sending payload:', payload);
      
      const res = await this.siteService.submitEvaluation(payload);
      
      console.log('✅ [submitEvaluation] Response received:', res);
      
      this.toast.success(`${this.evaluationType === 'site_mid' ? 'Mid-term' : 'Final'} evaluation submitted successfully`);
      
      // Store submitted evaluation as loaded state
      const submitted = { 
        criteria: { ...payload.criteria }, 
        totalMarks: payload.totalMarks, 
        comments: payload.comments || '', 
        type: payload.type, 
        submittedAt: new Date().toISOString(), 
        ...(res.data || {}) 
      };
      
      if (this.evaluationType === 'site_mid') this.loadedEvalMid = submitted;
      else this.loadedEvalFinal = submitted;
      
      // Reset form fields
      this.evaluationCriteria = this.defaultCriteria();
      this.evaluationComments = '';
      this.evaluationTotalInput = null;
      this.selectedId = null;
      
    } catch (err: any) {
      console.error('❌ [submitEvaluation] Error:', {
        status: err?.status,
        statusText: err?.statusText,
        message: err?.message,
        error: err?.error
      });
      
      const errorMsg = err?.error?.message || err?.error?.errors?.[0] || err?.message || 'Failed to submit evaluation';
      this.toast.danger(errorMsg);
    } finally {
      this.submittingEvaluation = false;
    }
  }

  private async loadBothEvaluations() {
    const internshipId = this.getEffectiveInternshipId();
    if (!internshipId) return;
    this.loadedEvalMid = null;
    this.loadedEvalFinal = null;
    this.loadingEvaluation = true;
    try {
      const [midRes, finalRes] = await Promise.allSettled([
        this.siteService.getEvaluations(internshipId, 'site_mid'),
        this.siteService.getEvaluations(internshipId, 'site_final')
      ]);
      if (midRes.status === 'fulfilled' && midRes.value?.success && midRes.value.data) {
        const list = Array.isArray(midRes.value.data) ? midRes.value.data : (midRes.value.data.items || []);
        if (list.length) this.loadedEvalMid = list[list.length - 1];
      }
      if (finalRes.status === 'fulfilled' && finalRes.value?.success && finalRes.value.data) {
        const list = Array.isArray(finalRes.value.data) ? finalRes.value.data : (finalRes.value.data.items || []);
        if (list.length) this.loadedEvalFinal = list[list.length - 1];
      }
    } catch {
      this.toast.danger('Unable to load existing evaluations');
    } finally {
      this.loadingEvaluation = false;
    }
  }

  // Change password for logged-in site supervisor
  pw = { old: '', next: '', confirm: '' };
  changePassword() {
  const id = this.mySiteId();
    if (!id) return;
    if (!this.pw.old || !this.pw.next || !this.pw.confirm) return this.toast.warning('Fill all password fields');
    if (this.pw.next !== this.pw.confirm) return this.toast.warning('Passwords do not match');
    try {
      this.store.changeSitePassword(id, this.pw.old, this.pw.next);
      this.toast.success('Password updated');
      this.pw = { old: '', next: '', confirm: '' };
    } catch (e: any) {
      this.toast.danger(e?.message || 'Unable to change password');
    }
  }

  // Profile editing (Site) with draft + save and avatar upload
  siteProfile() {
    const id = this.mySiteId();
    if (!id) return undefined;
    return this.store.siteSupervisors().find(s => s.id === id);
  }
  draft = { name: '', bio: '' };
  initDraftFromProfile() {
    const p = this.siteProfile();
    this.draft = { name: p?.name || '', bio: p?.bio || '' };
  }
  saveProfile() {
    const id = this.mySiteId();
    if (!id) return;
    this.store.updateSiteSupervisor(id, { name: this.draft.name, bio: this.draft.bio });
    this.toast.success('Profile saved');
  }
  async onAvatarSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    const id = this.mySiteId(); if (!id) return;
    this.store.updateSiteSupervisor(id, { avatarBase64: base64 });
    this.toast.success('Profile photo updated');
    input.value = '';
  }
}

// small util to convert File->base64 (scoped to this feature)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
