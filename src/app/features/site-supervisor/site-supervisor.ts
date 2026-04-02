import { Component, computed, effect, OnInit, signal } from '@angular/core';
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
    
    // Auto-load evaluations when evaluations tab is selected with a student
    effect(() => {
      if (this.currentTab === 'evaluations' && this.selectedId) {
        console.log('📋 [SiteSupervisor] Evaluations tab active with student selected - loading evaluations...');
        this.loadBothEvaluations();
      }
    });
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
  evaluationsLoadedOnce = false;
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
      punctualityAttendance: 1,
      linkTheoryToPractice: 1,
      criticalThinking: 1,
      technicalKnowledge: 1,
      creativity: 1,
      adaptability: 1,
      timeManagement: 1,
      professionalBehavior: 1,
      assignmentsPerformance: 1,
      communicationSkills: 1
    };
  }

  get evaluationTotal(): number {
    const c = this.evaluationCriteria;
    const sum = (c.punctualityAttendance + c.linkTheoryToPractice + c.criticalThinking +
      c.technicalKnowledge + c.creativity + c.adaptability + c.timeManagement +
      c.professionalBehavior + c.assignmentsPerformance + c.communicationSkills);
    // Sum of all criteria (each criterion 1-4, 10 criteria = 10-40 range)
    return sum;
  }

  /**
   * Validate criterion input in real-time
   * Clamps value to 1-4 range if user tries to type invalid number
   */
  validateCriterion(field: string, event: any) {
    const criteria = this.evaluationCriteria as any;
    let value = criteria[field];
    
    if (value === null || value === undefined || value === '') {
      criteria[field] = 1; // Default to 1, not 0
      return;
    }
    
    // Convert to number
    value = Number(value);
    
    // Clamp to 1-4 range (API requires minimum 1)
    if (value < 1) {
      criteria[field] = 1;
    } else if (value > 4) {
      criteria[field] = 4;
    } else if (!Number.isInteger(value)) {
      // Round to nearest integer
      criteria[field] = Math.round(value);
    } else {
      criteria[field] = value;
    }
    
    console.log(`✓ [validateCriterion] ${field}: ${criteria[field]}/4`);
  }

  /**
   * Validate total marks input in real-time
   * Clamps value to 10-40 range if user tries to type invalid number
   * (since each criterion is 1-4 and there are 10 criteria: 1*10=10 to 4*10=40)
   */
  validateTotalMarks(event: any) {
    if (this.evaluationTotalInput === null || this.evaluationTotalInput === undefined) {
      this.evaluationTotalInput = null;
      return;
    }
    
    let value = Number(this.evaluationTotalInput);
    
    // Clamp to 10-40 range (min 1*10, max 4*10)
    if (value < 10) {
      this.evaluationTotalInput = 10;
    } else if (value > 40) {
      this.evaluationTotalInput = 40;
    } else if (!Number.isInteger(value)) {
      // Round to nearest integer
      this.evaluationTotalInput = Math.round(value);
    } else {
      this.evaluationTotalInput = value;
    }
    
    console.log(`✓ [validateTotalMarks] ${this.evaluationTotalInput}/40`);
  }

  /**
   * Check if all criteria are valid (1-4 as per API requirements)
   */
  areCriteriaValid(): boolean {
    for (const [key, value] of Object.entries(this.evaluationCriteria)) {
      // API requires values between 1 and 4 (not 0-5)
      if (value < 1 || value > 4 || !Number.isInteger(value)) {
        console.warn(`❌ Invalid criterion: ${key} = ${value} (must be 1-4)`);
        return false;
      }
    }
    return true;
  }

  async submitEvaluation() {
    const internshipId = this.getEffectiveInternshipId();
    if (!internshipId) { this.toast.warning('Please select a student first'); return; }
    
    // Ensure evaluations are loaded before submission
    if (!this.evaluationsLoadedOnce || this.loadingEvaluation) {
      console.warn('⚠️ [submitEvaluation] Evaluations not yet loaded, fetching first...');
      this.toast.warning('Loading evaluation status, please wait...');
      this.loadingEvaluation = true;
      await this.loadBothEvaluations();
      this.loadingEvaluation = false;
    }
    
    // Check if evaluation already submitted for this type (after ensuring load is complete)
    if (this.loadedEvalForCurrentType) {
      console.warn(`⚠️ [submitEvaluation] ${this.evaluationType} already submitted for student ${this.selectedId}`);
      this.toast.warning(`${this.evaluationType === 'site_mid' ? 'Mid-term' : 'Final'} evaluation already submitted for this student`);
      return;
    }
    
    // Validate all criteria are within 1-4 range (API requirement)
    if (!this.areCriteriaValid()) {
      this.toast.danger('All criteria must have values between 1-4');
      return;
    }
    
    // Calculate total marks from criteria (sum: 10-40 since each is 1-4)
    // Each criterion is 1-4, 10 criteria, so min = 10, max = 40
    let totalMarks: number;
    
    if (this.evaluationTotalInput !== null && this.evaluationTotalInput !== undefined) {
      // Use manually entered total if provided
      totalMarks = this.evaluationTotalInput;
    } else {
      // Calculate from criteria: sum all criteria values
      totalMarks = this.evaluationTotal;
    }
    
    // Validate total marks are within 10-40 range (min 1*10, max 4*10)
    if (totalMarks < 10 || totalMarks > 40) {
      this.toast.danger('Total marks must be between 10-40 (based on criteria 1-4)');
      return;
    }
    
    this.submittingEvaluation = true;
    try {
      // Build criteria object ensuring all fields are integers 1-4
      const criteria: SiteEvaluationCriteria = {
        punctualityAttendance: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.punctualityAttendance || 1))),
        linkTheoryToPractice: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.linkTheoryToPractice || 1))),
        criticalThinking: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.criticalThinking || 1))),
        technicalKnowledge: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.technicalKnowledge || 1))),
        creativity: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.creativity || 1))),
        adaptability: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.adaptability || 1))),
        timeManagement: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.timeManagement || 1))),
        professionalBehavior: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.professionalBehavior || 1))),
        assignmentsPerformance: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.assignmentsPerformance || 1))),
        communicationSkills: Math.max(1, Math.min(4, Math.round(this.evaluationCriteria.communicationSkills || 1)))
      };
      
      const payload: SiteEvaluationPayload = {
        internshipId: internshipId.trim(),
        type: this.evaluationType,
        criteria: criteria,
        totalMarks: Math.round(totalMarks),
        ...(this.evaluationComments?.trim() ? { comments: this.evaluationComments.trim() } : {})
      };
      
      // Validate payload structure before sending
      if (!payload.internshipId || !payload.type) {
        this.toast.danger('Missing required fields: internshipId or type');
        this.submittingEvaluation = false;
        return;
      }
      
      console.log('📤 [submitEvaluation] Sending payload:', JSON.stringify({
        ...payload,
        internshipId: payload.internshipId.substring(0, 8) + '...',
      }, null, 2));
      
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
      console.error('❌ [submitEvaluation] Full error object:', err);
      console.error('❌ [submitEvaluation] Error details:', {
        status: err?.status,
        statusText: err?.statusText,
        statusMessage: err?.statusText || 'Unknown error',
        message: err?.message,
        errorBody: err?.error,
        errorMsg: typeof err?.error === 'string' ? err.error : err?.error?.message || err?.error?.error
      });
      
      // Parse different error response formats and HTTP status codes
      let errorMsg = 'Failed to submit evaluation';
      const status = err?.status ?? 0;
      
      // Handle specific HTTP status codes
      if (status === 409) {
        console.error('❌ [submitEvaluation] 409 Conflict - evaluation already exists. Response:', err?.error);
        errorMsg = err?.error?.message || 'This evaluation has already been submitted for this student. Only one evaluation per type is allowed.';
        // Reload evaluations to ensure UI is up to date
        console.log('🔄 [submitEvaluation] Reloading evaluations after 409...');
        setTimeout(() => {
          this.evaluationsLoadedOnce = false;
          this.loadBothEvaluations();
        }, 800);
      } else if (status === 401) {
        errorMsg = 'Unauthorized. Please log in again.';
      } else if (status === 403) {
        errorMsg = 'You do not have permission to submit this evaluation.';
      } else if (status === 404) {
        errorMsg = 'Internship or student not found.';
      } else if (status === 400) {
        console.error('❌ [submitEvaluation] 400 Bad Request - validation error. Response:', err?.error);
        errorMsg = err?.error?.message || 'Invalid evaluation data. Please check your input.';
      } else if (status === 500) {
        errorMsg = 'Server error. Please try again later.';
      } else if (typeof err?.error === 'string') {
        errorMsg = err.error;
      } else if (err?.error?.message) {
        errorMsg = err.error.message;
      } else if (err?.error?.error) {
        errorMsg = err.error.error;
      } else if (err?.error?.errors && Array.isArray(err.error.errors)) {
        errorMsg = err.error.errors[0] || 'Invalid request. Please check your input';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      this.toast.danger(`${errorMsg}`);
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
      console.log(`🔄 [loadBothEvaluations] Loading evaluations for internship: ${internshipId}`);
      const [midRes, finalRes] = await Promise.allSettled([
        this.siteService.getEvaluations(internshipId, 'site_mid'),
        this.siteService.getEvaluations(internshipId, 'site_final')
      ]);
      
      // Process mid-term evaluation - handle multiple response formats
      if (midRes.status === 'fulfilled' && midRes.value) {
        console.log('📊 [loadBothEvaluations] Mid response raw:', midRes.value);
        let midEval = null;
        if (midRes.value.data) {
          const data = midRes.value.data;
          if (Array.isArray(data)) midEval = data[data.length - 1] || null;
          else if (data.items && Array.isArray(data.items)) midEval = data.items[data.items.length - 1] || null;
          else if (typeof data === 'object') midEval = data;
        } else if (Array.isArray(midRes.value)) midEval = midRes.value[midRes.value.length - 1] || null;
        
        if (midEval) {
          this.loadedEvalMid = midEval;
          console.log('✅ [loadBothEvaluations] Mid-term evaluation loaded:', this.loadedEvalMid);
        } else {
          console.log('📭 [loadBothEvaluations] No mid-term evaluation found in response');
        }
      } else if (midRes.status === 'rejected') {
        console.log('📭 [loadBothEvaluations] Mid evaluation request failed:', midRes.reason?.message);
      }
      
      // Process final evaluation - handle multiple response formats
      if (finalRes.status === 'fulfilled' && finalRes.value) {
        console.log('📊 [loadBothEvaluations] Final response raw:', finalRes.value);
        let finalEval = null;
        if (finalRes.value.data) {
          const data = finalRes.value.data;
          if (Array.isArray(data)) finalEval = data[data.length - 1] || null;
          else if (data.items && Array.isArray(data.items)) finalEval = data.items[data.items.length - 1] || null;
          else if (typeof data === 'object') finalEval = data;
        } else if (Array.isArray(finalRes.value)) finalEval = finalRes.value[finalRes.value.length - 1] || null;
        
        if (finalEval) {
          this.loadedEvalFinal = finalEval;
          console.log('✅ [loadBothEvaluations] Final evaluation loaded:', this.loadedEvalFinal);
        } else {
          console.log('📭 [loadBothEvaluations] No final evaluation found in response');
        }
      } else if (finalRes.status === 'rejected') {
        console.log('📭 [loadBothEvaluations] Final evaluation request failed:', finalRes.reason?.message);
      }
    } catch (err: any) {
      console.error('❌ [loadBothEvaluations] Error loading evaluations:', err?.message);
      this.toast.danger('Unable to load existing evaluations');
    } finally {
      this.loadingEvaluation = false;
      this.evaluationsLoadedOnce = true;
      console.log('✅ [loadBothEvaluations] Load complete. Mid:', !!this.loadedEvalMid, 'Final:', !!this.loadedEvalFinal);
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
