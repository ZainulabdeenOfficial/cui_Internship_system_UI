import { ChangeDetectorRef, Component, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { FacultyService, FacultyProfile, FacultyInternship, StudentWeeklyLogs, WeeklyLog } from '../../shared/services/faculty.service';
import { DataCacheService } from '../../core/services/data-cache.service';

@Component({
  selector: 'app-faculty-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './faculty-supervisor.html',
  styleUrl: './faculty-supervisor.css'
})
export class FacultySupervisor implements OnInit {
  private hasLoadedProfileOnce = false;
  private hasLoadedRequestsOnce = false;

  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private facultyApi: FacultyService, private cdr: ChangeDetectorRef, private cache: DataCacheService) {
    // Only pre-load on first mount — skip if cache is still fresh (navigating back to this route)
    if (!this.cache.isFresh('faculty:requests')) {
      this.loadStudentRequests();
    } else {
      this.hasLoadedRequestsOnce = true;
    }
    if (!this.cache.isFresh('faculty:internships')) {
      this.loadFacultyInternships();
    } else {
      this.hasLoadedInternshipsOnce = true;
    }
    
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','profile','requests','weekly-logs','marks','finalization'] as const;
        if ((allowed as readonly string[]).includes(t)) {
          this.currentTab = t as any;
          if (this.currentTab === 'profile') this.loadMyProfileFromApi();
          if (this.currentTab === 'weekly-logs') this.loadWeeklyLogs();
          // No need to reload requests here since we pre-loaded them
        }
      });
    } catch {}
  }

  ngOnInit() {
    // Ensure default tab (students) is properly initialized
    setTimeout(() => this.selectTab(this.currentTab), 0);
  }

  get students() { return this.store.students; }
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  get companyList() { return this.store.companies; }
  selectedId: string | null = null;
  currentTab: 'students'|'requests'|'weekly-logs'|'profile'|'marks'|'finalization' = 'students';
  page = { students: 1, appexA: 1, appexB: 1 };
  pageSize = 10;
  selectTab(tab: FacultySupervisor['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
    if (tab === 'profile') this.loadMyProfileFromApi();
    if (tab === 'marks') {
      // Load APEX B requests first to populate marksTabStudents() with internship IDs
      if (!this.hasLoadedRequestsOnce) this.loadStudentRequests();
      // Ensure internships are loaded (guard inside prevents double-loading)
      this.loadFacultyInternships();
      this.loadEvaluationSummaryForSelected();
    }
    if (tab === 'finalization') {
      // Ensure internships are loaded for finalization tab
      this.loadFacultyInternships().then(() => {
        this.loadFinalizationData();
      });
    }
    if (tab === 'weekly-logs') {
      this.loadWeeklyLogs();
    }
    // Requests are pre-loaded on init, no need to reload on tab click
  }
  get me() { return this.store.currentUser; }
  
  // Loading states for skeleton loaders
  loadingData = {
    students: false,
    requests: false,
    weeklyLogs: false,
    profile: false,
    marks: false
  };
  
  // Weekly Logs
  weeklyLogsData: StudentWeeklyLogs[] = [];
  loadingWeeklyLogs = false;
  selectedWeeklyLogStudent: StudentWeeklyLogs | null = null;
  selectedWeeklyLogForDetails: WeeklyLog | null = null;
  weeklyLogsPageSize = 10;
  weeklyLogsPage = 1;
  
  myFacultyId = computed(() => this.me()?.facultyId);
  myStudents = computed(() => {
    const fid = this.myFacultyId();
    return fid ? this.students().filter(s => s.facultyId === fid) : this.students();
  });
  
  // Helper: normalize internship mode to match filter options (case-insensitive)
  private normalizeMode(mode: string): string {
    if (!mode) return '';
    const normalized = mode.toUpperCase().trim();
    if (normalized === 'ONSITE' || normalized === 'ON-SITE' || normalized === 'ON_SITE') return 'OnSite';
    if (normalized === 'VIRTUAL' || normalized === 'REMOTE') return 'Virtual';
    if (normalized === 'FIVERR') return 'Fiverr';
    if (normalized === 'UPWORK') return 'Upwork';
    return mode;
  }

  // UI filters
  modeFilter: 'All'|'Fiverr'|'Upwork'|'OnSite'|'Virtual' = 'All';
  search = '';
  filteredStudents = computed(() => {
    const s = this.myStudents();
    const mf = this.modeFilter;
    const q = this.search.trim().toLowerCase();
    const filtered = s.filter(x => {
      const mode = this.normalizeMode(x.internshipMode || '');
      const modeOk = mf === 'All' || mode === mf;
      const qOk = !q || x.name.toLowerCase().includes(q) || (x.email?.toLowerCase().includes(q)) || (x.registrationNo?.toLowerCase().includes(q));
      return modeOk && qOk;
    });
    
    // Log filtering for real-time debugging
    console.log('🔍 [Faculty Filter - Students Tab]', { mode: mf, search: q || '(none)', total: s.length, filtered: filtered.length });
    
    return filtered;
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

  // Dashboard helper: get ALL students (unfiltered) for accurate statistics
  getAllDashboardStudents(): Array<any> {
    const seen = new Set<string>();
    
    // Primary: Real internship records from API (most reliable)
    const fromInternships = this.facultyInternships
      .filter(i => i.student?.id && !seen.has(i.student.id) && seen.add(i.student.id) !== undefined)
      .map(i => ({
        id: i.student.id,
        name: i.student.name,
        email: i.student.email,
        registrationNo: i.student.regNo,
        internshipMode: i.type,
        status: i.status,
        approved: i.status !== 'PENDING',
        facultyId: i.faculty?.id
      }));

    // Fallback: Get ALL store students (no filter applied) not in internships
    const fid = this.myFacultyId();
    const allStoreStudents = fid ? this.students().filter(s => s.facultyId === fid) : this.students();
    const fromStore = allStoreStudents.filter(s => !seen.has(s.id) && seen.add(s.id) !== undefined);

    const result = [...fromInternships, ...fromStore];
    
    // Real-time dashboard stats logging
    const pending = result.filter(s => !s.approved).length;
    const onsiteVirtual = result.filter(s => s.internshipMode === 'OnSite' || s.internshipMode === 'Virtual').length;
    const freelance = result.filter(s => s.internshipMode === 'Fiverr' || s.internshipMode === 'Upwork').length;
    
    console.log('Dashboard Stats [Real-Time]:', { 
      total: result.length, 
      pending, 
      onsiteVirtual, 
      freelance 
    });
    
    return result;
  }

  // Dashboard helper counts for template (show real statistics regardless of current filters)
  countPending() {
    const list = this.getAllDashboardStudents();
    const count = list.filter(s => !s.approved).length;
    console.log('Count Pending:', count);
    return count;
  }
  countOnsiteVirtual() {
    const list = this.getAllDashboardStudents();
    const count = list.filter(s => s.internshipMode === 'OnSite' || s.internshipMode === 'Virtual').length;
    console.log('Count OnSite/Virtual:', count);
    return count;
  }
  countFiverrUpwork() {
    const list = this.getAllDashboardStudents();
    const count = list.filter(s => s.internshipMode === 'Fiverr' || s.internshipMode === 'Upwork').length;
    console.log('Count Fiverr/Upwork:', count);
    return count;
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
      this.cache.mark('faculty:internships');
      if (this.facultyInternships.length === 0) {
        console.warn('No internships returned from API (data array is empty)');
      }
    } catch (err: any) {
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
    try {
      const statusFilter = this.requestFilter === 'all' ? undefined : this.requestFilter;
      const [resA, resB] = await Promise.all([
        this.facultyApi.getAppexAApprovals(statusFilter, this.page.appexA, this.pageSize, {
          skipGlobalLoading: this.hasLoadedRequestsOnce || forceRefresh,
          silentError: true,
          forceRefresh
        }),
        this.facultyApi.getAppexBVerifications(statusFilter, this.page.appexB, this.pageSize, {
          skipGlobalLoading: this.hasLoadedRequestsOnce || forceRefresh,
          silentError: true,
          forceRefresh
        })
      ]);
      this.appexARequests = resA?.approvals || resA?.data || [];
      this.appexBRequests = resB?.verifications || resB?.data || [];
      this.hasLoadedRequestsOnce = true;
      this.cache.mark('faculty:requests');
    } catch (err: any) {
      if (!silent) {
        const msg = err?.error?.message || err?.message || 'Failed to load student requests';
        this.toast.danger(msg);
      }
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
      this.cdr.markForCheck(); // Trigger change detection to update button disabled state
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
      this.cdr.markForCheck(); // Trigger change detection to update button disabled state
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

    console.group(`👤 [Faculty Marks Tab] Student selected: ${student?.name}`);
    console.log('Student ID      :', student?.id);
    console.log('Reg. No         :', student?.registrationNo);
    console.log('Internship ID   :', internshipId || '⚠️ NOT FOUND — cannot load evaluations');
    console.log('Internship Type :', student?.internshipMode);
    console.log('Status          :', student?.status);
    if (student?.finalResult) {
      console.group('🏆 finalResult (inline from /api/faculty/internships)');
      console.log('Faculty Marks :', student.finalResult.facultyMarks, '/ 40');
      console.log('Site Marks    :', student.finalResult.siteMarks,    '/ 40');
      console.log('Office Marks  :', student.finalResult.officeMarks,  '/ 20');
      console.log('Total Marks   :', student.finalResult.totalMarks,   '/ 100');
      console.log('Status        :', student.finalResult.status);
      console.groupEnd();
    } else {
      console.warn('No finalResult on student record (marks not yet finalized)');
    }
    if (internshipId) {
      console.log(`📡 Will call GET /api/faculty/evaluation-summary?internshipId=${internshipId}`);
      console.log(`📡 Will call GET /api/faculty/evaluation-form?internshipId=${internshipId}`);
    }
    console.groupEnd();

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
      return { 
        ...s, 
        internshipId: apexBMatch?.internshipId || s.internshipId || '',
        internshipMode: apexBMatch?.internshipType || apexBMatch?.mode || s.internshipMode
      };
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

  /**
   * Filtered marks tab students with search and mode filter applied.
   */
  filteredMarksTabStudents(): Array<any> {
    const students = this.marksTabStudents();
    const mf = this.modeFilter;
    const q = this.search.trim().toLowerCase();
    
    const filtered = students.filter(x => {
      const mode = this.normalizeMode(x.internshipMode || '');
      const modeOk = mf === 'All' || mode === mf;
      const qOk = !q || x.name.toLowerCase().includes(q) || (x.email?.toLowerCase().includes(q)) || (x.registrationNo?.toLowerCase().includes(q));
      return modeOk && qOk;
    });
    
    console.log('📊 [Faculty Filter - Marks Tab]', { mode: mf, search: q || '(none)', total: students.length, filtered: filtered.length, normalized_modes: students.map(s => this.normalizeMode(s.internshipMode || '')).slice(0, 5) });
    
    return filtered;
  }

  /** Load evaluation summary for the currently selected student's internship. */
  async loadEvaluationSummaryForSelected() {
    const id = this.facultyMarksForm.internshipId.trim();
    if (!id) return;
    console.group(`🌐 [Faculty Evaluation] API calls for internshipId: ${id}`);
    console.log(`📡 GET /api/faculty/evaluation-summary?internshipId=${id}`);
    console.log(`📡 GET /api/faculty/evaluation-form?internshipId=${id}`);
    console.groupEnd();
    await Promise.all([
      this.loadEvaluationSummary(id),
      this.loadEvaluationFormData(id)
    ]);
  }

  async loadEvaluationSummary(internshipId: string, forceRefresh = false) {
    if (!internshipId || this.loadingEvaluationSummary) return;
    this.loadingEvaluationSummary = true;
    try { this.cdr.detectChanges(); } catch {}
    try {
      const res = await this.facultyApi.getEvaluationSummary(internshipId, {
        skipGlobalLoading: true,
        silentError: true,
        forceRefresh
      });
      this.evaluationSummary = res?.evaluationSummary ?? null;
      console.group(`📊 [Faculty] Evaluation Summary — internshipId: ${internshipId}`);
      console.log('Raw response:', res);
      if (this.evaluationSummary) {
        console.log('Faculty Marks :', this.evaluationSummary.facultyMarks, '/', this.evaluationSummary.maximumMarks?.faculty ?? 40);
        console.log('Site Marks    :', this.evaluationSummary.siteMarks,    '/', this.evaluationSummary.maximumMarks?.site    ?? 40);
        console.log('Office Marks  :', this.evaluationSummary.officeMarks,  '/', this.evaluationSummary.maximumMarks?.office  ?? 20);
        console.log('Total Marks   :', this.evaluationSummary.totalMarks,   '/', this.evaluationSummary.maximumMarks?.total   ?? 100);
        console.log('Status        :', this.evaluationSummary.status);
      } else {
        console.warn('No evaluationSummary in response');
      }
      console.groupEnd();
    } catch (err: any) {
      console.warn(`⚠️ [Faculty] Evaluation summary request failed (${err?.status}):`, err?.error?.message || err?.message);
      this.evaluationSummary = null;
    } finally {
      this.loadingEvaluationSummary = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  /** Load submitted faculty evaluation form from GET /api/faculty/evaluation-form */
  async loadEvaluationFormData(internshipId: string, forceRefresh = false) {
    if (!internshipId || this.loadingEvaluationForm) return;
    this.loadingEvaluationForm = true;
    try {
      const res = await this.facultyApi.getEvaluationForm(internshipId, {
        skipGlobalLoading: true,
        silentError: true,
        forceRefresh
      });
      this.evaluationForm = res?.evaluation ?? null;
      console.group(`📄 [Faculty] Evaluation Form — internshipId: ${internshipId}`);
      console.log('Raw response:', res);
      if (this.evaluationForm) {
        console.log('Type         :', this.evaluationForm.type);
        console.log('Total Marks  :', this.evaluationForm.totalMarks, '/', this.evaluationForm.maxMarks);
        console.log('Submitted At :', this.evaluationForm.submittedDate);
        console.log('Evaluator    :', this.evaluationForm.evaluator?.name || this.evaluationForm.evaluator?.email);
        if (this.evaluationForm.criteria?.length) {
          console.table(this.evaluationForm.criteria.map((c: any) => ({
            name: c.name || c.label, marks: c.marks ?? c.value ?? c.score
          })));
        }
      } else {
        console.warn('No evaluation form in response (not yet submitted or 404)');
      }
      console.groupEnd();
    } catch (err: any) {
      console.warn(`⚠️ [Faculty] Evaluation form request failed (${err?.status}):`, err?.error?.message || err?.message);
      this.evaluationForm = null;
    } finally {
      this.loadingEvaluationForm = false;
      this.cdr.markForCheck();
    }
  }

  // ── Faculty Evaluation Form (POST /api/faculty/evaluation-form) ───────────
  facultyEvalForm = {
    platformActivityEngagement: 0,
    completionOfInternshipProjects: 0,
    earningsAchieved: 0,
    skillDevelopmentLearning: 0,
    clientRatingAndFeedback: 0,
    professionalismCommunication: 0,
    comments: ''
  };
  submittingEvalForm = false;

  get evalFormTotal(): number {
    const f = this.facultyEvalForm;
    return (f.platformActivityEngagement || 0)
      + (f.completionOfInternshipProjects || 0)
      + (f.earningsAchieved || 0)
      + (f.skillDevelopmentLearning || 0)
      + (f.clientRatingAndFeedback || 0)
      + (f.professionalismCommunication || 0);
  }

  async submitEvaluationForm() {
    const id = this.facultyMarksForm.internshipId.trim();
    if (!id) { this.toast.warning('No internship ID — select a student first'); return; }
    const f = this.facultyEvalForm;
    const criteria = [
      f.platformActivityEngagement,
      f.completionOfInternshipProjects,
      f.earningsAchieved,
      f.skillDevelopmentLearning,
      f.clientRatingAndFeedback,
      f.professionalismCommunication
    ];
    if (criteria.some(v => v < 1 || v > 10)) {
      this.toast.warning('Each criterion must be between 1 and 10');
      return;
    }
    this.submittingEvalForm = true;
    try {
      const res = await this.facultyApi.submitEvaluationForm({
        internshipId: id,
        criteria: {
          platformActivityEngagement: f.platformActivityEngagement,
          completionOfInternshipProjects: f.completionOfInternshipProjects,
          earningsAchieved: f.earningsAchieved,
          skillDevelopmentLearning: f.skillDevelopmentLearning,
          clientRatingAndFeedback: f.clientRatingAndFeedback,
          professionalismCommunication: f.professionalismCommunication
        },
        comments: f.comments || undefined
      });
      this.toast.success(res?.message || 'Evaluation form submitted successfully');
      this.evaluationForm = res?.evaluation ?? null;
      await Promise.all([
        this.loadEvaluationSummary(id, true),
        this.loadEvaluationFormData(id, true)
      ]);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit evaluation form';
      this.toast.danger(msg);
    } finally {
      this.submittingEvalForm = false;
    }
  }

  async submitFacultyMarks() {    const id = this.facultyMarksForm.internshipId.trim();
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

  // ── View Evaluation Summary Modal ──────────────────────────────────────────
  showViewModal = false;
  viewModalStudent: any = null;
  viewModalSummary: any = null;
  viewModalLoading = false;

  async openViewModal(student: any) {
    this.viewModalStudent = student;
    this.viewModalSummary = null;
    this.showViewModal = true;
    
    // Trigger change detection to show modal
    try { this.cdr.detectChanges(); } catch {}

    const internshipId = student?.internshipId || '';
    if (!internshipId) return;

    this.viewModalLoading = true;
    // Trigger change detection to show loading spinner
    try { this.cdr.detectChanges(); } catch {}
    
    try {
      const res = await this.facultyApi.getEvaluationSummary(internshipId, {
        skipGlobalLoading: true,
        silentError: true,
        forceRefresh: true
      });
      this.viewModalSummary = res?.evaluationSummary ?? null;
      console.group(`📊 [Faculty] View Modal Evaluation Summary — internshipId: ${internshipId}`);
      console.log('Response:', res);
      console.log('Summary loaded:', !!this.viewModalSummary);
      console.groupEnd();
    } catch (err: any) {
      console.warn(`⚠️ [Faculty] View modal evaluation summary failed (${err?.status}):`, err?.error?.message || err?.message);
      this.viewModalSummary = null;
    } finally {
      this.viewModalLoading = false;
      // Trigger final change detection to update UI with loaded data
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewModalStudent = null;
    this.viewModalSummary = null;
  }

  /** Load weekly logs for faculty's supervised internships */
  async loadWeeklyLogs(forceRefresh = false) {
    this.loadingWeeklyLogs = true;
    this.weeklyLogsData = [];
    this.cdr.markForCheck();
    try {
      const res = await this.facultyApi.getWeeklyLogs(undefined, { forceRefresh, skipGlobalLoading: true });
      if (res?.data) {
        this.weeklyLogsData = res.data;
        console.log('✅ [Faculty] Weekly logs loaded:', this.weeklyLogsData.length, 'internships');
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load weekly logs';
      console.warn('⚠️ [Faculty] Error loading weekly logs:', msg);
      this.toast.danger('Failed to load weekly logs');
    } finally {
      this.loadingWeeklyLogs = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  /** View full details for a specific student's weekly logs */
  viewStudentWeeklyLogs(studentWeeklyLogs: StudentWeeklyLogs) {
    this.selectedWeeklyLogStudent = studentWeeklyLogs;
  }

  /** View full details for a specific weekly log entry */
  viewWeeklyLogDetails(log: WeeklyLog) {
    this.selectedWeeklyLogForDetails = { ...log };
  }

  /** Close the weekly log details view */
  closeWeeklyLogDetails() {
    this.selectedWeeklyLogForDetails = null;
  }

  /** Close the student weekly logs view */
  closeStudentWeeklyLogs() {
    this.selectedWeeklyLogStudent = null;
    this.selectedWeeklyLogForDetails = null;
  }

  /** Get paginated weekly logs for the selected student */
  paginatedWeeklyLogs() {
    if (!this.selectedWeeklyLogStudent) return [];
    const logs = this.selectedWeeklyLogStudent.weeklyLogs || [];
    const start = (this.weeklyLogsPage - 1) * this.weeklyLogsPageSize;
    const end = start + this.weeklyLogsPageSize;
    return logs.slice(start, end);
  }

  /** Get total pages for weekly logs pagination */
  getTotalWeeklyLogsPages(): number {
    if (!this.selectedWeeklyLogStudent) return 1;
    return Math.ceil((this.selectedWeeklyLogStudent.weeklyLogs?.length || 0) / this.weeklyLogsPageSize);
  }

  /** Navigate to previous page of weekly logs */
  prevWeeklyLogsPage() {
    if (this.weeklyLogsPage > 1) this.weeklyLogsPage--;
  }

  /** Navigate to next page of weekly logs */
  nextWeeklyLogsPage() {
    if (this.weeklyLogsPage < this.getTotalWeeklyLogsPages()) this.weeklyLogsPage++;
  }

  // ── Faculty Finalization (POST /api/faculty/finalization) ──────────────────
  finalizationStudents: any[] = [];
  selectedFinalizationStudent: any = null;
  loadingFinalizationData = false;
  finalizationForm = {
    internshipId: '',
    facultyMarks: 0,
    siteMarks: 0,
    officeMarks: 0
  };
  submittingFinalization = false;
  finalizationSummary: any = null;
  finalizationFinalized = false;

  /** Get students for finalization tab from faculty internships */
  getFinalizationStudents(): any[] {
    if (this.facultyInternships.length === 0) return [];
    
    return this.facultyInternships
      .filter(i => i.status === 'APPROVED' || i.status === 'ACTIVE') // Only approved/active internships can be finalized
      .map(i => ({
        id: i.student.id,
        name: i.student.name,
        email: i.student.email,
        registrationNo: i.student.regNo,
        internshipId: i.id,
        internshipMode: i.type,
        companyName: i.site?.company?.name || 'Unknown Company',
        finalResult: i.finalResult,
        status: i.status,
        startDate: i.startDate,
        endDate: i.endDate
      }));
  }

  /** Load finalization data for display */
  async loadFinalizationData() {
    this.finalizationStudents = this.getFinalizationStudents();
    console.log('📋 [Faculty Finalization] Students loaded:', this.finalizationStudents.length);
  }

  /** Select a student for finalization and load their summary */
  async selectStudentForFinalization(student: any) {
    this.selectedFinalizationStudent = student;
    this.finalizationForm = {
      internshipId: student.internshipId,
      facultyMarks: student.finalResult?.facultyMarks || 0,
      siteMarks: student.finalResult?.siteMarks || 0,
      officeMarks: student.finalResult?.officeMarks || 0
    };
    this.finalizationSummary = null;
    this.finalizationFinalized = false;

    console.group(`👤 [Faculty Finalization] Student selected: ${student.name}`);
    console.log('Internship ID:', student.internshipId);
    console.log('Internship Mode:', student.internshipMode);
    console.groupEnd();

    // Load finalization summary
    await this.loadFinalizationSummary(student.internshipId);
  }

  /** Load finalization summary for selected internship */
  async loadFinalizationSummary(internshipId: string) {
    if (!internshipId || this.loadingFinalizationData) return;
    
    this.loadingFinalizationData = true;
    try {
      const res = await this.facultyApi.getFinalizationSummary(internshipId, {
        skipGlobalLoading: true,
        silentError: true
      });

      this.finalizationSummary = res?.data ?? null;
      this.finalizationFinalized = res?.data?.finalization?.isFinalizedByFaculty ?? false;

      console.group(`📊 [Faculty Finalization] Summary loaded for internshipId: ${internshipId}`);
      console.log('Finalization Summary:', res?.data);
      console.log('Faculty Marks:', this.finalizationSummary?.marks?.facultyMarks, '/ 40');
      console.log('Site Marks:', this.finalizationSummary?.marks?.siteMarks, '/ 40');
      console.log('Office Marks:', this.finalizationSummary?.marks?.officeMarks, '/ 20');
      console.log('Total Preview:', this.finalizationSummary?.marks?.totalPreview, '/ 100');
      console.log('Status Preview:', this.finalizationSummary?.marks?.statusPreview);
      console.log('Finalized By Faculty:', this.finalizationFinalized);
      if (this.finalizationFinalized) {
        console.log('Finalized At:', this.finalizationSummary?.finalization?.finalizedAt);
        console.log('Finalized By ID:', this.finalizationSummary?.finalization?.finalizedById);
      }
      console.groupEnd();
    } catch (err: any) {
      console.warn(`⚠️ [Faculty Finalization] Failed to load summary:`, err?.error?.message || err?.message);
      this.finalizationSummary = null;
    } finally {
      this.loadingFinalizationData = false;
    }
  }

  /** Submit finalization marks */
  async submitFinalization() {
    const { internshipId, facultyMarks, siteMarks, officeMarks } = this.finalizationForm;

    if (!internshipId) {
      this.toast.warning('No internship ID — select a student first');
      return;
    }

    // Validate marks ranges
    if (facultyMarks < 0 || facultyMarks > 40) {
      this.toast.warning('Faculty marks must be between 0 and 40');
      return;
    }
    if (siteMarks < 0 || siteMarks > 40) {
      this.toast.warning('Site marks must be between 0 and 40');
      return;
    }
    if (officeMarks < 0 || officeMarks > 20) {
      this.toast.warning('Office marks must be between 0 and 20');
      return;
    }

    if (this.finalizationFinalized) {
      this.toast.warning('This internship has already been finalized');
      return;
    }

    this.submittingFinalization = true;
    this.cdr.markForCheck();  // Mark for check immediately
    try {
      console.group('📤 [Faculty Finalization] Submitting marks');
      console.log('Internship ID:', internshipId);
      console.log('Faculty Marks:', facultyMarks, '/ 40');
      console.log('Site Marks:', siteMarks, '/ 40');
      console.log('Office Marks:', officeMarks, '/ 20');
      console.log('Total:', facultyMarks + siteMarks + officeMarks, '/ 100');
      console.groupEnd();

      const res = await this.facultyApi.submitFinalization({
        internshipId,
        facultyMarks,
        siteMarks,
        officeMarks
      });

      this.toast.success(res?.message || 'Finalization submitted successfully');
      
      // Update local state
      this.finalizationFinalized = true;
      
      // Reload internships and finalization data
      await this.loadFacultyInternships(true);
      await this.loadFinalizationSummary(internshipId);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit finalization';
      this.toast.danger(msg);
      console.error('❌ [Faculty Finalization] Error:', err);
    } finally {
      this.submittingFinalization = false;  // Always reset
      this.cdr.markForCheck();  // Trigger change detection
      try { 
        this.cdr.detectChanges(); 
      } catch (e) {
        console.warn('⚠️ Change detection failed during finalization:', e);
      }
    }
  }
}
