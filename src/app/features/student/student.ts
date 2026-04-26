import { Component, computed, effect, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
import { AdminService } from '../../shared/services/admin.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { AssignmentForm } from './assignment-form';
import { Form3Form } from './form3-form';
import { DataCacheService } from '../../core/services/data-cache.service';
@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule, RouterModule, PaginatePipe, PaginatorComponent, AssignmentForm, Form3Form],
  templateUrl: './student.html',
  styleUrl: './student.css'
})
export class Student implements OnInit, OnDestroy {
  // Dynamic dropdown options from backend
  dropdownCompanies: Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; supervisorCount?: number }> = [];
  // UI state for professional autocomplete
  isCompanyDropdownOpen = false;
  activeCompanyIndex = -1;
  loadingCompanies = false;
  companyIndustryFilter = '';
  availableIndustries: string[] = [];
  private companySearchDebounceId: any;
  private companySearchRequestId = 0;
  private companyCache = new Map<string, Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; supervisorCount?: number }>>();
  private companyCacheKeys: string[] = [];
  private lastFetchedCompanyQuery: string = '';
  private lastCompanyQuery: string = '';
  /** Pre-loaded pool of all companies — filled on first focus so subsequent opens are instant. */
  private allCompaniesPool: Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; supervisorCount?: number }> = [];
  private allCompaniesLoading = false;
  private allCompaniesLoaded = false;
  // Selected/preview company state
  companyPreview: { id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; supervisorCount?: number } | null = null;
  /** Exposed publicly so the template can pass the selected company to child components (e.g. AssignmentForm). */
  selectedCompany: { id: string; name: string; email?: string; address?: string; website?: string; industry?: string } | null = null;

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
  
  // APEX B Verification Status
  apexBStatus: {
    studentVerified: boolean;
    facultyVerified: boolean;
    adminApproved: boolean;
    status: string;
    internshipId?: string;
    companyName?: string;
    internshipRole?: string;
    startDate?: string;
    endDate?: string;
    facultySupervisor?: string;
    siteSupervisor?: string;
    internshipType?: string;
    duration?: string;
    location?: string;
  } | null = null;

  // Evaluations
  studentFinalResult: any = null;
  evaluationsLoadedOnce = false;
  loadingEvaluations = false;
  /** Internship ID resolved from any available API response; drives evaluations fetch. */
  studentInternshipId: string | null = null;
  loadingApexBStatus = false;

  // APEX C (Form 3 / Organization Overview) submission status
  apexCSubmitted = false;
  loadingApexCStatus = false;
  
  // Loading states for skeleton loaders (other tabs)
  loadingData = {
    companyRequests: false,
    weeklyLogs: false,
    evaluations: false
  };
  
  // Check if all verifications are complete (APEX B triple-approval)
  isFullyApproved(): boolean {
    const apexB = this.apexBStatus;
    if (!apexB) return this.isApproved();
    return apexB.studentVerified && apexB.facultyVerified && apexB.adminApproved;
  }

  /**
   * TRUE when the internship is considered started:
   *   – APEX B fully approved: student + faculty + admin all verified
   *   – APEX C (Form 3) submitted by student
   *
   * APEX A admin approval is NOT checked separately because APEX B can only
   * reach full approval after APEX A is already approved — so isFullyApproved()
   * implicitly covers it.
   *
   * Tab rules:
   *   NOT started → show: appex, assignment, form3, request-company, complaints
   *   STARTED     → show: weeklylogs, evaluations, request-company, complaints
   */
  internshipStarted(): boolean {
    return this.isFullyApproved() && this.apexCSubmitted;
  }

  // Alias kept for any legacy template references
  allApexFormsApproved(): boolean {
    return this.internshipStarted();
  }
  
  private lockSelection: any;
  // tabs: make each form an explicit tab so AppEx-A is first
  currentTab: 'appex'|'assignment'|'form3'|'weeklylogs'|'evaluations'|'company-request'|'complaints' = 'appex';
  // Raw query param value (for debugging why a tab may be set but UI not rendering)
  lastQueryTab: string | null = null;
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

  // Form 3: Organization Overview & Scope of Work
  form3 = {
    organizationOverview: '',
    roleDescription: '',
    keyActivities: '',
    toolsTechnologies: '',
    expectedDeliverables: ''
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
  complaint = { subject: '', body: '', category: 'GENERAL' as 'GENERAL'|'TECHNICAL'|'SUPERVISOR'|'ORGANIZATION'|'OTHER', internshipId: '' };
  complaintLoading = false;
  myComplaints = () => {
    if (!this.selectedId) return [] as any[];
    return this.store.complaints().filter(c => c.submittedById === this.selectedId);
  };
  
  getComplaintDetails(complaintId: string) {
    return this.store.getComplaint(complaintId);
  }
  
  // Company request
  companyRequest = {
    name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    industry: '',
    description: '',
    justification: ''
  };
  submittingCompanyRequest = false;
  myCompanyRequests: any[] = [];
  loadingMyCompanyRequests = false;
  approvedCompanyRequests: any[] = [];
  companyRequestStatus: any = null;
  companyRequestStatistics: any = null;
  statusFilters = {
    includePending: true,
    includeApproved: true,
    includeRejected: true
  };
  selectedCompanyRequestDetail: any = null;
  loadingCompanyRequestDetail = false;
  showCompanyRequestDetailModal = false;
  private lastCompanyRequestClickTime: number = 0;
  private companyRequestClickDebounceMs: number = 300;
  
  // Auto-refresh status polling
  private statusPollingInterval: any = null;
  private hasLoadedAppExAOnce = false;
  private hasLoadedApexBStatusOnce = false;
  private hasLoadedWeeklyLogsOnce = false;
  private hasLoadedMyCompanyRequestsOnce = false;
  private hasLoadedCompanyRequestStatusOnce = false;
  /** Tracks the last tab that was fully initialized (data loaded). Prevents re-loading when the
   *  queryParamMap subscription fires for internal navigations on the same tab. */
  private lastInitializedTab: string | null = null;
  
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private studentApi: StudentService, private adminApi: AdminService, private cdr: ChangeDetectorRef, private dataCache: DataCacheService) {
    this.lockSelection = effect(() => {
      const mine = this.myStudentId();
      if (mine && this.selectedId !== mine) this.selectedId = mine;
      
      // NOTE: APEX A/B data is loaded via selectTab('appex'), triggered by
      // the queryParamMap subscription below. We do NOT auto-load here because
      // new students (with no submissions) would get 404 errors on every page load.
      if (this.selectedId) {
        // Start polling only once per session — and only if student has submitted APEX A
        // (new students with no submissions don't need polling, it just generates 404 noise)
        if (!this.dataCache.isFresh('student:polling') && this.appexASubmitted) {
          this.startStatusPolling();
          this.dataCache.mark('student:polling');
        }
      }
    });
    // Initialize tab from query params
    try {
      this.route.queryParamMap.subscribe(p => {
          const tabParam = p.get('tab');
          const allowed = ['appex','assignment','form3','weeklylogs','evaluations','company-request','complaints'] as const;
          if (tabParam) {
            // record raw value for diagnostics
            this.lastQueryTab = tabParam;
            // Normalize common aliases: remove non-alphanum, collapse dashes/underscores/spaces
            const norm = (tabParam || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            // map some legacy/alternate names to canonical tabs
            const aliasMap: Record<string, string> = {
              'forms': 'appex',
              'form3': 'form3',
              'form03': 'form3',
              'formthree': 'form3',
              'assignment': 'assignment',
              'assignments': 'assignment',
              'complaints': 'complaints',
              'appex': 'appex',
              'approval': 'appex',
              // Hyphen stripped by normalizer — must map explicitly
              'companyrequest': 'company-request',
              'companyreq': 'company-request',
              'request': 'company-request',
              'weeklylogs': 'weeklylogs',
              'weeklylog': 'weeklylogs',
              'evaluations': 'evaluations',
              'evaluation': 'evaluations',
            };
            const mapped = aliasMap[norm] ?? norm;
            if ((allowed as readonly string[]).includes(mapped)) {
              this.currentTab = mapped as any;
              // Reflect canonical tab in URL so aliases normalize in address bar.
              try {
                if (tabParam !== mapped) {
                  this.router.navigate([], { relativeTo: this.route, queryParams: { tab: mapped }, queryParamsHandling: 'merge' });
                }
              } catch {}
            } else {
              this.currentTab = 'appex';
            }
          } else {
            // No explicit tab: default to weekly logs if internship started, otherwise AppEx-A
            this.currentTab = this.internshipStarted() ? 'weeklylogs' : 'appex';
          }

        // Tab visibility guards based on internship-started status
        const started = this.internshipStarted();
        // Pre-internship tabs (forms) — hidden once internship has started
        const formTabs = new Set(['appex', 'assignment', 'form3']);
        // Post-internship tabs — only visible after internship started
        const postStartTabs = new Set(['weeklylogs', 'evaluations']);

        if (started && formTabs.has(this.currentTab)) {
          // Internship started — form tabs no longer relevant, redirect to weekly logs
          this.currentTab = 'weeklylogs';
          try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'weeklylogs' }, queryParamsHandling: 'merge' }); } catch {}
        } else if (!started && postStartTabs.has(this.currentTab)) {
          // Internship not yet started — post-start tabs not accessible
          this.currentTab = 'appex';
          try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'appex' }, queryParamsHandling: 'merge' }); } catch {}
        }

        // Only trigger selectTab (and its data-loading) when the tab has actually changed.
        // Skipping it on same-tab re-navigation prevents the loader from restarting every time
        // the queryParamMap subscription fires (e.g. after an internal router.navigate call).
        if (this.currentTab !== this.lastInitializedTab) {
          this.lastInitializedTab = this.currentTab;
          this.selectTab(this.currentTab);
        }
      });
    } catch {}

    // On student identity resolved: auto-submit any offline AppEx-A draft and load company requests
    try {
      effect(() => {
        const sid = this.selectedId;
        if (!sid) return;
        // Reset tab-specific flags so data reloads for the new student session
        if (this.dataCache.isFresh('student:appexA:' + sid)) return; // wait for first load
        this.hasLoadedMyCompanyRequestsOnce = false;
        this.hasLoadedWeeklyLogsOnce = false;
        this.hasLoadedCompanyRequestStatusOnce = false;
        this.evaluationsLoadedOnce = false;
        (async () => {
          // Try to auto-submit any locally-saved offline draft
          try {
            const key = `appexA_draft_${sid}`;
            const draftRaw = localStorage.getItem(key);
            if (draftRaw && !this.dataCache.isFresh('student:appexA:' + sid)) {
              try {
                const draft = JSON.parse(draftRaw);
                // Only auto-submit if the draft has real content (not an empty form)
                const hasContent = draft && (draft.organization?.trim() || draft.contactName?.trim() || draft.contactEmail?.trim());
                if (hasContent) {
                  await this.apiSubmitAppExA(draft);
                  localStorage.removeItem(key);
                  this.appexASubmitted = true;
                  this.toast.info('Saved offline AppEx-A draft uploaded to server');
                  // Invalidate cache so loadAppExAIfNeeded re-fetches the new data
                  this.dataCache.invalidate('student:appexA:' + sid);
                  this.loadAppExAIfNeeded();
                }
              } catch (err) {}
            }
          } catch {}

          // Load company requests if not already done this session
          try {
            if (!this.hasLoadedMyCompanyRequestsOnce) {
              await this.loadMyCompanyRequests();
            }
          } catch (err) {}
        })();
      });
    } catch {}

      // Auto-load latest Agreement and Design Statement into forms when a student is selected
      try {
        effect(() => {
          const sid = this.selectedId;
          if (!sid) return;
          try {
            const agList = this.store.agreements()[sid] ?? [];
            if (agList.length) {
              const latest = agList[agList.length - 1] as any;
              if (latest && latest.studentAgreementData) {
                // populate assignment/agreement form fields
                this.studentAgreementForm = { ...this.studentAgreementForm, ...(latest.studentAgreementData || {}) };
              }
            }
          } catch {}
        });
      } catch {}

    // Persist drafts to localStorage as the student edits the AppEx-A form (debounced via effect trigger)
    try {
      effect(() => {
        const sid = this.selectedId;
        if (!sid) return;
        const form = this.appexAForm;
        // Only save if the form has real content (don't save empty forms)
        const hasContent = form && (form.organization?.trim() || form.contactName?.trim() || form.contactEmail?.trim());
        if (!hasContent) return;
        const dump = JSON.stringify(form);
        const key = `appexA_draft_${sid}`;
        try { localStorage.setItem(key, dump); } catch {}
      });
    } catch {}
  }

  ngOnInit() {
    // APEX A/B data is loaded on-demand via selectTab('appex'), which is triggered
    // by the queryParamMap subscription in the constructor. We do NOT auto-load
    // here because new students would get 404 errors on every page load.
  }

  onCompanyNameInput(value: string) {
    const q = (value || '').trim();
    this.appexAForm.organization = q;
    this.lastCompanyQuery = q;
    // If user types something different than the selected company's name, clear selection
    if (this.selectedCompany && (this.selectedCompany.name || '').toLowerCase() !== q.toLowerCase()) {
      this.selectedCompany = null;
    }
    if (this.companySearchDebounceId) clearTimeout(this.companySearchDebounceId);
    this.companySearchDebounceId = setTimeout(async () => {
      try {
        if (!q) {
          // Empty field — show all pre-loaded companies
          this.dropdownCompanies = this.allCompaniesPool.slice(0, 50);
          this.isCompanyDropdownOpen = this.dropdownCompanies.length > 0 || this.allCompaniesLoading;
          this.companyPreview = null;
          this.loadingCompanies = false;
          this.activeCompanyIndex = -1;
        } else if (q.length < 2) {
          // Single char — filter from pool for instant results
          const lower = q.toLowerCase();
          this.dropdownCompanies = this.allCompaniesPool
            .filter(c => (c.name || '').toLowerCase().includes(lower))
            .slice(0, 15);
          this.isCompanyDropdownOpen = true;
          this.companyPreview = null;
          this.loadingCompanies = false;
          this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
        } else {
          // 2+ chars: filter pool instantly, then also fetch from API for fresh results
          const lower = q.toLowerCase();
          // Instant filter from pool while API fetches
          const poolFiltered = this.allCompaniesPool
            .filter(c => (c.name || '').toLowerCase().includes(lower));
          this.dropdownCompanies = poolFiltered.slice(0, 15);
          this.isCompanyDropdownOpen = true;
          this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;

          const cacheKey = `${lower}|${this.companyIndustryFilter}`;
          if (!this.companyCache.has(cacheKey)) {
            this.loadingCompanies = true;
            const reqId = ++this.companySearchRequestId;
            this.lastFetchedCompanyQuery = lower;
            try {
              const fetched = await this.studentApi.getDropdownCompanies({
                search: q,
                industry: this.companyIndustryFilter || undefined,
                limit: 50
              });
              if (reqId !== this.companySearchRequestId) return;
              const results = (fetched?.data || []) as typeof this.allCompaniesPool;
              // Merge into pool
              results.forEach(r => {
                if (!this.allCompaniesPool.find(p => p.id === r.id)) this.allCompaniesPool.push(r);
              });
              this.companyCache.set(cacheKey, results);
              this.companyCacheKeys.push(cacheKey);
              if (this.companyCacheKeys.length > 50) {
                const oldest = this.companyCacheKeys.shift();
                if (oldest) this.companyCache.delete(oldest);
              }
              // Extract unique industries
              const industries = new Set<string>();
              results.forEach((c: any) => { if (c.industry) industries.add(c.industry); });
              this.availableIndustries = Array.from(industries).sort();
              // Re-filter with fresh API data
              const fresh = this.allCompaniesPool
                .filter(c => (c.name || '').toLowerCase().includes(lower));
              this.dropdownCompanies = fresh.sort((a, b) => {
                const an = (a.name || '').toLowerCase();
                const bn = (b.name || '').toLowerCase();
                return (an.startsWith(lower) ? 0 : 1) - (bn.startsWith(lower) ? 0 : 1) || an.indexOf(lower) - bn.indexOf(lower);
              }).slice(0, 15);
              this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
            } catch { /* use pool results already shown */ } finally {
              this.loadingCompanies = false;
            }
          } else {
            // Serve from cache
            const cached = this.companyCache.get(cacheKey)!;
            this.dropdownCompanies = cached
              .filter(c => (c.name || '').toLowerCase().includes(lower))
              .sort((a, b) => {
                const an = (a.name || '').toLowerCase();
                const bn = (b.name || '').toLowerCase();
                return (an.startsWith(lower) ? 0 : 1) - (bn.startsWith(lower) ? 0 : 1);
              }).slice(0, 15);
            this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
          }
        }
      } catch {
        this.dropdownCompanies = [];
        this.activeCompanyIndex = -1;
        this.loadingCompanies = false;
      }
      // Update preview
      this.companyPreview = null;
      if (q) {
        const lower = q.toLowerCase();
        const match = this.dropdownCompanies.find(c => (c.name || '').toLowerCase() === lower) || null;
        this.companyPreview = match;
      }
    }, 120);
  }

  usePreviewAddress() {
    const addr = this.companyPreview?.address?.trim();
    if (addr) this.appexAForm.address = addr;
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

    // If pool already loaded, open dropdown immediately with matching or all companies
    if (this.allCompaniesLoaded && this.allCompaniesPool.length > 0) {
      if (!q) {
        this.dropdownCompanies = this.allCompaniesPool.slice(0, 50);
      } else {
        const lower = q.toLowerCase();
        this.dropdownCompanies = this.allCompaniesPool
          .filter(c => (c.name || '').toLowerCase().includes(lower))
          .slice(0, 15);
      }
      this.isCompanyDropdownOpen = this.dropdownCompanies.length > 0;
      this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
      return;
    }

    // First focus — fetch all companies and show them
    if (!this.allCompaniesLoading) {
      this.allCompaniesLoading = true;
      this.loadingCompanies = true;
      this.isCompanyDropdownOpen = true;
      this.studentApi.getDropdownCompanies({ limit: 100 }).then(res => {
        const data = (res?.data || []) as typeof this.allCompaniesPool;
        this.allCompaniesPool = data.sort((a, b) =>
          (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
        );
        this.allCompaniesLoaded = true;
        // Populate industry filter options
        const industries = new Set<string>();
        data.forEach((c: any) => { if (c.industry) industries.add(c.industry); });
        if (!this.availableIndustries.length) {
          this.availableIndustries = Array.from(industries).sort();
        }
        // Show matching or all
        const current = (this.appexAForm?.organization || '').trim();
        if (!current) {
          this.dropdownCompanies = this.allCompaniesPool.slice(0, 50);
        } else {
          const lower = current.toLowerCase();
          this.dropdownCompanies = this.allCompaniesPool
            .filter(c => (c.name || '').toLowerCase().includes(lower))
            .slice(0, 15);
        }
        this.isCompanyDropdownOpen = this.dropdownCompanies.length > 0;
        this.activeCompanyIndex = this.dropdownCompanies.length ? 0 : -1;
      }).catch(() => {
        this.isCompanyDropdownOpen = false;
      }).finally(() => {
        this.loadingCompanies = false;
        this.allCompaniesLoading = false;
      });
    }
  }

  onCompanyInputBlur() {
    // Delay closing to allow click selection - increased to 300ms for better UX
    setTimeout(() => {
      this.isCompanyDropdownOpen = false;
      this.activeCompanyIndex = -1;
    }, 300);
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
      const internshipId = res?.internship?.id;
      if (internshipId) {
        console.log(`🌐 [Student] New internship created: ${internshipId}`);
      }
      this.toast.success(res?.message || 'Internship request created');
      return res;
    } catch (err: any) {
      const msg = err?.error?.message || err?.error?.error || err?.message || 'Failed to create internship';
      this.toast.danger(msg);
      throw err;
    }
  }
  async apiGetAppExA(options?: { skipGlobalLoading?: boolean; forceRefresh?: boolean; silentError?: boolean }) {
    try {
      // Always silent — 404/400 means no APEX A submitted yet, which is normal for new students
      return await this.studentApi.getAppExA({ ...options, silentError: true });
    } catch (err: any) {
      // 404 / 400 → no AppEx-A data yet (new student) — return empty object so form starts fresh
      if (err?.status === 404 || err?.status === 400) {
        return {};
      }
      // Network/CORS errors
      const isNet = err && (err.status === 0 || (err.message || '').toString().toLowerCase().includes('unknown error'));
      if (isNet) {
        this.toast.warning('Unable to reach AppEx-A server (network/CORS). Working offline.');
        return {};
      }
      // Genuinely unexpected server error (5xx) — show toast
      this.toast.danger(err?.error?.message || err?.message || 'Failed to load AppEx-A data');
      throw err;
    }
  }
  async apiSubmitAppExA(payload: any) {
    try {
      console.log('📝 [apiSubmitAppExA] Received payload:', JSON.stringify(payload, null, 2));
      const res = await this.studentApi.submitAppExA(payload);
      this.toast.success(res?.message || 'AppEx-A submitted');
      return res;
    } catch (err: any) {
      const isNet = err && (err.status === 0 || (err.message || '').toString().toLowerCase().includes('unknown error'));
      if (isNet) {
        // Save payload as draft locally so user doesn't lose work
        try { if (this.selectedId) localStorage.setItem(`appexA_draft_${this.selectedId}`, JSON.stringify(payload)); } catch {}
        this.toast.info('Network error submitting AppEx-A; changes saved locally and will be retried when online.');
        return { offline: true } as any;
      }
      this.toast.danger(err?.error?.message || err?.message || 'Failed to submit AppEx-A');
      throw err;
    }
  }
  async apiUpdateAppExA(payload: any) {
    try {
      const res = await this.studentApi.updateAppExA(payload);
      this.toast.success(res?.message || 'AppEx-A updated');
      return res;
    } catch (err: any) {
      const isNet = err && (err.status === 0 || (err.message || '').toString().toLowerCase().includes('unknown error'));
      if (isNet) {
        try { if (this.selectedId) localStorage.setItem(`appexA_draft_${this.selectedId}`, JSON.stringify(payload)); } catch {}
        this.toast.info('Network error updating AppEx-A; changes saved locally and will be retried when online.');
        return { offline: true } as any;
      }
      this.toast.danger(err?.error?.message || err?.message || 'Failed to update AppEx-A');
      throw err;
    }
  }

  // Load APEX B verification status for current student
  async loadApexBStatus(isBackground = false) {
    if (this.loadingApexBStatus || !this.selectedId) return;
    
    this.loadingApexBStatus = true;
    try {
      const res = await this.studentApi.getAppexBVerification({
        skipGlobalLoading: this.hasLoadedApexBStatusOnce || isBackground,
        forceRefresh: isBackground
      });
      this.hasLoadedApexBStatusOnce = true;
      this.dataCache.mark('student:apexb');
      
      // Response structure from student endpoint
      const apexB = res?.apexB || res?.data || res;
      
      if (apexB) {
        this.apexBStatus = {
          studentVerified: apexB.studentVerified || false,
          facultyVerified: apexB.facultyVerified || false,
          adminApproved: apexB.adminApproved || apexB.status === 'approved' || false,
          status: apexB.status || 'PENDING',
          internshipId: apexB.internshipId || apexB._id || apexB.id,
          companyName: apexB.companyName,
          internshipRole: apexB.internshipRole,
          startDate: apexB.startDate,
          endDate: apexB.endDate,
          // Admin-added details from APEX B
          facultySupervisor: apexB.facultySupervisor || apexB.facultySupervisorNameDesig,
          siteSupervisor: apexB.siteSupervisor || apexB.siteSupervisorNameDesig,
          internshipType: apexB.internshipType || apexB.type,
          duration: apexB.duration || apexB.durationWeeks ? `${apexB.durationWeeks} weeks` : undefined,
          location: apexB.location || apexB.internshipLocation
        };
        
        console.log('✅ [Student] APEX B Status loaded:', {
          studentVerified: this.apexBStatus.studentVerified,
          facultyVerified: this.apexBStatus.facultyVerified,
          adminApproved: this.apexBStatus.adminApproved,
          fullyApproved: this.isFullyApproved()
        });
        
        // NOTE: APEX C GET endpoint was removed from the backend.
        // apexCSubmitted is set only via the onApexCSubmitted() event emitted by the form.

        // If fully approved, load weekly logs and evaluations — but only if not already cached
        if (this.isFullyApproved()) {
          // Use cache guards: skip if already loaded this session
          if (!this.dataCache.isFresh('student:weeklylogs')) {
            this.loadWeeklyLogs();
          }
          if (!this.dataCache.isFresh('student:evaluations')) {
            this.loadEvaluations();
          }
          // Auto-switch to weekly logs tab if internship has started and student is on form tabs
          if (this.internshipStarted() && ['appex', 'assignment', 'form3', 'appex-c'].includes(this.currentTab)) {
            this.selectTab('weeklylogs');
          }
          // Stop polling once fully approved
          this.stopStatusPolling();
        }

        // Sync internship-started state to the store (drives header + footer tabs)
        this.store.setStudentInternshipStarted(this.internshipStarted());
        
        // Update UI immediately
        this.cdr.detectChanges();
      } else {
        console.log('ℹ️ [Student] No APEX B form found for this student');
        this.apexBStatus = null;
      }
    } catch (err: any) {
      console.error('❌ [Student] Error loading APEX B status:', err);
      // If 404 or no data found, it's expected (student hasn't submitted yet)
      if (err?.status === 404 || err?.status === 400) {
        console.log('ℹ️ [Student] APEX B not yet submitted');
        this.apexBStatus = null;
      } else {
        this.apexBStatus = null;
      }
    } finally {
      this.loadingApexBStatus = false;
      this.cdr.detectChanges();
    }
  }

  // Start automatic status polling to check for verification updates
  private startStatusPolling() {
    // Clear any existing interval
    this.stopStatusPolling();
    
    // Only poll if not fully approved yet
    if (!this.isFullyApproved()) {
      console.log('🔄 [Student] Starting automatic status polling...');
      
      // Poll every 30 seconds
      this.statusPollingInterval = setInterval(() => {
        if (this.selectedId && !this.isFullyApproved()) {
          console.log('🔄 [Student] Auto-checking verification status...');
          this.loadApexBStatus(true);
        } else if (this.isFullyApproved()) {
          // Stop polling once fully approved
          console.log('✅ [Student] Fully approved - stopping status polling');
          this.stopStatusPolling();
        }
      }, 30000); // 30 seconds
    }
  }
  
  // Stop automatic status polling
  private stopStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }
  
  // Cleanup on component destroy
  ngOnDestroy() {
    this.stopStatusPolling();
  }

  // Forms for new API integrations
  createInternshipModel: { type: 'ONSITE'|'REMOTE'|'VIRTUAL'|'HYBRID'; siteId?: string; facultyId?: string } = { type: 'ONSITE', siteId: '', facultyId: '' };
  appexAForm = {
    organization: '', address: '', industrySector: '', contactName: '', contactDesignation: '', contactPhone: '', contactEmail: '',
    internshipField: '', internshipLocation: '', startDate: '', endDate: '', workingDays: '', workingHours: '',
    // additional fields used by the new Internship Approval Form
    numberOfPositions: 1,
    natureOfInternship: { softwareDevelopment: false, dataScience: false, networking: false, cyberSecurity: false, webMobile: false, otherChecked: false, otherText: '' },
    mode: 'On-Site' as 'On-Site'|'Virtual'|'Freelancing'
  };

  // APEX B Verification Form
  // AppEx B verification removed - approve/reject buttons now directly in assignment form

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
    const res = await this.apiCreateInternship(type, siteId, facultyId);
    
    // Capture internship ID from response and store it for later use
    if (res?.internship?.id) {
      this.studentInternshipId = res.internship.id;
      console.log('✅ [Student] Internship created with ID:', this.studentInternshipId);
      
      // Reset evaluation loading flag so it will reload when evaluations tab is selected
      this.evaluationsLoadedOnce = false;
      console.log('🔄 [Student] Evaluation cache cleared - ready to fetch final results');
      
      // If evaluations tab is already selected, load the final result immediately
      if (this.isCurrentTab('evaluations')) {
        console.log('📊 [Student] Evaluations tab is active - fetching final result now...');
        this.loadFinalResult(false);
      }
    }
  }
  
  async loadAppExA() {
    try {
      const res = await this.apiGetAppExA({ skipGlobalLoading: true, silentError: true });
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
      // Approved → permanently locked, cannot resubmit
      if (this.appexAStatus === 'approved') {
        this.toast.warning('Your APEX A form has been approved and cannot be resubmitted');
        return;
      }
      // Pending → waiting for admin response, block re-submission
      if (this.appexASubmitted && this.appexAStatus === 'pending') {
        this.toast.info('Your form is already under review. Please wait for the admin to respond.');
        return;
      }
      // Rejected → use PUT (update) so the student can correct and resubmit
      if (this.appexASubmitted && this.appexAStatus === 'rejected') {
        await this.apiUpdateAppExA({ ...this.appexAForm });
        this.appexAStatus = 'pending';
        try { if (this.selectedId) localStorage.removeItem(`appexA_draft_${this.selectedId}`); } catch {}
        return;
      }
      // First-time submission → POST
      await this.apiSubmitAppExA({ ...this.appexAForm });
      this.appexASubmitted = true;
      this.appexAStatus = 'pending';
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
  appexAStatus: 'pending' | 'approved' | 'rejected' = 'pending'; // Track approval status

  // Compatibility helpers for remaining code that expects approval/agreement checks
  hasSubmittedApproval(): boolean {
    return !!this.appexASubmitted;
  }
  hasSubmittedAgreement(): boolean {
    // Agreement flow removed from student UI; treat agreement requirement as satisfied when AppEx-A is submitted
    return !!this.appexASubmitted;
  }

  /**
   * Called when the form3-form child component emits `apexCSubmitted`.
   * Immediately flips the local flag and propagates to the store so the header
   * and footer also react without waiting for the next polling cycle.
   */
  onApexCSubmitted() {
    this.apexCSubmitted = true;
    // Sync to store (drives header + footer tab visibility)
    this.store.setStudentInternshipStarted(this.internshipStarted());
    // If all conditions are now met, redirect to weekly logs
    if (this.internshipStarted()) {
      this.selectTab('weeklylogs');
    }
    this.cdr.detectChanges();
  }

  onApexBApproved() {
    if (this.apexBStatus) {
      this.apexBStatus.studentVerified = true;
    }
    this.loadApexBStatus(true).then(() => {
      // After reloading, check if we need to switch tabs
      if (this.internshipStarted()) {
        this.selectTab('weeklylogs');
      }
    });
  }

  selectTab(tab: Student['currentTab']) {
    // Guard: redirect form tabs if internship has started
    const started = this.internshipStarted();
    const formTabs = new Set(['appex', 'assignment', 'form3']);
    const postStartTabs = new Set(['weeklylogs', 'evaluations']);
    if (started && formTabs.has(tab)) {
      tab = 'weeklylogs';
    } else if (!started && postStartTabs.has(tab)) {
      tab = 'appex';
    }

    const tabChanged = this.currentTab !== tab;
    this.currentTab = tab;
    // Keep lastInitializedTab in sync so the queryParamMap subscription
    // (re-fired by router.navigate below) does NOT call selectTab() again.
    this.lastInitializedTab = tab;

    if (tabChanged) {
      try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
    }
    
    // Guard every tab load with DataCacheService — prevents spinner on every navigation back
    if (tab === 'appex') {
      // Always ensure APEX A data is loaded/fresh when student opens this tab
      if (!this.dataCache.isFresh('student:appexA:' + this.selectedId)) {
        this.loadAppExAIfNeeded();
      }
      // Always ensure APEX B status is loaded/fresh
      if (!this.dataCache.isFresh('student:apexb')) {
        this.loadApexBStatus(false);
      }
      // NOTE: APEX C GET endpoint removed from backend — apexCSubmitted is set only
      // via onApexCSubmitted() when the student submits the form in the current session.
      // When cache IS fresh: do nothing — apexBStatus is already populated in memory
    } else if (tab === 'weeklylogs') {
      if (!this.dataCache.isFresh('student:weeklylogs')) {
        this.loadWeeklyLogs();
      }
      // Also load internship report status
      if (!this.dataCache.isFresh('student:report')) {
        this.loadInternshipReport();
      }
    } else if (tab === 'company-request') {
      if (!this.dataCache.isFresh('student:companystatus')) {
        this.loadCompanyRequestStatus();
      }
    } else if (tab === 'evaluations') {
      if (!this.dataCache.isFresh('student:evaluations') && !this.loadingEvaluations) {
        this.loadEvaluations();
      }
    }
  }

  /**
   * APEX C GET endpoint was removed from the backend — this method is now a no-op.
   * apexCSubmitted is only set to true via onApexCSubmitted() (emitted by Form3Form after POST).
   * Keeping the method signature to avoid any stale references causing compile errors.
   */
  async checkApexCStatus() {
    // GET /api/student/appex-c has been removed from the backend — do nothing.
  }

  /**
   * Loads AppEx-A form data from the server if not already cached.
   * Guards with a per-student cache key so it only fires once per TTL window.
   * Silently handles 404 (new student with no submission yet).
   */
  async loadAppExAIfNeeded() {
    const sid = this.selectedId;
    if (!sid) return;
    const cacheKey = 'student:appexA:' + sid;
    if (this.dataCache.isFresh(cacheKey)) return;

    try {
      const res = await this.apiGetAppExA({ skipGlobalLoading: this.hasLoadedAppExAOnce, silentError: true });
      this.hasLoadedAppExAOnce = true;
      this.dataCache.mark(cacheKey);

      // Resolve internship ID if returned
      const internshipObj = (res as any)?.internship;
      const resolvedId: string = internshipObj?.id || internshipObj?._id || (res as any)?.internshipId || '';
      if (resolvedId) this.studentInternshipId = resolvedId;

      if (internshipObj?.appexC || internshipObj?.status === 'APPROVED' || internshipObj?.status === 'STARTED' || internshipObj?.status === 'ACTIVE') {
        this.apexCSubmitted = true;
      }

      // Determine APEX A approval status
      const ax = internshipObj?.appexA || (res as any)?.appexA || {};
      const status = ax.status || internshipObj?.status || 'pending';
      if (status === 'approved' || status === 'APPROVED') {
        this.appexAStatus = 'approved';
      } else if (status === 'rejected' || status === 'REJECTED') {
        this.appexAStatus = 'rejected';
      } else {
        this.appexAStatus = 'pending';
      }

      // Populate form if server has data
      const serverHas = Object.keys(ax).some(k => {
        const v = (ax as any)[k];
        return v !== undefined && v !== null && String(v).toString().trim().length > 0;
      });
      if (serverHas) {
        this.appexAForm = {
          organization: ax.organization || '',
          address: ax.address || '',
          industrySector: ax.industrySector || '',
          contactName: ax.contactName || '',
          contactDesignation: ax.contactDesignation || '',
          contactPhone: ax.contactPhone || '',
          contactEmail: ax.contactEmail || '',
          internshipField: ax.internshipNature || ax.internshipField || '',
          internshipLocation: ax.internshipLocation || '',
          startDate: (ax.startDate || '').slice(0, 10),
          endDate: (ax.endDate || '').slice(0, 10),
          workingDays: ax.workingDays || '',
          workingHours: ax.workingHours || '',
          numberOfPositions: ax.numberOfInternship || ax.numberOfPositions || 1,
          natureOfInternship: ax.natureOfInternship || { softwareDevelopment: false, dataScience: false, networking: false, cyberSecurity: false, webMobile: false, otherChecked: false, otherText: '' },
          mode: ax.mode || 'On-Site'
        };
        this.appexASubmitted = true;
      }
      // Sync internship-started state after loading APEX A status
      this.store.setStudentInternshipStarted(this.internshipStarted());
      this.cdr.detectChanges();
    } catch (err: any) {
      // 404 = student has not submitted AppEx-A yet; this is expected and silent
      if (err?.status !== 404 && err?.status !== 400) {
        this.toast.danger(err?.error?.message || err?.message || 'Failed to load AppEx-A form');
      }
    }
  }

  isCurrentTab(tab: string): boolean {
    try { return (this.currentTab as any) === tab; } catch { return false; }
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
    if (!this.selectedId || !this.complaint.subject || !this.complaint.body) return;
    if (!this.ensureMine()) return;
    this.store.submitComplaint(
      this.complaint.subject,
      this.complaint.body,
      this.complaint.category,
      this.complaint.internshipId || undefined,
      this.selectedId
    );
    this.toast.success('Complaint submitted successfully');
    this.complaint = { subject: '', body: '', category: 'GENERAL', internshipId: '' };
  }
  
  async submitCompanyRequest() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    
    const cr = this.companyRequest;
    if (!cr.name || !cr.email) {
      this.toast.warning('Please provide at least company name and email address');
      return;
    }
    
    this.submittingCompanyRequest = true;
    try {
      const payload = {
        name: cr.name.trim(),
        email: cr.email.trim(),
        phone: cr.phone?.trim() || '',
        address: cr.address?.trim() || '',
        website: cr.website?.trim() || '',
        industry: cr.industry?.trim() || '',
        description: cr.description?.trim() || '',
        justification: cr.justification?.trim() || ''
      };
      
      const result = await this.studentApi.requestToAddCompany(payload);
      this.toast.success('Company request submitted successfully');
      
      // Clear form immediately after successful submission
      this.companyRequest = {
        name: '', email: '', phone: '', address: '', website: '', industry: '', description: '', justification: ''
      };
      
      // Reset form state to valid
      this.submittingCompanyRequest = false;
      this.cdr.markForCheck();
      
      // Reload the list in background
      await this.loadMyCompanyRequests();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit company request';
      this.toast.danger(msg);
      this.submittingCompanyRequest = false;
      this.cdr.markForCheck();
    }
  }
  
  async loadMyCompanyRequests() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    // Skip if already fresh (prevents spinner on every tab switch)
    if (this.dataCache.isFresh('student:companyrequests')) return;
    
    this.loadingMyCompanyRequests = true;
    try {
      const result = await this.studentApi.getMyCompanyRequests({ 
        page: 1, 
        limit: 50,
        search: ''
      });
      this.myCompanyRequests = result?.companyRequests || [];
      this.approvedCompanyRequests = this.myCompanyRequests.filter(r => r.status === 'APPROVED' || r.status === 'approved');
      this.hasLoadedMyCompanyRequestsOnce = true;
      this.dataCache.mark('student:companyrequests');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load company requests';
      this.toast.danger(msg);
      this.myCompanyRequests = [];
      this.approvedCompanyRequests = [];
    } finally {
      this.loadingMyCompanyRequests = false;
      this.cdr.markForCheck();
    }
  }

  async loadCompanyRequestStatus() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    // Skip if already fresh
    if (this.dataCache.isFresh('student:companystatus')) return;
    
    this.loadingMyCompanyRequests = true;
    try {
      const result = await this.studentApi.getCompanyRequestStatus({
        includePending: this.statusFilters.includePending,
        includeApproved: this.statusFilters.includeApproved,
        includeRejected: this.statusFilters.includeRejected,
        page: 1,
        limit: 50
      });
      this.companyRequestStatus = result?.requests || [];
      this.companyRequestStatistics = result?.statistics || null;
      this.hasLoadedCompanyRequestStatusOnce = true;
      this.dataCache.mark('student:companystatus');
    } catch (err: any) {
      this.companyRequestStatus = [];
      this.companyRequestStatistics = null;
    } finally {
      this.loadingMyCompanyRequests = false;
      this.cdr.markForCheck();
    }
  }

  async updateCompanyRequestStatusFilter() {
    // Reload status when filters change
    await this.loadCompanyRequestStatus();
  }

  async loadCompanyRequestDetail(requestId: string) {
    // Debounce: prevent multiple rapid clicks
    const now = Date.now();
    if (now - this.lastCompanyRequestClickTime < this.companyRequestClickDebounceMs) {
      console.log('[Student] Click ignored - too soon (debounce)');
      return;
    }
    this.lastCompanyRequestClickTime = now;
    
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    
    this.loadingCompanyRequestDetail = true;
    try {
      const result = await this.studentApi.getCompanyRequestDetail(requestId);
      this.selectedCompanyRequestDetail = result;
      this.showCompanyRequestDetailModal = true;
      console.log('✅ Company request detail loaded:', result);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load company request detail';
      this.toast.danger(msg);
      this.selectedCompanyRequestDetail = null;
    } finally {
      this.loadingCompanyRequestDetail = false;
      this.cdr.markForCheck();
    }
  }

  closeCompanyRequestDetailModal() {
    this.showCompanyRequestDetailModal = false;
    this.selectedCompanyRequestDetail = null;
  }
  selectCompanyFromRequest(companyId: string) {
    const company = this.approvedCompanyRequests.find(c => c.id === companyId);
    if (!company) return;
    
    // Populate AppEx-A form with company details
    this.appexAForm.organization = company.name || '';
    this.appexAForm.address = company.address || '';
    this.appexAForm.industrySector = company.industry || '';
    this.appexAForm.contactEmail = company.email || '';
    this.appexAForm.contactPhone = company.phone || '';
    
    this.toast.success(`Company "${company.name}" selected`);
  }

  async onCompanyIndustryFilterChange(industry: string) {
    this.companyIndustryFilter = industry;
    // Retrigger search with the new industry filter
    const currentQuery = (this.appexAForm.organization || '').trim();
    if (currentQuery && currentQuery.length >= 2) {
      this.onCompanyNameInput(currentQuery);
    }
  }

  selectCompanyFromDropdown(company: { id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string; supervisorCount?: number }) {
    // Update selected company
    this.selectedCompany = {
      id: company.id,
      name: company.name,
      email: company.email,
      address: company.address,
      website: company.website,
      industry: company.industry
    };
    
    // Populate AppEx-A form with company details
    this.appexAForm.organization = company.name || '';
    this.appexAForm.address = company.address || '';
    this.appexAForm.industrySector = company.industry || '';
    this.appexAForm.contactEmail = company.email || '';
    this.appexAForm.contactPhone = company.phone || '';
    
    // Store preview
    this.companyPreview = company;
    
    // Close dropdown and clear suggestions
    this.isCompanyDropdownOpen = false;
    this.dropdownCompanies = [];
    
    this.toast.success(`Company "${company.name}" selected from directory`);
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

  // Submit Form 3 (Organization Overview & Scope of Work)
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

  // APEX B Verification Methods removed - approve/reject now in assignment-form component

  // Update removed - Students can only submit APEX B once, cannot update after submission

  // Weekly logs functionality
  weeklyLogs: any[] = [];
  weeklyLogStatus: any = {};
  loadingWeeklyLogs = false;
  submittingWeeklyLog = false;
  weeklyLogForm = {
    weekNo: 1,
    activitiesDone: '',
    skillsLearned: '',
    challenges: ''
  };

  async loadWeeklyLogs(forceRefresh = false) {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    // Skip if already fresh and not a forced refresh
    if (!forceRefresh && this.dataCache.isFresh('student:weeklylogs')) return;

    this.loadingWeeklyLogs = true;
    try {
      const res = await this.studentApi.getWeeklyLogs({
        skipGlobalLoading: this.hasLoadedWeeklyLogsOnce || forceRefresh,
        forceRefresh
      });
      this.weeklyLogs = res?.weeklyLogs || [];
      this.weeklyLogStatus = res?.weeklyLogStatus || {};
      this.hasLoadedWeeklyLogsOnce = true;
      this.dataCache.mark('student:weeklylogs');
      
      const wlInternshipId: string = res?.internshipId || res?.weeklyLogStatus?.internshipId || '';
      if (wlInternshipId && !this.studentInternshipId) this.studentInternshipId = wlInternshipId;

      if (this.weeklyLogStatus.currentWeek) {
        this.weeklyLogForm.weekNo = this.weeklyLogStatus.currentWeek;
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load weekly logs';
      this.toast.danger(msg);
    } finally {
      this.loadingWeeklyLogs = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Fetch the student's own internship record to reliably resolve the internship ID.
   * Stores the result in `studentInternshipId` for use by other methods (e.g. loadEvaluations).
   */
  async loadStudentInternship(forceRefresh = false) {
    if (!this.selectedId) return;
    // Skip if we already have an internship ID and not forced
    if (!forceRefresh && this.studentInternshipId) return;
    try {
      const res = await this.studentApi.getMyInternship({ skipGlobalLoading: true, forceRefresh });
      const id: string =
        res?.internship?.id ||
        res?.internship?._id ||
        res?.data?.id ||
        res?.data?._id ||
        res?.[0]?.id ||
        res?.[0]?._id ||
        res?.data?.[0]?.id ||
        res?.data?.[0]?._id ||
        res?.id ||
        res?._id ||
        res?.internshipId ||
        '';
      if (id) this.studentInternshipId = id;
    } catch (err: any) {
      if (err?.status !== 404) {
        console.warn('⚠️ [Student] loadStudentInternship failed:', err?.status, err?.message);
      }
    } finally {
      if (!this.studentInternshipId && this.apexBStatus?.internshipId) {
        this.studentInternshipId = this.apexBStatus.internshipId;
      }
    }
  }

  /**
   * Load evaluations for the student's current internship from all available API sources:
   * - GET /api/site/evaluations (site mid/final)
   * - GET /api/faculty/evaluation-form (faculty evaluation)
   * - GET /api/admin/office-evaluation (office/admin evaluation)
   * Also refreshes the evaluation summary.
   */
  /** Load student's final result from /api/faculty/evaluation-summary API (student-facing endpoint) */
  async loadFinalResult(forceRefresh = false) {
    // Skip if already fresh and not a forced refresh
    if (!forceRefresh && this.dataCache.isFresh('student:evaluations')) return;

    let internshipId: string | null = this.studentInternshipId || this.apexBStatus?.internshipId || null;

    if (!internshipId) {
      await this.loadStudentInternship(true);
      if (!this.studentInternshipId) {
        this.loadingEvaluations = false;
        return;
      }
      internshipId = this.studentInternshipId;
    }

    if (this.loadingEvaluations) return;

    this.loadingEvaluations = true;
    this.cdr.markForCheck();
    
    try {
      const res = await this.studentApi.getEvaluationSummary(internshipId, { forceRefresh });
      if (res && res.finalResult) {
        this.studentFinalResult = {
          message: res.message || 'Final result loaded',
          finalResult: {
            id: res.finalResult.id || '',
            internshipId: res.finalResult.internshipId || internshipId,
            facultyMarks: res.finalResult.facultyMarks ?? null,
            siteMarks: res.finalResult.siteMarks ?? null,
            officeMarks: res.finalResult.officeMarks ?? null,
            presentationMarks: res.finalResult.presentationMarks ?? null,
            totalMarks: res.finalResult.totalMarks ?? null,
            status: res.finalResult.status || 'PENDING',
            hodSignatureUrl: res.finalResult.hodSignatureUrl || null
          },
          internship: res.internship || null
        };
      } else {
        this.studentFinalResult = null;
      }
      this.evaluationsLoadedOnce = true;
      this.dataCache.mark('student:evaluations');
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status !== 404 && status !== 400) {
        console.warn('[Student] Error loading final result:', err?.error?.message || err?.message);
      }
      this.studentFinalResult = null;
    } finally {
      this.loadingEvaluations = false;
      this.cdr.markForCheck();
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async loadEvaluations(forceRefresh = false) {
    // Redirect to new loadFinalResult method
    return this.loadFinalResult(forceRefresh);
  }

  onEvaluationFilterChange() {
    // No longer needed - removed filter functionality
    this.loadFinalResult(true);
  }

  async loadEvaluationSummary(forceRefresh = false) {
    // Merged into loadFinalResult - no longer separate
    return;
  }

  /** Convert criteria (either array or object) to uniform label/value pairs for display. */
  criteriaEntries(criteria: any): Array<{label: string; value: any}> {
    if (!criteria) return [];
    if (Array.isArray(criteria)) {
      return criteria.map((c: any) => ({
        label: c.name || c.label || c.key || 'Criterion',
        value: c.marks ?? c.value ?? c.score ?? '-'
      }));
    }
    return Object.entries(criteria).map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').trim(), // camelCase → words
      value
    }));
  }

  async submitWeeklyLog() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;

    const form = this.weeklyLogForm;

    // Validation
    if (!form.weekNo || form.weekNo < 1) {
      this.toast.warning('Please enter a valid week number');
      return;
    }

    if (!form.activitiesDone || form.activitiesDone.trim().length < 10) {
      this.toast.warning('Please describe activities done (at least 10 characters)');
      return;
    }

    if (!form.skillsLearned || form.skillsLearned.trim().length < 10) {
      this.toast.warning('Please describe skills learned (at least 10 characters)');
      return;
    }

    if (!form.challenges || form.challenges.trim().length < 10) {
      this.toast.warning('Please describe challenges faced (at least 10 characters)');
      return;
    }

    this.submittingWeeklyLog = true;
    try {
      const payload = {
        weekNo: Number(form.weekNo),
        activitiesDone: form.activitiesDone.trim(),
        skillsLearned: form.skillsLearned.trim(),
        challenges: form.challenges.trim()
      };

      const res = await this.studentApi.submitWeeklyLog(payload);
      this.toast.success(res?.message || 'Weekly log submitted successfully');
      
      // Reset form and reload logs
      this.weeklyLogForm = {
        weekNo: this.weeklyLogStatus.currentWeek || 1,
        activitiesDone: '',
        skillsLearned: '',
        challenges: ''
      };
      
      await this.loadWeeklyLogs(true);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit weekly log';
      this.toast.danger(msg);
    } finally {
      this.submittingWeeklyLog = false;
      this.cdr.detectChanges();
    }
  }

  // ═══════════════════ Internship Report ═══════════════════
  internshipReport: {
    id?: string;
    internshipId?: string;
    type?: string;
    fileUrl?: string;
    summary?: string;
    submittedDate?: string;
  } | null = null;
  internshipReportInternship: {
    id?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  } | null = null;
  loadingReport = false;
  submittingReport = false;
  reportFile: File | null = null;
  reportSummary = '';
  private hasLoadedReportOnce = false;

  async loadInternshipReport(forceRefresh = false) {
    if (!this.selectedId) return;
    if (!forceRefresh && this.dataCache.isFresh('student:report')) return;

    this.loadingReport = true;
    try {
      const res = await this.studentApi.getInternshipReport({
        skipGlobalLoading: this.hasLoadedReportOnce || forceRefresh,
        forceRefresh
      });
      this.internshipReport = res?.report || null;
      this.internshipReportInternship = res?.internship || null;
      this.hasLoadedReportOnce = true;
      this.dataCache.mark('student:report');

      // Resolve internship ID if we don't have one yet
      const rid = res?.internship?.id || res?.report?.internshipId;
      if (rid && !this.studentInternshipId) this.studentInternshipId = rid;
    } catch (err: any) {
      // 404 = no report submitted yet — expected for most students
      if (err?.status !== 404 && err?.status !== 400) {
        this.toast.danger(err?.error?.message || err?.message || 'Failed to load internship report');
      }
      this.internshipReport = null;
      this.internshipReportInternship = null;
    } finally {
      this.loadingReport = false;
      this.cdr.markForCheck();
    }
  }

  onReportFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // Validate PDF
      if (file.type !== 'application/pdf') {
        this.toast.warning('Only PDF files are allowed for internship reports');
        this.reportFile = null;
        input.value = '';
        return;
      }
      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.toast.warning('File size must be less than 10MB');
        this.reportFile = null;
        input.value = '';
        return;
      }
      this.reportFile = file;
    }
  }

  async submitInternshipReport() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;

    if (!this.reportFile) {
      this.toast.warning('Please select a PDF file to upload');
      return;
    }

    // Resolve internship ID
    const internshipId = this.studentInternshipId;
    if (!internshipId) {
      this.toast.warning('No internship found. Please ensure your APEX forms are submitted and approved first.');
      return;
    }

    this.submittingReport = true;
    try {
      const res = await this.studentApi.submitInternshipReport({
        internshipId,
        file: this.reportFile,
        summary: this.reportSummary || undefined
      });
      this.toast.success(res?.message || 'Internship report uploaded successfully');

      // Reset form
      this.reportFile = null;
      this.reportSummary = '';

      // Reload report data
      this.dataCache.invalidate('student:report');
      await this.loadInternshipReport(true);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to upload internship report';
      this.toast.danger(msg);
    } finally {
      this.submittingReport = false;
      this.cdr.detectChanges();
    }
  }

}