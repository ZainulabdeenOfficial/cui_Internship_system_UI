import { Component, computed, effect } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
import { AdminService } from '../../shared/services/admin.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule, RouterModule, PaginatePipe, PaginatorComponent],
  templateUrl: './student.html',
  styleUrl: './student.css'
})
export class Student {
  showRequestCompanyForm = false;
  // Dynamic dropdown options from backend
  dropdownCompanies: Array<{ id: string; name: string; email?: string; address?: string; website?: string; industry?: string }> = [];
  // UI state for professional autocomplete
  isCompanyDropdownOpen = false;
  activeCompanyIndex = -1;
  loadingCompanies = false;
  private companySearchDebounceId: any;
  private companySearchRequestId = 0;
  private companyCache = new Map<string, Array<{ id: string; name: string; email?: string; address?: string; website?: string; industry?: string }>>();
  private companyCacheKeys: string[] = [];
  private lastFetchedCompanyQuery: string = '';
  private lastCompanyQuery: string = '';
  // Selected/preview company state
  companyPreview: { id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string } | null = null;
  private selectedCompany: { id: string; name: string; email?: string; address?: string; website?: string; industry?: string } | null = null;

  isCompanyNotFound(): boolean {
    const name = this.appexAForm?.organization?.trim();
    if (!name) return false;
    // Only show when user typed at least 2 chars and API returned zero matches for current query
    if (name.length < 2) return false;
    // If a company was selected and matches current text, don't show request
    if (this.selectedCompany && (this.selectedCompany.name || '').toLowerCase() === name.toLowerCase()) return false;
    return (this.dropdownCompanies?.length || 0) === 0;
  }
  get students() { return this.store.students; }
  get me() { return this.store.currentUser; }
  availableCompanies = computed(() => this.store.companies());
  selectedId: string | null = null;
  selectedStudent = computed(() => this.selectedId ? this.students().find(s => s.id === this.selectedId!) : undefined);
  myStudentId = computed(() => this.me()?.studentId ?? null);
  isApproved = computed(() => !!this.selectedStudent()?.approved);
  private lockSelection: any;
  // tabs
  currentTab: 'applications'|'assignment'|'evidence'|'logs'|'reports'|'assignments'|'complaints'|'marks' = 'applications';
  // pagination state per tab/list
  page = { logs: 1, reports: 1, assignments: 1, complaints: 1, freel: 1 };
  pageSize = 10;

  // forms
  newStudent = { name: '', email: '', registrationNo: '' };
  weekly = { week: 1, note: '' };
  progress = { title: '', content: '' };
  final = { title: '', content: '' };
  // Reflective summary (one-page)
  reflective = { title: 'Reflective Summary', content: '' };
  // Design Statement
  design = {
    careerGoal: '',
    learningObjectives: '',
    placement: { organization: '', mode: 'On-site' as 'On-site'|'Remote'|'Hybrid', functionalArea: '', overview: '' },
    supervisor: { name: '', designation: '', email: '', contact: '' },
    scopeAndDeliverables: '',
    academicPreparation: '',
    comments: ''
  };

  // New comprehensive forms based on handbook
  // Approval/Agreement forms removed; AppEx-A (appexAForm) is the canonical internship approval
  proposal = { title: '', content: '' };
  // Assignments upload (base64 for demo)
  assignments = computed(() => this.selectedId ? (this.store.assignments()[this.selectedId] ?? []) : []);
  assignmentFile: { fileName?: string; fileType?: string; fileSize?: number; contentBase64?: string } = {};
  // Freelance form
  freel = {
    platform: 'Fiverr' as 'Fiverr'|'Upwork'|'OnSite'|'Virtual',
    profileAuthentic: false,
    proposalsApplied: 0,
    gigsCompleted: 0,
    earningsUSD: 0,
    avgRating: 0,
    clientFeedback: '',
    approvalEvidence: '',
    contractSummary: '',
    workSummary: '',
    mentorName: '',
    mentorContact: '',
    technologies: '',
    logbook: ''
  };

