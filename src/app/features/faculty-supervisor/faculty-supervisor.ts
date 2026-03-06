import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { FacultyService, FacultyProfile, FacultyInternship } from '../../shared/services/faculty.service';

@Component({
  selector: 'app-faculty-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './faculty-supervisor.html',
  styleUrl: './faculty-supervisor.css'
})
export class FacultySupervisor {
  private hasLoadedProfileOnce = false;
  private hasLoadedRequestsOnce = false;

  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private facultyApi: FacultyService) {
    // Pre-load APEX B requests on initialization for instant display
    this.loadStudentRequests();
    this.loadFacultyInternships();
    
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','details','reports','assignments','agreements','profile','requests'] as const;
        if ((allowed as readonly string[]).includes(t)) {
          this.currentTab = t as any;
          if (this.currentTab === 'profile') this.loadMyProfileFromApi();
          // No need to reload requests here since we pre-loaded them
        }
      });
    } catch {}
  }
  get students() { return this.store.students; }
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  get companyList() { return this.store.companies; }
  selectedId: string | null = null;
  currentTab: 'students'|'details'|'reports'|'assignments'|'agreements'|'profile'|'requests'|'marks' = 'students';
  page = { students: 1, appexA: 1, appexB: 1 };
  pageSize = 10;
  selectTab(tab: FacultySupervisor['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
    if (tab === 'profile') this.loadMyProfileFromApi();
    if (tab === 'marks') {
      // Load APEX B requests first to populate marksTabStudents() with internship IDs
      if (!this.hasLoadedRequestsOnce) this.loadStudentRequests();
      this.loadEvaluationSummaryForSelected();
    }
    // Requests are pre-loaded on init, no need to reload on tab click
  }
  get me() { return this.store.currentUser; }
  myFacultyId = computed(() => this.me()?.facultyId);
  myStudents = computed(() => {
    const fid = this.myFacultyId();
    return fid ? this.students().filter(s => s.facultyId === fid) : this.students();
  });
  // UI filters
  modeFilter: 'All'|'Fiverr'|'Upwork'|'OnSite'|'Virtual' = 'All';
  search = '';
  filteredStudents = computed(() => {
    const s = this.myStudents();
    const mf = this.modeFilter;
    const q = this.search.trim().toLowerCase();
    return s.filter(x => {
      const mode = x.internshipMode || '';
      const modeOk = mf === 'All' || mode === mf;
      const qOk = !q || x.name.toLowerCase().includes(q) || (x.email?.toLowerCase().includes(q)) || (x.registrationNo?.toLowerCase().includes(q));
      return modeOk && qOk;
    });
  });

  selectedStudent = computed(() => this.selectedId ? this.students().find(s => s.id === this.selectedId!) : undefined);
  logs() { return this.selectedId ? (this.store.logs()[this.selectedId] ?? []) : []; }
  reports() { return this.selectedId ? (this.store.reports()[this.selectedId] ?? []) : []; }
  approvals() { return this.selectedId ? (this.store.approvals()[this.selectedId] ?? []) : []; }
  agreements() { return this.selectedId ? (this.store.agreements()[this.selectedId] ?? []) : []; }
  assignments() { return this.selectedId ? (this.store.assignments()[this.selectedId] ?? []) : []; }
  assignMarks: Record<string, number> = {};
  setMarks(v: number) { if (this.selectedId != null) { const val = Math.max(0, Number(v)); this.store.setFacultyMarks(this.selectedId, val); this.toast.success('Faculty marks updated'); } }

  facultyProfile() {
    const id = this.myFacultyId();
    return id ? this.facultyList().find(f => f.id === id) : undefined;
  }
  // Local editable model for Profile tab; includes API-supported fields plus name/email for local store sync
  editableProfile: Partial<FacultyProfile & { name?: string; email?: string }> = {};
  savingProfile = false;
  saveProfile() {
    const id = this.myFacultyId();
    if (!id) return;
    const p = this.editableProfile || {};
    // Update store for basic identity fields immediately
    this.store.updateFacultySupervisor(id, {
      name: (p as any).name,
      email: (p as any).email,
      department: p.department
    });
    // Prepare payload for backend-supported fields
    const payload: Partial<FacultyProfile> = {
      department: p.department,
      designation: p.designation,
      phone: p.phone,
      office: p.office,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      qualifications: p.qualifications,
      expertise: p.expertise
    };
    this.savingProfile = true;
    this.facultyApi.updateProfile(payload).then(res => {
      if (res?.profile) this.apiProfile = res.profile;
      if (res?.message) this.toast.success(res.message); else this.toast.success('Profile updated');
    }).catch(err => {
      const msg = err?.error?.message || err?.message || 'Failed to update profile';
      this.toast.danger(msg);
    }).finally(() => {
      this.savingProfile = false;
    });
  }
  setAssignmentMark(aid: string) {
    if (!this.selectedId) return;
    const v = this.assignMarks[aid];
    if (v == null || isNaN(v as any)) return;
    const val = Math.max(0, Number(v));
    this.store.setAssignmentFacultyMark(this.selectedId, aid, val);
    this.toast.success('Assignment marked');
  }

  // Dashboard helper counts for template
  countPending() {
    const list = this.filteredStudents();
    return list.filter(s => !s.approved).length;
  }
  countOnsiteVirtual() {
    const list = this.filteredStudents();
    return list.filter(s => s.internshipMode === 'OnSite' || s.internshipMode === 'Virtual').length;
  }
  countFiverrUpwork() {
    const list = this.filteredStudents();
    return list.filter(s => s.internshipMode === 'Fiverr' || s.internshipMode === 'Upwork').length;
  }
  pw = { old: '', next: '', confirm: '' };
  changePassword() {
    const id = this.myFacultyId();
    if (!id) return;
    if (!this.pw.old || !this.pw.next || !this.pw.confirm) return this.toast.warning('Fill all password fields');
    if (this.pw.next !== this.pw.confirm) return this.toast.warning('Passwords do not match');
    try {
      this.store.changeFacultyPassword(id, this.pw.old, this.pw.next);
      this.toast.success('Password updated');
      this.pw = { old: '', next: '', confirm: '' };
    } catch (e: any) {
      this.toast.danger(e?.message || 'Unable to change password');
    }
  }
  companyName(id?: string) {
    if (!id) return '-';
    const c = this.companyList().find(x => x.id === id);
    return c?.name ?? '-';
  }
  siteName(id?: string) {
    if (!id) return '-';
    const s = this.siteList().find(x => x.id === id);
    return s?.name ?? '-';
  }
  downloadAssignment(a: any) {
    try {
      const byteChars = atob(a.contentBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: a.fileType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = a.fileName || 'assignment';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {}
  }
  // Per-report manage
  reportMarks: Record<string, number> = {};
  setReportMark(rid: string) {
    if (!this.selectedId) return;
    const v = this.reportMarks[rid];
    if (v == null || isNaN(v as any)) return;
    const val = Math.max(0, Number(v));
    this.store.setReportScore(this.selectedId, rid, val);
    this.toast.success('Report score saved');
  }
  toggleReportApproved(rid: string, approved: boolean) {
    if (!this.selectedId) return;
    this.store.setReportApproved(this.selectedId, rid, approved);
    this.toast.success(approved ? 'Report approved' : 'Report unapproved');
  }
  // Faculty profile via API
  apiProfile?: FacultyProfile;
  loadingProfile = false;
  async loadMyProfileFromApi(forceRefresh = false) {
    if (this.loadingProfile) return;
    this.loadingProfile = true;
    try {
      const res = await this.facultyApi.getProfile({
        skipGlobalLoading: this.hasLoadedProfileOnce || forceRefresh,
        forceRefresh
      });
      this.hasLoadedProfileOnce = true;
      this.apiProfile = res.profile;
      // Optionally, sync into local store for view binding consistency
      const id = this.myFacultyId();
      if (id && res.profile) {
        const changes: any = {
          department: res.profile.department,
          email: this.facultyProfile()?.email, // keep existing email from store
          name: this.facultyProfile()?.name,
        };
        this.store.updateFacultySupervisor(id, changes);
      }
      // Populate editable model from store + api profile
      const fp = this.facultyProfile();
      this.editableProfile = {
        name: fp?.name,
        email: fp?.email,
        department: res.profile?.department ?? fp?.department,
        designation: res.profile?.designation,
        phone: res.profile?.phone,
        office: res.profile?.office,
        bio: res.profile?.bio,
        avatarUrl: res.profile?.avatarUrl,
        qualifications: res.profile?.qualifications,
        expertise: res.profile?.expertise
      };
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load profile';
      this.toast.danger(msg);
    } finally {
      this.loadingProfile = false;
    }
  }

  // Student Requests (Appex A & B)
  appexARequests: any[] = [];
  appexBRequests: any[] = [];
  loadingRequests = false;
  requestFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  requestSearch = '';

  // Faculty internships from GET /api/faculty/internships
  facultyInternships: FacultyInternship[] = [];
  loadingFacultyInternships = false;
  private hasLoadedInternshipsOnce = false;

  async loadFacultyInternships(forceRefresh = false) {
    if (this.loadingFacultyInternships) return;
    this.loadingFacultyInternships = true;
    try {
      const res = await this.facultyApi.getFacultyInternships('all', {
        skipGlobalLoading: this.hasLoadedInternshipsOnce,
        forceRefresh
      });
      this.facultyInternships = res?.data ?? [];
      this.hasLoadedInternshipsOnce = true;
    } catch (err: any) {
      // Non-critical — degrade gracefully if endpoint unavailable
      console.warn('[Faculty] Could not load faculty internships:', err?.error?.message || err?.message);
    } finally {
      this.loadingFacultyInternships = false;
    }
  }
  currentFormsSubTab: 'apexA' | 'apexB' = 'apexA';
  processingItems = new Set<string>(); // Track which items are being processed
  
  // Modal for viewing APEX A details
  showApexADetailsModal = false;
  selectedApexAForm: any = null;
  
  async loadStudentRequests(forceRefresh = false, silent = false) {
    if (this.loadingRequests) return;
    if (!silent) this.loadingRequests = true;
    
    console.log('🔄 [Faculty - Load Student Requests] Starting...', {
      filter: this.requestFilter,
      pageAppexA: this.page.appexA,
      pageAppexB: this.page.appexB,
      pageSize: this.pageSize,
      silent
    });
    
    try {
      const statusFilter = this.requestFilter === 'all' ? undefined : this.requestFilter;
      
      // Load both requests in parallel for faster performance
      const [resA, resB] = await Promise.all([
        this.facultyApi.getAppexAApprovals(statusFilter, this.page.appexA, this.pageSize, {
          skipGlobalLoading: this.hasLoadedRequestsOnce || forceRefresh,
          forceRefresh
        }),
        this.facultyApi.getAppexBVerifications(statusFilter, this.page.appexB, this.pageSize, {
          skipGlobalLoading: this.hasLoadedRequestsOnce || forceRefresh,
          forceRefresh
        })
      ]);
      
      this.appexARequests = resA?.approvals || resA?.data || [];
      this.appexBRequests = resB?.verifications || resB?.data || [];
      this.hasLoadedRequestsOnce = true;
      
      console.log('✅ [Faculty - Load Student Requests] Loaded successfully:', {
        appexACount: this.appexARequests.length,
        appexBCount: this.appexBRequests.length,
        appexARequests: this.appexARequests,
        appexBRequests: this.appexBRequests
      });
    } catch (err: any) {
      if (!silent) {
        const msg = err?.error?.message || err?.message || 'Failed to load student requests';
        this.toast.danger(msg);
      }
      console.error('❌ [Faculty - Load Student Requests] Error:', err);
    } finally {
      if (!silent) this.loadingRequests = false;
    }
  }

  async approveAppexA(item: any, status: 'approved' | 'rejected', comments?: string) {
    const itemId = item.id || item.appexAId;
    if (this.processingItems.has(itemId)) return; // Prevent double-click
    
    // Check if already approved by faculty
    if (status === 'approved' && (item.status === 'approved' || item.facultyVerified === true)) {
      this.toast.warning('This APEX A has already been approved by you');
      console.log('⚠️ [Faculty - Approve APEX A] Already approved, preventing duplicate submission');
      return;
    }
    
    this.processingItems.add(itemId);
    try {
      const res = await this.facultyApi.updateAppexAApproval(itemId, status, comments);
      this.toast.success(res?.message || `APEX A ${status}`);
      
      // Update local state with new status
      const index = this.appexARequests.findIndex(r => (r.id || r.appexAId) === itemId);
      if (index !== -1) {
        // Create a new object to trigger change detection
        this.appexARequests[index] = { 
          ...this.appexARequests[index], 
          status: status 
        };
        // Force array update to trigger change detection
        this.appexARequests = [...this.appexARequests];
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to update approval';
      this.toast.danger(msg);
    } finally {
      this.processingItems.delete(itemId);
    }
  }

  async approveAppexB(item: any, action: 'approve' | 'request_changes', comments?: string) {
    const itemId = item.id || item.assignmentId;
    
    console.log('🎯 [Faculty - Approve APEX B] Starting verification:', {
      itemId,
      action,
      comments,
      currentItemStatus: item.status,
      currentFacultyVerified: item.facultyVerified,
      fullItem: item
    });
    
    if (this.processingItems.has(itemId)) {
      console.log('⚠️ [Faculty - Approve APEX B] Already processing, preventing duplicate');
      return; // Prevent double-click
    }
    
    // Check if already approved by faculty
    if (action === 'approve' && (item.status === 'approved' || item.facultyVerified === true)) {
      this.toast.warning('This APEX B has already been approved by you');
      console.log('⚠️ [Faculty - Approve APEX B] Already approved, preventing duplicate submission');
      return;
    }
    
    this.processingItems.add(itemId);
    try {
      console.log('📤 [Faculty - Approve APEX B] Calling API with:', {
        assignmentId: itemId,
        action,
        comments: comments || ''
      });
      
      const res = await this.facultyApi.updateAppexBVerification(itemId, action, comments);
      
      console.log('✅ [Faculty - Approve APEX B] API Response received:', {
        success: !!res,
        message: res?.message,
        data: res?.data,
        fullResponse: res
      });
      
      this.toast.success(res?.message || `APEX B ${action === 'approve' ? 'approved' : 'changes requested'} successfully`);
      
      // Update local state with new status immediately to reflect button state change
      const newStatus = action === 'approve' ? 'approved' : 'changes_requested';
      const index = this.appexBRequests.findIndex(r => (r.id || r.assignmentId) === itemId);
      
      console.log('🔍 [Faculty - Approve APEX B] Finding item in local array:', {
        index,
        foundItem: index !== -1 ? this.appexBRequests[index] : null
      });
      
      if (index !== -1) {
        // Create a new object to trigger change detection and mark facultyVerified as true/false
        const updatedItem = { 
          ...this.appexBRequests[index], 
          status: newStatus,
          facultyVerified: action === 'approve' ? true : false,
          calculatedStatus: res?.data?.status || res?.data?.calculatedStatus || (action === 'approve' ? 'FACULTY_VERIFIED' : 'CHANGES_REQUESTED'),
          facultyVerificationComments: comments || null,
          facultyVerifiedAt: new Date().toISOString()
        };
        
        // Update the item in the array
        this.appexBRequests[index] = updatedItem;
        
        // Force array update to trigger immediate change detection
        this.appexBRequests = [...this.appexBRequests];
        
        console.log('✅ [Faculty - Approve APEX B] Local state updated, UI will reflect immediately:', {
          itemIndex: index,
          newStatus,
          facultyVerified: updatedItem.facultyVerified,
          calculatedStatus: updatedItem.calculatedStatus,
          updatedItem
        });
        
        // Reload the list to get latest data from server silently (no spinner flash)
        setTimeout(() => {
          console.log('🔄 [Faculty - Approve APEX B] Reloading requests in background (silent)...');
          this.loadStudentRequests(true, true).then(() => {
            console.log('✅ [Faculty - Approve APEX B] Requests reloaded successfully');
          }).catch(err => {
            console.error('❌ [Faculty - Approve APEX B] Error reloading:', err);
          });
        }, 500);
      } else {
        console.warn('⚠️ [Faculty - Approve APEX B] Item not found in local array for update');
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to update verification';
      this.toast.danger(msg);
      console.error('❌ [Faculty - Approve APEX B] Error details:', {
        error: err,
        message: msg,
        status: err?.status,
        statusText: err?.statusText,
        errorObject: err?.error
      });
    } finally {
      // Always remove from processing set to restore button state
      this.processingItems.delete(itemId);
      console.log('🏁 [Faculty - Approve APEX B] Processing completed, button state restored');
    }
  }

  isProcessingItem(item: any): boolean {
    const itemId = item.id || item.appexAId || item.assignmentId;
    return this.processingItems.has(itemId);
  }

  isApexBAlreadyApproved(item: any): boolean {
    return item.status === 'approved' || item.facultyVerified === true;
  }

  isApexAAlreadyApproved(item: any): boolean {
    return item.status === 'approved' || item.facultyVerified === true;
  }

  filteredAppexARequests(): any[] {
    const search = this.requestSearch.trim().toLowerCase();
    const filter = this.requestFilter;
    
    return this.appexARequests.filter(item => {
      // Status filter
      const status = item.status || 'pending';
      if (filter !== 'all' && status !== filter) return false;
      
      // Search filter
      if (search) {
        const studentName = (item.studentInfo?.name || item.student?.name || '').toLowerCase();
        const studentEmail = (item.studentInfo?.email || item.student?.email || '').toLowerCase();
        const companyName = (item.company?.name || item.companyName || '').toLowerCase();
        
        if (!studentName.includes(search) && !studentEmail.includes(search) && !companyName.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  }

  filteredAppexBRequests(): any[] {
    const search = this.requestSearch.trim().toLowerCase();
    const filter = this.requestFilter;
    
    return this.appexBRequests.filter(item => {
      // Show items relevant to faculty:
      // 1. Needs verification (admin approved but faculty hasn't verified)
      // 2. Already faculty-verified (to show "Verified" badge)
      // 3. Changes requested status
      const isRelevant = 
        (item.adminApprovalStatus === 'APPROVED') ||
        item.status === 'PENDING_VERIFICATION' ||
        item.calculatedStatus === 'PENDING_VERIFICATION' ||
        item.status === 'pending' ||
        item.status === 'approved' ||
        item.status === 'changes_requested' ||
        item.facultyVerified === true;
      
      if (!isRelevant) return false;
      
      // Status filter (only applicable if filter is set)
      if (filter !== 'all') {
        const status = item.status || item.calculatedStatus || 'pending';
        if (filter === 'pending' && item.facultyVerified === true) return false;
        if (filter === 'pending' && status !== 'PENDING_VERIFICATION' && status !== 'pending') return false;
        if (filter === 'approved' && item.facultyVerified !== true) return false;
        if (filter === 'rejected' && item.status !== 'rejected' && item.status !== 'changes_requested') return false;
      }
      
      // Search filter
      if (search) {
        const studentName = (item.student?.name || item.studentName || item.name || '').toLowerCase();
        const studentEmail = (item.student?.email || item.studentEmail || item.email || '').toLowerCase();
        const companyName = (item.companyName || '').toLowerCase();
        const role = (item.internshipRole || '').toLowerCase();
        
        if (!studentName.includes(search) && !studentEmail.includes(search) && !companyName.includes(search) && !role.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  }

  onRequestFilterChange() {
    this.page.appexA = 1;
    this.page.appexB = 1;
    this.loadStudentRequests(true);
  }

  viewApexADetails(form: any) {
    this.selectedApexAForm = form;
    this.showApexADetailsModal = true;
  }

  closeApexADetailsModal() {
    this.showApexADetailsModal = false;
    this.selectedApexAForm = null;
  }

  // APEX B Details Modal
  showApexBDetailsModal = false;
  selectedApexBForm: any = null;

  viewApexBDetails(form: any) {
    console.log('👁️ [Faculty - View APEX B Details] Opening modal for:', form);
    this.selectedApexBForm = form;
    this.showApexBDetailsModal = true;
  }

  closeApexBDetailsModal() {
    this.showApexBDetailsModal = false;
    this.selectedApexBForm = null;
  }

  // ── Faculty Evaluation Marks (POST /api/faculty/evaluation-summary) ──────────
  facultyMarksForm = { internshipId: '', marks: 0 };
  submittingFacultyMarks = false;
  evaluationSummary: {
    facultyMarks?: number | null;
    siteMarks?: number | null;
    officeMarks?: number | null;
    totalMarks?: number | null;
    status?: string;
    maximumMarks?: { faculty?: number; site?: number; office?: number; total?: number };
  } | null = null;
  loadingEvaluationSummary = false;

  // ── Faculty Evaluation Form (GET /api/faculty/evaluation-form) ─────────────
  evaluationForm: {
    id?: string;
    type?: string;
    totalMarks?: number;
    maxMarks?: number;
    criteria?: any[];
    comments?: string;
    submittedDate?: string;
    evaluator?: any;
  } | null = null;
  loadingEvaluationForm = false;
  selectedStudentForMarks: any = null;

  /** Select a student in the Marks tab and load their evaluation data. */
  selectStudentForMarks(student: any) {
    this.selectedStudentForMarks = student;
    // Prefer direct internshipId (from /api/faculty/internships), then fall back to APEX B lookup
    let internshipId = student?.internshipId || '';
    if (!internshipId) {
      const apexBMatch = this.appexBRequests.find(
        item => (item.student?.id === student.id || item.studentId === student.id) &&
                 (item.facultyVerified === true || item.status === 'approved' || item.adminApprovalStatus === 'APPROVED')
      );
      internshipId = apexBMatch?.internshipId || student?.apexBInternshipId || '';
    }
    this.facultyMarksForm = { internshipId, marks: 0 };
    this.evaluationSummary = null;
    this.evaluationForm = null;
    if (internshipId) {
      this.loadEvaluationSummary(internshipId, true);
      this.loadEvaluationFormData(internshipId, true);
    }
  }

  /**
   * Returns students for the Marks tab by combining:
   * 1. Internships from GET /api/faculty/internships (most reliable — direct internshipId)
   * 2. Students from APEX B verification requests that are approved (fallback)
   * 3. Assigned students from local store (fallback)
   */
  marksTabStudents(): Array<any> {
    // Primary: real internship records from /api/faculty/internships
    if (this.facultyInternships.length > 0) {
      const seen = new Set<string>();
      return this.facultyInternships
        .filter(i => i.student?.id && !seen.has(i.student.id) && seen.add(i.student.id) !== undefined)
        .map(i => ({
          id: i.student.id,
          name: i.student.name,
          email: i.student.email,
          registrationNo: i.student.regNo,
          internshipMode: i.type,
          status: i.status,
          startDate: i.startDate,
          endDate: i.endDate,
          internshipId: i.id,
          finalResult: i.finalResult,
          site: i.site,
          faculty: i.faculty,
          approved: i.status !== 'PENDING'
        }));
    }

    // Fallback: enrich local store students with internship IDs from APEX B requests
    const fromStore = this.myStudents();
    const storeIds = new Set(fromStore.map((s: any) => s.id));

    const enriched = fromStore.map((s: any) => {
      const apexBMatch = this.appexBRequests.find(
        item => (item.student?.id === s.id || item.studentId === s.id) &&
                 (item.facultyVerified === true || item.status === 'approved' || item.adminApprovalStatus === 'APPROVED')
      );
      return { ...s, internshipId: apexBMatch?.internshipId || s.internshipId || '' };
    });

    // Add APEX B students not present in local store
    const apexBOnly = this.appexBRequests
      .filter(item =>
        (item.facultyVerified === true || item.status === 'approved' || item.adminApprovalStatus === 'APPROVED') &&
        item.student?.id && !storeIds.has(item.student.id)
      )
      .map(item => ({
        id: item.student?.id || item.studentId || '',
        name: item.student?.name || item.name || 'Unknown',
        email: item.student?.email || item.email || '',
        registrationNo: item.student?.regNo || item.regNo || '',
        internshipMode: item.internshipType || item.mode || undefined,
        approved: true,
        marks: undefined,
        internshipId: item.internshipId || '',
        apexBId: item.id
      }))
      .filter(s => !!s.id);

    return [...enriched, ...apexBOnly];
  }

  /** Load evaluation summary for the currently selected student's internship. */
  async loadEvaluationSummaryForSelected() {
    const id = this.facultyMarksForm.internshipId.trim();
    if (!id) return;
    await Promise.all([
      this.loadEvaluationSummary(id),
      this.loadEvaluationFormData(id)
    ]);
  }

  async loadEvaluationSummary(internshipId: string, forceRefresh = false) {
    if (!internshipId || this.loadingEvaluationSummary) return;
    this.loadingEvaluationSummary = true;
    try {
      const res = await this.facultyApi.getEvaluationSummary(internshipId, {
        skipGlobalLoading: true,
        forceRefresh
      });
      this.evaluationSummary = res?.evaluationSummary ?? null;
    } catch (err: any) {
      if (err?.status !== 404) {
        const msg = err?.error?.message || err?.message || 'Failed to load evaluation summary';
        this.toast.danger(msg);
      } else {
        this.evaluationSummary = null;
      }
    } finally {
      this.loadingEvaluationSummary = false;
    }
  }

  /** Load submitted faculty evaluation form from GET /api/faculty/evaluation-form */
  async loadEvaluationFormData(internshipId: string, forceRefresh = false) {
    if (!internshipId || this.loadingEvaluationForm) return;
    this.loadingEvaluationForm = true;
    try {
      const res = await this.facultyApi.getEvaluationForm(internshipId, {
        skipGlobalLoading: true,
        forceRefresh
      });
      this.evaluationForm = res?.evaluation ?? null;
    } catch (err: any) {
      if (err?.status !== 404) {
        const msg = err?.error?.message || err?.message || 'Failed to load evaluation form';
        this.toast.danger(msg);
      } else {
        this.evaluationForm = null;
      }
    } finally {
      this.loadingEvaluationForm = false;
    }
  }

  async submitFacultyMarks() {
    const id = this.facultyMarksForm.internshipId.trim();
    if (!id) { this.toast.warning('Enter the internship ID'); return; }
    const marks = Number(this.facultyMarksForm.marks);
    if (isNaN(marks) || marks < 0 || marks > 40) {
      this.toast.warning('Marks must be between 0 and 40');
      return;
    }
    this.submittingFacultyMarks = true;
    try {
      const res = await this.facultyApi.submitEvaluationSummary({ internshipId: id, marks });
      this.toast.success(res?.message || 'Faculty marks submitted successfully');
      this.evaluationSummary = res?.evaluationSummary ?? null;
      // Reload summary and form to show updated data
      await Promise.all([
        this.loadEvaluationSummary(id, true),
        this.loadEvaluationFormData(id, true)
      ]);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit marks';
      this.toast.danger(msg);
    } finally {
      this.submittingFacultyMarks = false;
    }
  }
}