  logs = computed(() => this.selectedId ? (this.store.logs()[this.selectedId] ?? []) : []);
  reports = computed(() => this.selectedId ? (this.store.reports()[this.selectedId] ?? []) : []);
  // approvals/agreements removed from student UI — AppEx-A is used instead
  freelances = computed(() => this.selectedId ? (this.store.freelance()[this.selectedId] ?? []) : []);
  lastFreelance = computed(() => {
    const list = this.freelances();
    return list.length ? list[list.length - 1] : undefined;
  });
  canSubmitFreelance = computed(() => {
    const last = this.lastFreelance();
    if (!last) return true; // first submission allowed
    return last.status === 'rejected'; // only allow resubmit on rejection
  });
  // approval/agreement submission flow removed per UX request
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  // complaints
  complaint = { category: 'Other' as 'Technical'|'Supervisor'|'Organization'|'Other', message: '' };
  myComplaints = () => {
    if (!this.selectedId) return [] as any[];
    return this.store.complaints().filter(c => c.studentId === this.selectedId);
  };
  
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private studentApi: StudentService, private adminApi: AdminService) {
    this.lockSelection = effect(() => {
      const mine = this.myStudentId();
      if (mine && this.selectedId !== mine) this.selectedId = mine;
    });
    // Initialize tab from query params
    try {
      this.route.queryParamMap.subscribe(p => {
        const tabParam = p.get('tab');
        const allowed = ['applications','assignment','evidence','logs','reports','assignments','complaints','marks'] as const;
        if (tabParam && (allowed as readonly string[]).includes(tabParam.toLowerCase())) {
          this.currentTab = tabParam.toLowerCase() as any;
        } else {
          // No explicit tab requested: default students to the Applications tab so Internship Approval shows first
          this.currentTab = 'applications';
        }
        // guard: if not approved, restrict to applications/evidence/complaints
        const isOk = this.isApproved();
        const visibleWhenPending = new Set(['applications','assignment','evidence','complaints']);
        if (!isOk && !visibleWhenPending.has(this.currentTab)) {
          this.currentTab = 'applications';
          try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'applications' }, queryParamsHandling: 'merge' }); } catch {}
        }
      });
    } catch {}

    // Auto-load AppEx-A for the selected student (no manual Load Existing button)
    try {
      effect(() => {
        const sid = this.selectedId;
        if (!sid) return;
        (async () => {
          // 1) Try to load from server
          let serverHas = false;
          try {
            const res = await this.apiGetAppExA();
            const ax = (res as any)?.internship?.appexA || (res as any)?.appexA || {};
            // treat as present when at least one meaningful field exists
            serverHas = Object.keys(ax).some(k => {
              const v = (ax as any)[k];
              return v !== undefined && v !== null && String(v).toString().trim().length > 0;
            });
            if (serverHas) {
              this.appexAForm = {
                organization: ax.organization || '', address: ax.address || '', industrySector: ax.industrySector || '',
                contactName: ax.contactName || '', contactDesignation: ax.contactDesignation || '', contactPhone: ax.contactPhone || '', contactEmail: ax.contactEmail || '',
                internshipField: ax.internshipField || '', internshipLocation: ax.internshipLocation || '',
                startDate: (ax.startDate || '').slice(0,10), endDate: (ax.endDate || '').slice(0,10),
                workingDays: ax.workingDays || '', workingHours: ax.workingHours || '',
                numberOfPositions: ax.numberOfPositions ?? 1,
                natureOfInternship: ax.natureOfInternship || { softwareDevelopment: false, dataScience: false, networking: false, cyberSecurity: false, webMobile: false, otherChecked: false, otherText: '' },
                mode: ax.mode || 'On-Site'
              };
            }
          } catch (err) {
            // ignore load error, will attempt draft handling
          }

          // 2) Check for draft in localStorage and auto-save if server has no record
          try {
            const key = this.selectedId ? `appexA_draft_${this.selectedId}` : null;
            if (key) {
              const draftRaw = localStorage.getItem(key);
              if (!serverHas && draftRaw) {
                try {
                  const draft = JSON.parse(draftRaw);
                  // submit draft to server
                  await this.apiSubmitAppExA(draft);
                  // clear draft after successful auto-save
                  localStorage.removeItem(key);
                  this.appexASubmitted = true;
                  this.toast.info('Saved saved internship approval draft to server');
                } catch (err) {
                  // submission failed — keep draft intact
                }
              } else if (!serverHas && !draftRaw) {
                // nothing saved remotely; keep empty form (student can start filling)
              }
            }
          } catch {}
        })();
      });
    } catch {}

    // Persist drafts to localStorage as the student edits the AppEx-A form (debounced via effect trigger)
    try {
      effect(() => {
        const sid = this.selectedId;
        if (!sid) return;
        // stringify a stable representation
        const dump = JSON.stringify(this.appexAForm || {});
        const key = `appexA_draft_${sid}`;
        try { localStorage.setItem(key, dump); } catch {}
      });
    } catch {}
  }

  onCompanyNameInput(value: string) {
    const q = (value || '').trim();
    this.lastCompanyQuery = q;
    // If user types something different than the selected company's name, clear selection
    if (this.selectedCompany && (this.selectedCompany.name || '').toLowerCase() !== q.toLowerCase()) {
      this.selectedCompany = null;
    }
    if (this.companySearchDebounceId) clearTimeout(this.companySearchDebounceId);
    this.companySearchDebounceId = setTimeout(async () => {
      try {
        if (!q || q.length < 2) {
          // Avoid fetching all when empty; clear suggestions
          this.dropdownCompanies = [];
          this.companyPreview = null;
          this.isCompanyDropdownOpen = false;
          this.loadingCompanies = false;
          this.activeCompanyIndex = -1;
        } else {
          // New search: clear previous suggestions to avoid stale items
          this.loadingCompanies = true;
          this.isCompanyDropdownOpen = true;
          this.dropdownCompanies = [];
          this.activeCompanyIndex = -1;
          const lower = q.toLowerCase();
          // Serve from cache if available
          let results: Array<{ id: string; name: string; email?: string; address?: string; website?: string; industry?: string }> | null = null;
          if (this.companyCache.has(lower)) {
            results = this.companyCache.get(lower)!;
          } else {
            const reqId = ++this.companySearchRequestId;
            this.lastFetchedCompanyQuery = lower;
            const fetched = await this.adminApi.getDropdownCompanies(q);
            // If a newer request has been made, ignore this response
            if (reqId !== this.companySearchRequestId) return;
            results = fetched || [];
            // Cache with simple LRU of size 50
            this.companyCache.set(lower, results);
            this.companyCacheKeys.push(lower);
            if (this.companyCacheKeys.length > 50) {
              const oldest = this.companyCacheKeys.shift();
              if (oldest) this.companyCache.delete(oldest);
            }
          }
          // Filter: show only companies whose NAME contains the query (case-insensitive)
          const filtered = (results || []).filter(c => ((c.name || '').toLowerCase()).includes(lower));
          // Sort: names starting with query first, then others containing query
          this.dropdownCompanies = filtered.sort((a, b) => {
            const an = (a.name || '').toLowerCase();
            const bn = (b.name || '').toLowerCase();
            const aStarts = an.startsWith(lower) ? 0 : 1;
            const bStarts = bn.startsWith(lower) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            // Secondary: position of substring
            return an.indexOf(lower) - bn.indexOf(lower);
          }).slice(0, 10);
          this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
        }
      } catch {
        this.dropdownCompanies = [];
        this.activeCompanyIndex = -1;
      } finally {
        this.loadingCompanies = false;
      }
      // Compute preview only from current dropdown results (no local fallback)
      this.companyPreview = null;
      if (q) {
        const lower = q.toLowerCase();
        // Only show preview when exact match exists; avoid unrelated suggestions preview
        const match = this.dropdownCompanies.find(c => (c.name || '').toLowerCase() === lower) || null;
        this.companyPreview = match;
        // Do not auto-fill address while typing; only set on explicit selection
      }
    }, 150);
  }

  usePreviewAddress() {
    const addr = this.companyPreview?.address?.trim();
    if (addr) this.appexAForm.address = addr;
  }

  openRequestToAddCompany() {
    // Prefill request form from what the student typed and any preview data
    const typedName = (this.appexAForm?.organization || '').trim();
    const typedAddr = (this.appexAForm?.address || '').trim();
    const previewAddr = (this.companyPreview?.address || '').trim();
    this.companyRequest.name = typedName;
    // Prefer the typed address; else use preview address if available
    this.companyRequest.address = typedAddr || previewAddr || '';
    this.showRequestCompanyForm = true;
  }

  onCompanyNameSelected(ev: any) {
    try {
      const value: string = (ev?.target?.value ?? this.appexAForm?.organization ?? '').toString();
      const q = value.trim();
      if (!q) { this.companyPreview = null; return; }
      const lower = q.toLowerCase();
      // Find exact suggestion match
      const match = this.dropdownCompanies.find(c => (c.name || '').toLowerCase() === lower);
      if (match) {
        this.selectCompany(match, q);
      } else {
        // No exact match in current list; keep existing preview if any
        // Optional: we could trigger a fetch here, but onCompanyNameInput already handles live fetching
      }
    } catch {}
  }

  selectCompany(match: { id: string; name: string; address?: string; email?: string; website?: string; industry?: string }, fallbackName?: string) {
    // Normalize name case
    const normalized = match?.name || fallbackName || '';
    this.appexAForm.organization = normalized;
    // Update preview and auto-fill address if available
    this.companyPreview = null; // hide card after selection for a cleaner UI
    this.selectedCompany = match as any;
    if (match.address) this.appexAForm.address = match.address;
    // Hide suggestions until the user types again
    this.dropdownCompanies = [];
    this.isCompanyDropdownOpen = false;
    this.activeCompanyIndex = -1;
  }

  onCompanyKeydown(ev: KeyboardEvent) {
    const key = ev.key;
    if (key === 'ArrowDown' && this.isCompanyDropdownOpen) {
      ev.preventDefault();
      if (this.dropdownCompanies.length) {
        this.activeCompanyIndex = (this.activeCompanyIndex + 1) % this.dropdownCompanies.length;
      }
    } else if (key === 'ArrowUp' && this.isCompanyDropdownOpen) {
      ev.preventDefault();
      if (this.dropdownCompanies.length) {
        this.activeCompanyIndex = (this.activeCompanyIndex - 1 + this.dropdownCompanies.length) % this.dropdownCompanies.length;
      }
    } else if (key === 'Enter') {
      const q = (this.appexAForm?.organization || '').trim().toLowerCase();
      if (this.isCompanyDropdownOpen) {
        if (this.activeCompanyIndex >= 0 && this.activeCompanyIndex < this.dropdownCompanies.length) {
          ev.preventDefault();
          const sel = this.dropdownCompanies[this.activeCompanyIndex];
          if (sel) this.selectCompany(sel);
          this.companyPreview = null; // hide card after Enter
        } else if (this.dropdownCompanies.length === 1) {
          ev.preventDefault();
          this.selectCompany(this.dropdownCompanies[0]);
          this.companyPreview = null;
        } else {
          // If exact match exists, select it
          const exact = this.dropdownCompanies.find(c => (c.name || '').toLowerCase() === q);
          if (exact) {
            ev.preventDefault();
            this.selectCompany(exact);
            this.companyPreview = null;
          } else if (this.isCompanyNotFound()) {
            ev.preventDefault();
            this.openRequestToAddCompany();
            this.companyPreview = null;
          }
        }
      } else {
        // Enter pressed without dropdown; just hide preview card
        this.companyPreview = null;
      }
    } else if (key === 'Escape' && this.isCompanyDropdownOpen) {
      ev.preventDefault();
      this.isCompanyDropdownOpen = false;
      this.activeCompanyIndex = -1;
    }
  }

  onCompanyInputFocus() {
    const q = (this.appexAForm?.organization || '').trim();
    this.isCompanyDropdownOpen = q.length >= 2 && ((this.dropdownCompanies?.length || 0) > 0 || this.loadingCompanies || this.isCompanyNotFound());
  }

  onCompanyInputBlur() {
    // Delay closing to allow click selection
    setTimeout(() => {
      this.isCompanyDropdownOpen = false;
      this.activeCompanyIndex = -1;
    }, 150);
  }

  highlightCompanyName(name: string): string {
    const q = (this.lastCompanyQuery || '').toLowerCase();
    const n = (name || '').toString();
    if (!q) return n;
    const idx = n.toLowerCase().indexOf(q);
    if (idx === -1) return n;
    const before = n.slice(0, idx);
    const match = n.slice(idx, idx + q.length);
    const after = n.slice(idx + q.length);
    return `${before}<mark>${match}</mark>${after}`;
  }

  clearCompanyInput() {
    this.appexAForm.organization = '';
    this.appexAForm.address = '';
    this.dropdownCompanies = [];
    this.companyPreview = null;
    this.selectedCompany = null;
    this.isCompanyDropdownOpen = false;
    this.activeCompanyIndex = -1;
  }

  // API helpers: Internship creation and AppEx-A
  async apiCreateInternship(type: 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID', siteId?: string, facultyId?: string) {
    try {
      const res = await this.studentApi.createInternship({ type, siteId, facultyId });
      this.toast.success(res?.message || 'Internship request created');
      return res;
    } catch (err: any) {
      const msg = err?.error?.message || err?.error?.error || err?.message || 'Failed to create internship';
      this.toast.danger(msg);
      throw err;
    }
  }
  async apiGetAppExA() {
    try { return await this.studentApi.getAppExA(); } catch (err: any) { this.toast.danger(err?.error?.message || err?.message || 'Failed to load AppEx-A'); throw err; }
  }
  async apiSubmitAppExA(payload: any) {
    try { const res = await this.studentApi.submitAppExA(payload); this.toast.success(res?.message || 'AppEx-A submitted'); return res; } catch (err: any) { this.toast.danger(err?.error?.message || err?.message || 'Failed to submit AppEx-A'); throw err; }
  }
  async apiUpdateAppExA(payload: any) {
    try { const res = await this.studentApi.updateAppExA(payload); this.toast.success(res?.message || 'AppEx-A updated'); return res; } catch (err: any) { this.toast.danger(err?.error?.message || err?.message || 'Failed to update AppEx-A'); throw err; }
  }

  // Forms for new API integrations
  createInternshipModel: { type: 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID'; siteId?: string; facultyId?: string } = { type: 'ONSITE', siteId: '', facultyId: '' };
  companyRequest = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '', justification: '' };
  companyRequestsList: any[] = [];
  appexAForm = {
    organization: '', address: '', industrySector: '', contactName: '', contactDesignation: '', contactPhone: '', contactEmail: '',
    internshipField: '', internshipLocation: '', startDate: '', endDate: '', workingDays: '', workingHours: '',
    // additional fields used by the new Internship Approval Form
    numberOfPositions: 1,
    natureOfInternship: { softwareDevelopment: false, dataScience: false, networking: false, cyberSecurity: false, webMobile: false, otherChecked: false, otherText: '' },
    mode: 'On-Site' as 'On-Site'|'Virtual'|'Freelancing'
  };

  // Student Assignment & Agreement form (from provided PDF)
  studentAgreementForm = {
    fullName: '',
    registrationNumber: '',
    degreeProgram: '',
    semester: '',
    contactNumber: '',
    emailAddress: '',
    preferredField: '',
    // Agreement statement fields
    acknowledged: false,
    // signature and date removed per UX request
  };

  async createInternshipSubmit() {
    const type = this.createInternshipModel.type;
    const siteId = (this.createInternshipModel.siteId || '').trim() || undefined;
    const facultyId = (this.createInternshipModel.facultyId || '').trim() || undefined;
    await this.apiCreateInternship(type, siteId, facultyId);
  }
  
  async submitCompanyRequest() {
    const p = this.companyRequest;
    if (!p.name?.trim() || !p.email?.trim()) { 
      this.toast.warning('Name and email are required'); 
      return; 
    }
    try {
      await this.studentApi.requestToAddCompany({
        name: p.name.trim(), 
        email: p.email.trim(), 
        phone: p.phone?.trim(), 
        address: p.address?.trim(),
        website: p.website?.trim(), 
        industry: p.industry?.trim(), 
        description: p.description?.trim(), 
        justification: p.justification?.trim()
      });
      this.toast.success('Company request submitted');
      this.companyRequest = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '', justification: '' };
      await this.loadMyCompanyRequests();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit company request';
      this.toast.danger(msg);
    }
  }
  
  async loadMyCompanyRequests() {
    try {
      const res = await this.studentApi.getMyCompanyRequests({ page: 1, limit: 10 });
      this.companyRequestsList = Array.isArray((res as any)?.companyRequests) ? (res as any).companyRequests : [];
    } catch (err: any) {
      // just warn silently in UI
      this.companyRequestsList = [];
    }
  }
  async loadAppExA() {
    try {
      const res = await this.apiGetAppExA();
      const ax = (res as any)?.internship?.appexA || (res as any)?.appexA || {};
      this.appexAForm = {
        organization: ax.organization || '', address: ax.address || '', industrySector: ax.industrySector || '',
        contactName: ax.contactName || '', contactDesignation: ax.contactDesignation || '', contactPhone: ax.contactPhone || '', contactEmail: ax.contactEmail || '',
        internshipField: ax.internshipField || '', internshipLocation: ax.internshipLocation || '',
        startDate: (ax.startDate || '').slice(0,10), endDate: (ax.endDate || '').slice(0,10),
        workingDays: ax.workingDays || '', workingHours: ax.workingHours || '',
        numberOfPositions: ax.numberOfPositions ?? 1,
        natureOfInternship: ax.natureOfInternship || { softwareDevelopment: false, dataScience: false, networking: false, cyberSecurity: false, webMobile: false, otherChecked: false, otherText: '' },
        mode: ax.mode || 'On-Site'
      };
    } catch {}
  }
  async submitAppExAFromForm() {
    try {
      await this.apiSubmitAppExA({ ...this.appexAForm });
      this.appexASubmitted = true;
      // clear draft
      try { if (this.selectedId) localStorage.removeItem(`appexA_draft_${this.selectedId}`); } catch {}
    } catch {}
  }
  async updateAppExAFromForm() {
    try {
      await this.apiUpdateAppExA({ ...this.appexAForm });
      this.appexASubmitted = true;
      try { if (this.selectedId) localStorage.removeItem(`appexA_draft_${this.selectedId}`); } catch {}
    } catch {}
  }

  // Track whether the student has submitted an AppEx-A (formerly approval)
  appexASubmitted = false;

  // Compatibility helpers for remaining code that expects approval/agreement checks
  hasSubmittedApproval(): boolean {
    return !!this.appexASubmitted;
  }
  hasSubmittedAgreement(): boolean {
    // Agreement flow removed from student UI; treat agreement requirement as satisfied when AppEx-A is submitted
    return !!this.appexASubmitted;
  }
  selectTab(tab: Student['currentTab']) {
    this.currentTab = tab;
    // Reflect in URL for deep links
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
  }

  meetsFiverr(rec: any) {
    return (rec.gigsCompleted ?? 0) >= 2 || (rec.earningsUSD ?? 0) >= 500;
  }
  facultyName(id?: string) {
    if (!id) return '-';
    const f = this.facultyList().find(x => x.id === id);
    return f ? `${f.name}` : '-';
  }
  siteName(id?: string) {
    if (!id) return '-';
    const s = this.siteList().find(x => x.id === id);
    return s?.name ?? '-';
  }
  siteEmail(id?: string) {
    if (!id) return '-';
    const s = this.siteList().find(x => x.id === id);
    return s?.email ?? '-';
  }
  meetsUpwork(rec: any) {
    return (rec.proposalsApplied ?? 0) >= 10 && ((rec.earningsUSD ?? 0) >= 500);
  }

  addStudent() {
    if (!this.newStudent.name || !this.newStudent.email) return;
  const s = this.store.signup(this.newStudent.name, this.newStudent.email, '1234', this.newStudent.registrationNo);
  this.selectedId = s.id;
  this.toast.success('Account created and signed in');
  this.newStudent = { name: '', email: '', registrationNo: '' };
  }
  private ensureMine(): boolean {
    const mine = this.myStudentId();
    if (!mine) return true; // not logged-in as a specific student
    if (this.selectedId !== mine) {
      this.selectedId = mine;
      this.toast.warning('You can only access your own forms');
      return false;
    }
    return true;
  }
  private ensureApproved(): boolean {
    if (!this.isApproved()) {
      this.toast.warning('Weekly logs and reports unlock after Internship Office approval');
      return false;
    }
    return true;
  }
  addWeekly() {
    if (!this.selectedId || !this.weekly.note) return;
  if (!this.ensureMine()) return;
  if (!this.ensureApproved()) return;
  this.store.submitWeeklyLog(this.selectedId, { week: this.weekly.week, note: this.weekly.note });
  this.toast.info('Weekly log added');
    this.weekly = { week: this.weekly.week + 1, note: '' };
  }
  addProgress() {
    if (!this.selectedId || !this.progress.title) return;
  if (!this.ensureMine()) return;
  if (!this.ensureApproved()) return;
  this.store.submitReport(this.selectedId, { type: 'progress', title: this.progress.title, content: this.progress.content });
  this.toast.success('Progress report submitted');
    this.progress = { title: '', content: '' };
  }
  addFinal() {
    if (!this.selectedId || !this.final.title) return;
  if (!this.ensureMine()) return;
  if (!this.ensureApproved()) return;
  this.store.submitReport(this.selectedId, { type: 'final', title: this.final.title, content: this.final.content });
  this.toast.success('Final report submitted');
    this.final = { title: '', content: '' };
  }
  submitFreelance() {
    if (!this.selectedId) return;
  if (!this.ensureMine()) return;
  // Gate by prerequisite forms
  if (!this.hasSubmittedApproval() || !this.hasSubmittedAgreement()) {
    this.toast.warning('Submit Internship Offer & Approval and the Agreement form before adding Evidence.');
    return;
  }
  if (!this.canSubmitFreelance()) { this.toast.warning('Evidence already submitted. Please wait for Internship Office review.'); return; }
  if (!this.evidenceValid()) { this.toast.warning('Please provide required evidence details before saving.'); return; }
  this.store.submitFreelance(this.selectedId, { ...this.freel });
  this.toast.success('Evidence saved');
    this.freel = {
      platform: 'Fiverr', profileAuthentic: false, proposalsApplied: 0, gigsCompleted: 0, earningsUSD: 0,
      avgRating: 0, clientFeedback: '', approvalEvidence: '', contractSummary: '', workSummary: '',
      mentorName: '', mentorContact: '', technologies: '', logbook: ''
    };
  }
  evidenceValid(): boolean {
    const f = this.freel;
    // Common sanity: numeric fields should be >= 0
    const earn = Number(f.earningsUSD || 0);
    const gigs = Number(f.gigsCompleted || 0);
    const props = Number(f.proposalsApplied || 0);
    const hasText = [f.clientFeedback, f.approvalEvidence, f.contractSummary, f.workSummary, f.technologies, f.logbook]
      .some(v => !!(v && String(v).trim().length));
    if (f.platform === 'Fiverr') {
      // require at least some activity: gigs or earnings or meaningful text
      return gigs > 0 || earn > 0 || hasText;
    }
    if (f.platform === 'Upwork') {
      return props > 0 || earn > 0 || hasText;
    }
    // OnSite / Virtual: require at least a work summary or any meaningful text
    return !!(f.workSummary && f.workSummary.trim().length) || hasText;
  }

  private isAppExAComplete(): boolean {
    const a = this.appexAForm;
    const required = [
      a.organization,
      a.contactName,
      a.contactEmail,
      a.startDate,
      a.endDate
    ];
    const allFilled = required.every(v => !!(v && ('' + v).toString().trim().length));
    if (!allFilled) return false;
    const emailOk = /.+@.+\..+/.test((a.contactEmail || '').toString().trim());
    return !!emailOk;
  }

  async submitApproval() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    if (!this.isAppExAComplete()) {
      this.toast.warning('Please complete required fields in the Internship Approval form before submitting.');
      return;
    }
    try {
      await this.apiSubmitAppExA({ ...this.appexAForm });
      this.appexASubmitted = true;
      this.toast.success('Internship Approval (AppEx-A) submitted');
    } catch (err) {
      // apiSubmitAppExA already shows toast on error
    }
  }

  async submitAgreement() {
    // Agreement flow removed from student UI. Treat agreement as satisfied when AppEx-A is submitted.
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    if (!this.appexASubmitted) {
      this.toast.warning('Please submit the Internship Approval form first.');
      return;
    }
    // Mark agreement as accepted for gating purposes
    this.toast.success('Agreement acknowledged (student)');
  }

  // Submit the Assignment & Student Agreement form (persist to store.agreements for record)
  submitStudentAssignmentAgreement() {
    if (!this.selectedId) return;
    // basic validation
    const f = this.studentAgreementForm as any;
    if (!f.fullName?.trim() || !f.registrationNumber?.trim() || !f.emailAddress?.trim()) {
      this.toast.warning('Please complete required fields: name, registration number, email');
      return;
    }
    try {
      // store.submitAgreement expects Agreement-like payload; cast to any to store full form under agreements
      const payload: any = {
        policyAcknowledgement: !!f.acknowledged,
        confidentialityAgreement: true,
        safetyTraining: true,
        // signature and date removed; keep full form data for records
        studentAgreementData: { ...f }
      };
      this.store.submitAgreement(this.selectedId, payload as any);
      this.toast.success('Student Assignment & Agreement form saved');
      // clear form
      this.studentAgreementForm = { fullName: '', registrationNumber: '', degreeProgram: '', semester: '', contactNumber: '', emailAddress: '', preferredField: '', acknowledged: false };
    } catch (err: any) {
      this.toast.danger('Failed to save agreement');
    }
  }
  submitProposal() {
    if (!this.selectedId || !this.proposal.title) return;
  if (!this.ensureMine()) return;
  this.store.submitReport(this.selectedId, { type: 'proposal', title: this.proposal.title, content: this.proposal.content });
  this.toast.success('Design proposal submitted');
    this.proposal = { title: '', content: '' };
  }
  submitComplaint() {
    if (!this.selectedId || !this.complaint.message) return;
    if (!this.ensureMine()) return;
    this.store.submitComplaint(this.selectedId, this.complaint.category, this.complaint.message);
    this.toast.success('Complaint submitted');
    this.complaint = { category: 'Other', message: '' };
  }
  submitDesign() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    this.store.submitDesignStatement(this.selectedId, { ...this.design });
    this.toast.success('Design Statement submitted');
    this.design = {
      careerGoal: '', learningObjectives: '', placement: { organization: '', mode: 'On-site', functionalArea: '', overview: '' },
      supervisor: { name: '', designation: '', email: '', contact: '' }, scopeAndDeliverables: '', academicPreparation: '', comments: ''
    };
  }
  submitReflective() {
    if (!this.selectedId || !this.reflective.content) return;
    if (!this.ensureMine()) return;
    if (!this.ensureApproved()) return;
    this.store.submitReport(this.selectedId, { type: 'reflective', title: this.reflective.title, content: this.reflective.content });
    this.toast.success('Reflective summary submitted');
    this.reflective = { title: 'Reflective Summary', content: '' };
  }
  // loadLatestApproval removed — AppEx-A is the canonical form and is loaded via `loadAppExA()`
  async onAssignmentFileChange(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    this.assignmentFile = { fileName: file.name, fileType: file.type || 'application/octet-stream', fileSize: file.size, contentBase64: b64 };
  }
  submitAssignment() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
  const f = this.assignmentFile;
  if (!f.fileName || !f.contentBase64 || !f.fileType || !f.fileSize) { this.toast.warning('Choose a file first'); return; }
  this.store.submitAssignment(this.selectedId, { fileName: f.fileName!, fileType: f.fileType!, fileSize: f.fileSize!, contentBase64: f.contentBase64! });
    this.toast.success('Assignment uploaded');
    this.assignmentFile = {};
    const el = document.getElementById('afile') as HTMLInputElement | null;
    if (el) el.value = '';
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
}
