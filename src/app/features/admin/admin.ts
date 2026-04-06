import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { AdminService } from '../../shared/services/admin.service';
import { SkeletonListComponent } from '../../shared/components/skeleton';
import { SkeletonLoaderService } from '../../core/services/skeleton-loader.service';
import { CreateAccountRequest } from '../../shared/models/admin/create-account.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent, SkeletonListComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {
  // Track which tabs have been loaded to prevent reloading on tab switch
  private hasLoadedTab = new Set<string>();

  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private adminApi: AdminService, private cdr: ChangeDetectorRef) {
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['requests','announcements','officers','faculty','companies','sites','compliance','complaints','scheme','formsrequest','evaluation'] as const;
        if ( (allowed as readonly string[]).includes(t) ) {
          this.currentTab = t as any;
          // Auto-load data when navigating directly via URL (no need to click refresh)
          if (this.currentTab === 'requests') {
            // Reset to default view: Pending, first page, no search
            this.reviewCompanyFilter.status = 'PENDING';
            this.reviewCompanyFilter.page = 1;
            this.reviewCompanyFilter.search = '';
            this.loadReviewCompany();
          } else if (this.currentTab === 'companies' || this.currentTab === 'sites') {
            // Ensure these sections are populated on direct navigation as well
            this.refreshCompanies();
            if (this.currentTab === 'sites') this.refreshSites();
          }
        }
      });
    } catch {}
    // Preload companies once for cross-tab usage (site supervisor dropdowns etc.)
    this.refreshCompanies();
  }
  get students() { return this.store.students; }
  get complaints() { return this.store.complaints; }
  get requests() { return this.store.requests; }
  
  // Complaints API data
  complaintsList: any[] = [];
  complaintsLoading = false;
  complaintsError: string | null = null;
  complaintsFilter = { status: '' as ''|'OPEN'|'IN_REVIEW'|'RESOLVED'|'DISMISSED', search: '' };
  complaintsPagination = { page: 1, limit: 10, total: 0, pages: 0 };
  complaintsStats = { OPEN: 0, IN_REVIEW: 0, RESOLVED: 0, DISMISSED: 0 };
  
  // Loading states for major content areas (for skeleton loaders)
  loadingData = {
    faculty: false,
    sites: false,
    companies: false,
    approvals: false,
    apexForms: false
  };
  
  reviewCompany = { items: [] as Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>, total: 0 };
  reviewCompanyFilter = { status: 'PENDING' as 'PENDING'|'APPROVED'|'REJECTED', page: 1, limit: 10, search: '' };
  reviewCompanyLoading = false;
  // Performance: caching + de-bounce + stale-while-revalidate
  private reviewCompanyCache = new Map<string, { items: Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>; total: number; at: number }>();
  private reviewCompanyReqId = 0;
  private reviewCompanySearchDebounce: any;
  private reviewInFlight = new Map<string, Promise<{ items: Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>; total: number }>>();
  get approvals() { return this.store.approvals; }
  get logsMap() { return this.store.logs; }
  get reportsMap() { return this.store.reports; }
  get agreementsMap() { return this.store.agreements; }
  get designStatementsMap() { return this.store.designStatements; }
  get assignmentsMap() { return this.store.assignments; }
  get freelanceMap() { return this.store.freelance; }
  get facultyList() { return this.store.facultySupervisors; }
  // Companies: source of truth from backend; keep a local cache for display
  private companiesCache: Array<import('../../shared/services/store.service').Company & { remoteId?: string }> = [];
  get companyList() { return () => this.companiesCache; }
  get siteList() { return this.store.siteSupervisors; }
  // Server-driven site supervisors list for assignment/filters
  sitesCache: Array<{ id: string; name: string; email?: string; companyId?: string }> = [];
  // search/filter inputs
  search = { officers: '', faculty: '', companies: '', sites: '', students: '' };
  filter = { facultyDept: '', industry: '', siteCompanyId: '', studentsApproved: 'all' as 'all'|'yes'|'no' };
  assignmentFilter: 'ALL'|'UNASSIGNED'|'ASSIGNED' = 'ALL';
  facultyId = '';
  siteId = '';
  selectedId: string | null = null;
  currentTab: 'requests'|'announcements'|'officers'|'faculty'|'companies'|'sites'|'compliance'|'complaints'|'scheme'|'formsRequest'|'evaluation' = 'requests';
  
  ngOnInit() {
    // Set default tab if no tab is provided in query params
    this.route.queryParamMap.subscribe(params => {
      if (!params.has('tab')) {
        setTimeout(() => this.selectTab('requests'), 0);
      }
    });
  }
  // Maintenance
  cleaningUpTokens = false;
  cleanupResult: { success?: boolean; message?: string; deletedCount?: number; timestamp?: string } | null = null;
  currentFormsSubTab: 'apexA'|'apexB'|'apexC' = 'apexA';
  // pagination
  page = { students: 1, requests: 1, complaints: 1, faculty: 1, sites: 1, companies: 1, announcements: 1, officers: 1 };
  pageSize = 10;
  async runCleanupTokens() {
    this.cleaningUpTokens = true;
    this.cleanupResult = null;
    try {
      const res = await this.adminApi.cleanupTokens();
      this.cleanupResult = res;
      this.toast.success(res?.message || `Cleanup done — ${res?.deletedCount ?? 0} tokens removed`);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Cleanup failed';
      this.toast.danger(msg);
      this.cleanupResult = { success: false, message: msg };
    } finally {
      this.cleaningUpTokens = false;
    }
  }

  selectTab(tab: Admin['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
    
    // Load data only once per tab to prevent unnecessary API calls
    if (this.hasLoadedTab.has(tab)) return;
    this.hasLoadedTab.add(tab);

    // Lazy-load data on first visit to tab
    if (tab === 'companies' || tab === 'sites') {
      this.refreshCompanies();
      if (tab === 'sites') this.refreshSites();
    }
    if (tab === 'requests') {
      // Reset to default: Pending with empty search
      this.reviewCompanyFilter.status = 'PENDING';
      this.reviewCompanyFilter.page = 1;
      this.reviewCompanyFilter.search = '';
      this.loadReviewCompany();
    }
    if (tab === 'complaints') {
      // Load complaints with default filters
      this.complaintsPagination.page = 1;
      this.complaintsFilter.status = '';
      this.complaintsFilter.search = '';
      // Fire-and-forget async load (runs in background)
      setTimeout(() => this.loadComplaints(), 0);
    }
    if (tab === 'formsRequest') {
      // Set default sub-tab and auto-load APEX A forms
      this.currentFormsSubTab = 'apexA';
      console.log('🔄 [FormRequest Tab] Switching to Forms Request tab, current sub-tab:', this.currentFormsSubTab);
      console.log('📊 [FormRequest Tab] Current APEX A forms count:', this.apexAForms.length);
      
      this.loadApexAForms();
    }
    if (tab === 'evaluation') {
      // Load all internships for browsing/selection
      this.loadAllInternships();
    }
  }
  get officers() { return this.store.internshipOfficers; }
  officer = { name: '', email: '' };
  editingOfficerId: string | null = null;
  officerEdit: { name?: string; email?: string } = {};
  responses: Record<string, string> = {};
  // create ADMIN account form (absolute API)
  adminAccount: { name: string; email: string; password: string } = { name: '', email: '', password: '' };
  creatingAdmin = false;
  // forms for adding supervisors/company
  faculty = { name: '', email: '', department: '', password: '' };
  addingFaculty = false;
  editingFacultyId: string | null = null;
  editingFaculty = { id: '', email: '', name: '', password: '', department: '', designation: '', phone: '', office: '', bio: '', avatarUrl: '', qualifications: '', expertise: '' };
  company = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '' };
  addingCompany = false;
  site = { name: '', email: '', companyId: '', password: '' };
  editingSiteId: string | null = null;
  editingSite = { id: '', name: '', email: '', companyId: '', password: '' };
  // Dynamic company dropdown for Sites tab
  dropdownCompanies: Array<{ id: string; name: string }> = [];
  private companySearchDebounceId: any;
  // Per-site-supervisor company search (student-like UI)
  siteCompanySearchQuery: Record<string, string> = {};
  siteDropdownCompanies: Record<string, Array<{ id: string; name: string; address?: string }>> = {};
  siteDropdownOpen: Record<string, boolean> = {};
  siteLoading: Record<string, boolean> = {};
  siteActiveIndex: Record<string, number> = {};
  private siteCompanyDebounce: Record<string, any> = {};
  private siteCompanyReqId: Record<string, number> = {};
  // Add Site Supervisor form - company search state (single input)
  addSiteCompanySearchQuery = '';
  addSiteDropdownCompanies: Array<{ id: string; name: string; address?: string }> = [];
  addSiteDropdownOpen = false;
  addSiteLoading = false;
  addSiteActiveIndex = -1;
  private addSiteCompanyDebounce: any;
  private addSiteCompanyReqId = 0;
  // inline company edit buffers
  editingCompanyId: string | null = null;
  companyEdit: Partial<import('../../shared/services/store.service').Company> = {};
  // assign company
  companyForStudent: Record<string, string> = {};
  // password reset buffers
  facultyNewPw: Record<string, string> = {};
  siteNewPw: Record<string, string> = {};
  // assign site -> company buffer
  siteAssignCompany: Record<string, string> = {};
  // announcements
  announcement = { title: '', message: '', link: '', pinned: false };
  editingAnnouncementId: string | null = null;
  editingAnnouncement = { title: '', message: '', link: '', pinned: false };
  get announcements() { return this.store.announcements; }
  // Evidence review state
  evidenceDecision: Record<string, 'approved'|'rejected'|''> = {};
  evidenceComment: Record<string, string> = {};
  
  // APEX Forms Request Management
  apexAForms: Array<{ id: string; startDate?: string; endDate?: string; status?: string; student?: { id: string; name: string; email: string; regNo: string } }> = [];
  apexBForms: Array<{ id: string; name?: string; degreeProgram?: string; email?: string; semester?: string; contactNo?: string; preferredField?: string; agreementAccepted?: boolean; status?: string; student?: { id: string; name: string; email: string; regNo: string } }> = [];
  apexCForms: Array<{ id: string; status?: string; student?: { id: string; name: string; email: string; regNo: string } }> = [];
  loadingApexA = false;
  loadingApexB = false;
  loadingApexC = false;
  updatingApexA = false;
  updatingApexB = false;
  updatingApexC = false;
  approvingAllApexA = false;
  approvingAllApexB = false;
  approvingAllApexC = false;
  showApexBModal = false;
  showApexADetailsModal = false;
  showApexCDetailsModal = false;
  selectedApexAForm: any = null;
  selectedApexBForm: any = null;
  selectedApexCForm: any = null;
  apexBDetails = {
    studentId: '',
    companyName: '',
    internshipRole: '',
    facultySupervisorNameDesig: '',
    siteSupervisorNameDesig: '',
    facultyId: '',
    siteId: '',
    durationWeeks: 0,
    startDate: '',
    endDate: ''
  };
  // Pagination for APEX forms
  apexAPage = 1;
  apexBPage = 1;
  apexCPage = 1;
  apexAPageSize = 10;
  apexBPageSize = 10;
  apexCPageSize = 10;
  // Filters for APEX forms
  apexAFilter = 'all' as 'all' | 'pending' | 'approved' | 'rejected';
  apexBFilter = 'all' as 'all' | 'pending' | 'approved' | 'rejected';
  apexCFilter = 'all' as 'all' | 'pending' | 'approved' | 'rejected';
  apexASearch = '';
  apexBSearch = '';
  apexCSearch = '';
  // Selected items for bulk actions
  selectedApexAIds = new Set<string>();
  selectedApexBIds = new Set<string>();
  selectedApexCIds = new Set<string>();

  // APEX B Faculty and Site Supervisor Search
  facultySearchResults: Array<{ id: string; name: string; email?: string; companyName?: string; companyEmail?: string }> = [];
  siteSearchResults: Array<{ id: string; name: string; email?: string; companyName?: string; companyEmail?: string }> = [];
  facultySearchQuery = '';
  siteSearchQuery = '';
  facultySearchLoading = false;
  siteSearchLoading = false;
  facultySearchDebounce: any;
  siteSearchDebounce: any;
  showFacultyDropdown = false;
  showSiteDropdown = false;

  latestEvidence(id: string) { const list = this.store.freelance()[id] ?? []; return list.length ? list[list.length - 1] : null; }
  reviewEvidence(id: string) {
    const rec = this.latestEvidence(id);
    if (!rec) return;
    const decision = this.evidenceDecision[rec.id];
    if (!decision) return;
    const comment = (this.evidenceComment[rec.id] ?? '').trim() || undefined;
    this.store.reviewFreelance(id, rec.id, decision, comment);
    delete this.evidenceDecision[rec.id];
    delete this.evidenceComment[rec.id];
    this.toast.success(`Evidence ${decision}`);
  }
  async refreshCompanies() {
    try {
      const list = await this.adminApi.getCompanies();
      // Normalize to UI company shape; keep remoteId for edit mapping
      this.companiesCache = list.map(x => ({
        id: x.id, name: x.name, address: x.address, email: x.email, website: x.website, description: x.description, industry: x.industry, phone: x.phone, remoteId: x.id
      }));
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load companies from server';
      this.toast.danger(msg);
    }
  }

  onSiteCompanyInput(value: string) {
    const q = (value || '').trim();
    if (this.companySearchDebounceId) clearTimeout(this.companySearchDebounceId);
    this.companySearchDebounceId = setTimeout(async () => {
      try {
        this.dropdownCompanies = await this.adminApi.getDropdownCompanies(q);
      } catch {
        this.dropdownCompanies = [];
      }
    }, 250);
  }

  // New: per-row search like student UI (name-only, 2+ chars, no request button)
  onSiteRowCompanyInput(rowId: string, value: string) {
    const q = (value || '').trim();
    this.siteCompanySearchQuery[rowId] = q;
    if (this.siteCompanyDebounce[rowId]) clearTimeout(this.siteCompanyDebounce[rowId]);
    this.siteCompanyDebounce[rowId] = setTimeout(async () => {
      try {
        if (!q || q.length < 2) {
          this.siteDropdownCompanies[rowId] = [];
          this.siteDropdownOpen[rowId] = false;
          this.siteLoading[rowId] = false;
          this.siteActiveIndex[rowId] = -1;
          return;
        }
        this.siteLoading[rowId] = true;
        this.siteDropdownOpen[rowId] = true;
        this.siteDropdownCompanies[rowId] = [];
        this.siteActiveIndex[rowId] = -1;
        const reqId = (this.siteCompanyReqId[rowId] ?? 0) + 1;
        this.siteCompanyReqId[rowId] = reqId;
        const results = await this.adminApi.getDropdownCompanies(q);
        // Ignore stale responses
        if (this.siteCompanyReqId[rowId] !== reqId) return;
        const lower = q.toLowerCase();
        const filtered = (results || []).filter(c => ((c.name || '').toLowerCase()).includes(lower));
        this.siteDropdownCompanies[rowId] = filtered.sort((a, b) => {
          const an = (a.name || '').toLowerCase();
          const bn = (b.name || '').toLowerCase();
          const aStarts = an.startsWith(lower) ? 0 : 1;
          const bStarts = bn.startsWith(lower) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return an.indexOf(lower) - bn.indexOf(lower);
        }).slice(0, 10).map(x => ({ id: x.id, name: x.name, address: (x as any).address }));
        this.siteActiveIndex[rowId] = (this.siteDropdownCompanies[rowId] || []).length ? 0 : -1;
      } catch {
        this.siteDropdownCompanies[rowId] = [];
        this.siteActiveIndex[rowId] = -1;
      } finally {
        this.siteLoading[rowId] = false;
      }
    }, 150);
  }

  // Add Site: standalone typeahead (name-only, 2+ chars, no request)
  onAddSiteCompanyInput(value: string) {
    const q = (value || '').trim();
    this.addSiteCompanySearchQuery = q;
    // Do not mutate site.companyId until a selection is made
    if (this.addSiteCompanyDebounce) clearTimeout(this.addSiteCompanyDebounce);
    this.addSiteCompanyDebounce = setTimeout(async () => {
      try {
        if (!q || q.length < 2) {
          this.addSiteDropdownCompanies = [];
          this.addSiteDropdownOpen = false;
          this.addSiteLoading = false;
          this.addSiteActiveIndex = -1;
          return;
        }
        this.addSiteLoading = true;
        this.addSiteDropdownOpen = true;
        this.addSiteDropdownCompanies = [];
        this.addSiteActiveIndex = -1;
        const reqId = ++this.addSiteCompanyReqId;
        const results = await this.adminApi.getDropdownCompanies(q);
        if (this.addSiteCompanyReqId !== reqId) return; // stale
        const lower = q.toLowerCase();
        const filtered = (results || []).filter(c => ((c.name || '').toLowerCase()).includes(lower));
        this.addSiteDropdownCompanies = filtered.sort((a, b) => {
          const an = (a.name || '').toLowerCase();
          const bn = (b.name || '').toLowerCase();
          const aStarts = an.startsWith(lower) ? 0 : 1;
          const bStarts = bn.startsWith(lower) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return an.indexOf(lower) - bn.indexOf(lower);
        }).slice(0, 10).map(x => ({ id: x.id, name: x.name, address: (x as any).address }));
        this.addSiteActiveIndex = this.addSiteDropdownCompanies.length ? 0 : -1;
      } catch {
        this.addSiteDropdownCompanies = [];
        this.addSiteActiveIndex = -1;
      } finally {
        this.addSiteLoading = false;
      }
    }, 150);
  }

  selectAddSiteCompany(c: { id: string; name: string }) {
    this.site.companyId = c.id;
    this.addSiteCompanySearchQuery = c.name;
    this.addSiteDropdownOpen = false;
    this.addSiteActiveIndex = -1;
  }

  onAddSiteCompanyKeydown(ev: KeyboardEvent) {
    const key = ev.key;
    if (key === 'ArrowDown' && this.addSiteDropdownOpen) {
      ev.preventDefault();
      const len = this.addSiteDropdownCompanies.length;
      if (len) this.addSiteActiveIndex = ((this.addSiteActiveIndex ?? -1) + 1) % len;
    } else if (key === 'ArrowUp' && this.addSiteDropdownOpen) {
      ev.preventDefault();
      const len = this.addSiteDropdownCompanies.length;
      if (len) this.addSiteActiveIndex = ((this.addSiteActiveIndex ?? 0) - 1 + len) % len;
    } else if (key === 'Enter') {
      const list = this.addSiteDropdownCompanies || [];
      const q = (this.addSiteCompanySearchQuery || '').trim().toLowerCase();
      if (this.addSiteDropdownOpen && this.addSiteActiveIndex != null && this.addSiteActiveIndex >= 0 && this.addSiteActiveIndex < list.length) {
        ev.preventDefault();
        this.selectAddSiteCompany(list[this.addSiteActiveIndex]);
      } else if (list.length === 1) {
        ev.preventDefault(); this.selectAddSiteCompany(list[0]);
      } else {
        const exact = list.find(c => (c.name || '').toLowerCase() === q);
        if (exact) { ev.preventDefault(); this.selectAddSiteCompany(exact); }
      }
    } else if (key === 'Escape' && this.addSiteDropdownOpen) {
      ev.preventDefault();
      this.addSiteDropdownOpen = false;
      this.addSiteActiveIndex = -1;
    }
  }

  onAddSiteCompanyFocus() {
    const q = (this.addSiteCompanySearchQuery || '').trim();
    this.addSiteDropdownOpen = q.length >= 2 && (this.addSiteDropdownCompanies.length > 0 || !!this.addSiteLoading);
  }
  onAddSiteCompanyBlur() {
    setTimeout(() => { this.addSiteDropdownOpen = false; this.addSiteActiveIndex = -1; }, 150);
  }

  selectSiteCompany(rowId: string, c: { id: string; name: string; address?: string }) {
    // Set selection buffer used by Assign action and reflect name into the input
    this.siteAssignCompany[rowId] = c.id;
    this.siteCompanySearchQuery[rowId] = c.name;
    this.siteDropdownOpen[rowId] = false;
    this.siteActiveIndex[rowId] = -1;
  }

  onSiteCompanyKeydown(rowId: string, ev: KeyboardEvent) {
    const key = ev.key;
    if (key === 'ArrowDown' && this.siteDropdownOpen[rowId]) {
      ev.preventDefault();
      const len = (this.siteDropdownCompanies[rowId] || []).length;
      if (len) this.siteActiveIndex[rowId] = ((this.siteActiveIndex[rowId] ?? -1) + 1) % len;
    } else if (key === 'ArrowUp' && this.siteDropdownOpen[rowId]) {
      ev.preventDefault();
      const len = (this.siteDropdownCompanies[rowId] || []).length;
      if (len) this.siteActiveIndex[rowId] = ((this.siteActiveIndex[rowId] ?? 0) - 1 + len) % len;
    } else if (key === 'Enter') {
      const list = this.siteDropdownCompanies[rowId] || [];
      const q = (this.siteCompanySearchQuery[rowId] || '').trim().toLowerCase();
      if (this.siteDropdownOpen[rowId] && this.siteActiveIndex[rowId] != null && this.siteActiveIndex[rowId] >= 0 && this.siteActiveIndex[rowId] < list.length) {
        ev.preventDefault();
        this.selectSiteCompany(rowId, list[this.siteActiveIndex[rowId]]);
      } else if (list.length === 1) {
        ev.preventDefault(); this.selectSiteCompany(rowId, list[0]);
      } else {
        const exact = list.find(c => (c.name || '').toLowerCase() === q);
        if (exact) { ev.preventDefault(); this.selectSiteCompany(rowId, exact); }
        // No request-to-add here; just keep "No results" if empty
      }
    } else if (key === 'Escape' && this.siteDropdownOpen[rowId]) {
      ev.preventDefault();
      this.siteDropdownOpen[rowId] = false;
      this.siteActiveIndex[rowId] = -1;
    }
  }

  onSiteCompanyFocus(rowId: string) {
    const q = (this.siteCompanySearchQuery[rowId] || '').trim();
    this.siteDropdownOpen[rowId] = q.length >= 2 && ((this.siteDropdownCompanies[rowId]?.length || 0) > 0 || !!this.siteLoading[rowId]);
  }
  onSiteCompanyBlur(rowId: string) {
    setTimeout(() => { this.siteDropdownOpen[rowId] = false; this.siteActiveIndex[rowId] = -1; }, 150);
  }
  highlightName(name: string, query?: string): string {
    const q = (query || '').toLowerCase();
    const n = (name || '').toString();
    if (!q) return n;
    const idx = n.toLowerCase().indexOf(q);
    if (idx === -1) return n;
    const before = n.slice(0, idx);
    const match = n.slice(idx, idx + q.length);
    const after = n.slice(idx + q.length);
    return `${before}<mark>${match}</mark>${after}`;
  }

  async refreshSites() {
    try {
      // Only pass unassigned=true when explicitly filtering for unassigned. Many backends ignore false.
      const unassignedParam = this.assignmentFilter === 'UNASSIGNED' ? true : undefined;
      const list = await this.adminApi.getAssignableSiteSupervisors({ companyId: this.filter.siteCompanyId || undefined, unassigned: unassignedParam });
      // Derive ASSIGNED/UNASSIGNED locally to ensure correctness regardless of backend behavior
      let filtered = list;
      if (this.assignmentFilter === 'ASSIGNED') {
        filtered = list.filter(x => !!x.companyId);
      } else if (this.assignmentFilter === 'UNASSIGNED') {
        filtered = list.filter(x => !x.companyId);
      }
      this.sitesCache = filtered;
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load site supervisors from server';
      this.toast.danger(msg);
    }
  }

  async assignSiteToCompany(siteSupervisorId: string) {
    const companyId = (this.siteAssignCompany[siteSupervisorId] || '').trim();
    if (!siteSupervisorId || !companyId) { this.toast.warning('Select a company to assign'); return; }
    try {
      await this.adminApi.assignSiteSupervisorToCompany({ siteSupervisorId, companyId });
      this.toast.success('Site supervisor assigned');
      delete this.siteAssignCompany[siteSupervisorId];
      await this.refreshSites();
    } catch (err: any) {
      const status = err?.status ?? 0;
      const msg = err?.error?.message || err?.error?.error ||
        (status === 401 ? 'Unauthorized: login again as ADMIN' : (status === 403 ? 'Forbidden: Admin access required' : err?.message || 'Failed to assign'));
      this.toast.danger(msg);
    }
  }

  async loadReviewCompany() {
    const key = this.makeReviewKey(this.reviewCompanyFilter);
    let cached = this.reviewCompanyCache.get(key);
    // If no in-memory cache and this is the default view, try session storage for instant show
    if (!cached && this.isDefaultReviewFilter()) {
      const stored = this.getDefaultReviewFromSession();
      if (stored) {
        cached = { items: stored.items, total: stored.total, at: stored.at };
        // prime memory cache so subsequent opens are instant
        this.reviewCompanyCache.set(key, cached);
      }
    }
    if (cached) {
      // Always show cached immediately (stale-while-revalidate)
      this.reviewCompany.items = cached.items;
      this.reviewCompany.total = cached.total;
      this.backgroundFetchReviewCompany(key);
      return;
    }
    // No cache: show loading and fetch
    this.reviewCompanyLoading = true;
    const reqId = ++this.reviewCompanyReqId;
    try {
      const res = await this.fetchReviewCompany(key, this.reviewCompanyFilter);
      if (this.reviewCompanyReqId !== reqId) return; // ignore stale
      this.reviewCompany.items = res.items;
      this.reviewCompany.total = res.total || res.items.length;
      this.setReviewCache(key, { items: this.reviewCompany.items, total: this.reviewCompany.total, at: Date.now() });
      // Prefetch next page if likely
      if ((res.items?.length || 0) >= this.reviewCompanyFilter.limit) this.prefetchNextReviewCompanyPage();
    } catch (err: any) {
      if (this.reviewCompanyReqId !== reqId) return;
      const msg = err?.error?.message || err?.message || 'Failed to load company review requests';
      this.toast.danger(msg);
    } finally {
      if (this.reviewCompanyReqId === reqId) this.reviewCompanyLoading = false;
    }
  }

  private async backgroundFetchReviewCompany(expectedKey: string) {
    const reqId = ++this.reviewCompanyReqId;
    try {
      const res = await this.fetchReviewCompany(expectedKey, this.reviewCompanyFilter);
      const currentKey = this.makeReviewKey(this.reviewCompanyFilter);
      if (this.reviewCompanyReqId !== reqId || currentKey !== expectedKey) return;
      this.reviewCompany.items = res.items;
      this.reviewCompany.total = res.total || res.items.length;
      this.setReviewCache(currentKey, { items: this.reviewCompany.items, total: this.reviewCompany.total, at: Date.now() });
      if ((res.items?.length || 0) >= this.reviewCompanyFilter.limit) this.prefetchNextReviewCompanyPage();
    } catch {
      // Silent background failure
    }
  }

  private prefetchNextReviewCompanyPage() {
    const f = { ...this.reviewCompanyFilter, page: this.reviewCompanyFilter.page + 1 };
    const key = this.makeReviewKey(f);
    if (this.reviewCompanyCache.has(key)) return;
    // fire-and-forget
    this.fetchReviewCompany(key, f)
      .then(res => {
        this.setReviewCache(key, { items: res.items || [], total: res.total || (res.items || []).length, at: Date.now() });
      })
      .catch(() => {});
  }

  private makeReviewKey(f: { status: 'PENDING'|'APPROVED'|'REJECTED'; page: number; limit: number; search: string }): string {
    return `${f.status}|${f.page}|${f.limit}|${(f.search || '').trim().toLowerCase()}`;
  }
  private setReviewCache(key: string, value: { items: Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>; total: number; at: number }) {
    if (this.reviewCompanyCache.has(key)) this.reviewCompanyCache.delete(key);
    this.reviewCompanyCache.set(key, value);
    // LRU limit 50
    while (this.reviewCompanyCache.size > 50) {
      const firstKey = this.reviewCompanyCache.keys().next().value as string | undefined;
      if (!firstKey) break;
      this.reviewCompanyCache.delete(firstKey);
    }
    // Persist default Pending page-1 view for instant tab opens within session
    if (this.isDefaultReviewFilterByKey(key)) {
      try { sessionStorage.setItem('admin:reviewCompany:default', JSON.stringify(value)); } catch {}
    }
  }

  onReviewCompanySearchChange(value: string) {
    this.reviewCompanyFilter.search = value;
    this.reviewCompanyFilter.page = 1;
    if (this.reviewCompanySearchDebounce) clearTimeout(this.reviewCompanySearchDebounce);
    this.reviewCompanySearchDebounce = setTimeout(() => this.loadReviewCompany(), 200);
  }

  private isDefaultReviewFilter(): boolean {
    return this.reviewCompanyFilter.status === 'PENDING' && this.reviewCompanyFilter.page === 1 && !((this.reviewCompanyFilter.search || '').trim());
  }
  private isDefaultReviewFilterByKey(key: string): boolean {
    const parts = key.split('|');
    const status = parts[0];
    const page = Number(parts[1] || '1');
    const limit = Number(parts[2] || '10');
    const search = parts.slice(3).join('|');
    return status === 'PENDING' && page === 1 && !search && limit === this.reviewCompanyFilter.limit;
  }
  private getDefaultReviewFromSession(): { items: Array<{ id: string; companyName?: string; email?: string; studentId?: string; registrationNo?: string; status?: string; createdAt?: string }>; total: number; at: number } | undefined {
    try {
      const raw = sessionStorage.getItem('admin:reviewCompany:default');
      if (!raw) return undefined;
      const v = JSON.parse(raw);
      if (!v || !Array.isArray(v.items)) return undefined;
      return { items: v.items, total: Number(v.total) || (v.items?.length || 0), at: Number(v.at) || Date.now() };
    } catch { return undefined; }
  }
  private async fetchReviewCompany(key: string, f: { status: 'PENDING'|'APPROVED'|'REJECTED'; page: number; limit: number; search: string }) {
    if (this.reviewInFlight.has(key)) return this.reviewInFlight.get(key)!;
    const p = this.adminApi.getCompanyReviewRequests({ page: f.page, limit: f.limit, status: f.status, search: (f.search || '').trim() || undefined })
      .finally(() => { this.reviewInFlight.delete(key); }) as unknown as Promise<{ items: any[]; total: number }>;
    this.reviewInFlight.set(key, p);
    return p;
  }
  async applyReviewCompanyDecision(requestId: string, decision: 'APPROVED'|'REJECTED') {
    // Optimistic UI update for speed
    const currentKey = this.makeReviewKey(this.reviewCompanyFilter);
    const beforeIdx = this.reviewCompany.items.findIndex(x => x.id === requestId);
    const before = beforeIdx >= 0 ? { ...this.reviewCompany.items[beforeIdx] } : null;
    let reverted = false;
    if (before) {
      // If current filter is not the target status, remove it immediately; else set status locally
      if (this.reviewCompanyFilter.status !== decision) {
        this.reviewCompany.items = this.reviewCompany.items.filter(x => x.id !== requestId);
        if (this.reviewCompany.total > 0) this.reviewCompany.total -= 1;
      } else {
        this.reviewCompany.items[beforeIdx] = { ...before, status: decision };
      }
      const cached = this.reviewCompanyCache.get(currentKey);
      if (cached) {
        const items = [...cached.items];
        const idx = items.findIndex(x => x.id === requestId);
        if (idx >= 0) {
          if (this.reviewCompanyFilter.status !== decision) {
            items.splice(idx, 1);
            this.setReviewCache(currentKey, { items, total: Math.max(0, cached.total - 1), at: cached.at });
          } else {
            items[idx] = { ...items[idx], status: decision } as any;
            this.setReviewCache(currentKey, { items, total: cached.total, at: cached.at });
          }
        }
      }
    }
    try {
      await this.adminApi.reviewCompanyRequest({ requestId, decision });
      this.toast.success(`Request ${decision === 'APPROVED' ? 'approved' : 'rejected'}`);
      // Background refresh current list to reconcile
      this.backgroundFetchReviewCompany(currentKey);
      if (decision === 'APPROVED') await this.refreshCompanies();
    } catch (err: any) {
      // Revert optimistic change
      if (before && !reverted) {
        reverted = true;
        // Put it back depending on current filter
        if (this.reviewCompanyFilter.status !== decision) {
          this.reviewCompany.items = [before, ...this.reviewCompany.items];
          this.reviewCompany.total += 1;
        } else if (beforeIdx >= 0) {
          this.reviewCompany.items[beforeIdx] = before;
        }
        const cached = this.reviewCompanyCache.get(currentKey);
        if (cached) {
          const items = [...cached.items];
          const idx = items.findIndex(x => x.id === requestId);
          if (this.reviewCompanyFilter.status !== decision) {
            items.unshift(before);
            this.setReviewCache(currentKey, { items, total: cached.total + 1, at: cached.at });
          } else if (idx >= 0) {
            items[idx] = before;
            this.setReviewCache(currentKey, { items, total: cached.total, at: cached.at });
          }
        }
      }
      const msg = err?.error?.message || err?.message || 'Failed to apply decision';
      this.toast.danger(msg);
    }
  }

  private uniDomain = '@cuisahiwal.edu.pk';
  private allEmails(): string[] {
    const set = new Set<string>();
    try {
      (this.students() || []).forEach(s => s.email && set.add(s.email.toLowerCase()));
      (this.facultyList() || []).forEach(f => f.email && set.add(f.email.toLowerCase()));
      (this.siteList() || []).forEach(s => s.email && set.add(s.email.toLowerCase()));
      (this.officers() || []).forEach(o => o.email && set.add(o.email.toLowerCase()));
    } catch {}
    return Array.from(set);
  }
  private isUniEmailRequired(role: 'ADMIN'|'FACULTY'|'SITE'): boolean { return role === 'ADMIN' || role === 'FACULTY'; }
  private isEmailAllowedForRole(email: string, role: 'ADMIN'|'FACULTY'|'SITE'): boolean {
    if (!this.isUniEmailRequired(role)) return true;
    return (email || '').toLowerCase().endsWith(this.uniDomain);
  }
  private makeBaseLocalPart(name: string): string {
  // Remove all spaces for email local part, replace with nothing
  const base = (name || '').toLowerCase().replace(/[^a-z0-9.]+/g, '').replace(/\s+/g, '');
  return base || 'user';
  }
  private suggestEmail(name: string, domain: string, taken: Set<string>): string {
    const base = this.makeBaseLocalPart(name);
    let candidate = `${base}${domain}`;
    if (!taken.has(candidate)) return candidate;
    for (let i = 1; i <= 99; i++) {
      candidate = `${base}${i}${domain}`;
      if (!taken.has(candidate)) return candidate;
    }
    // Fallback random
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    return `${base}${rnd}${domain}`;
  }
  private suggestEmailOptions(name: string, domain: string, taken: Set<string>, count = 4, exclude?: string): string[] {
    const base = this.makeBaseLocalPart(name);
    const opts: string[] = [];
    const push = (v: string) => {
      const lower = (v || '').toLowerCase();
      if (!taken.has(lower) && (!exclude || lower !== exclude.toLowerCase()) && !opts.includes(v)) opts.push(v);
    };
    push(`${base}${domain}`);
    for (let i = 1; opts.length < count && i < 200; i++) push(`${base}${i}${domain}`);
    while (opts.length < count) {
      const rnd = Math.floor(Math.random() * 9000) + 1000;
      push(`${base}${rnd}${domain}`);
    }
    return opts;
  }
  private ensureDomain(email: string, domain: string): string {
    const e = (email || '').trim();
    if (!e) return e;
    return e.includes('@') ? e : `${e}${domain}`;
  }
  private emailExists(email: string): boolean {
    const lower = (email || '').toLowerCase();
    return this.allEmails().includes(lower);
  }
  private normalizedForCheck(email: string): string {
    // For existence check, if no '@', assume uni domain but do not change the input field
    const e = (email || '').trim();
    return e.includes('@') ? e : `${e}${this.uniDomain}`;
  }

  approve(id: string) { this.store.approveStudent(id); this.toast.success('Student approved'); }
  viewDetails(id: string) { this.selectedId = id; }
  assign(id: string) {
    if (!this.facultyId || !this.siteId) return;
    this.store.assignSupervisors(id, this.facultyId, this.siteId);
    this.facultyId = this.siteId = '';
    this.toast.success('Faculty and Site assigned');
  }
  setAdminMarks(id: string, value: number) { this.store.setAdminMarks(id, value); }
  setAdminSubMarks(id: string, p: number, l: number, f: number) { this.store.setAdminSubMarks(id, p, l, f); }
  addOfficer() {
    if (!this.officer.name || !this.officer.email) return;
    this.store.addInternshipOfficer(this.officer.name, this.officer.email);
    this.officer = { name: '', email: '' };
    this.toast.success('Internship Officer added');
  }
  startEditOfficer(id: string) {
    const o = this.officers().find(x => x.id === id);
    if (!o) return;
    this.editingOfficerId = id;
    this.officerEdit = { name: o.name, email: o.email };
  }
  cancelEditOfficer() {
    this.editingOfficerId = null;
    this.officerEdit = {};
  }
  saveOfficerEdit() {
    if (!this.editingOfficerId) return;
    const current = this.officers().find(x => x.id === this.editingOfficerId);
    if (!current) { this.cancelEditOfficer(); return; }
    const name = (this.officerEdit.name || '').trim();
    const email = (this.officerEdit.email || '').trim();
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    // Enforce domain for officers (ADMIN policy)
    if (!this.isEmailAllowedForRole(email, 'ADMIN')) {
      this.toast.warning(`Officer email must end with ${this.uniDomain}`);
      return;
    }
    // Duplicate check excluding current officer's existing email
    const lower = email.toLowerCase();
    const taken = new Set(this.allEmails());
    taken.delete((current.email || '').toLowerCase());
    if (taken.has(lower)) { this.toast.warning('Email already exists. Try a different one.'); return; }
    this.store.updateInternshipOfficer(this.editingOfficerId, { name, email });
    this.cancelEditOfficer();
    this.toast.success('Officer updated');
  }
  removeOfficer(id: string) {
    if (!confirm('Remove this internship officer?')) return;
    this.store.removeInternshipOfficer(id);
    if (this.editingOfficerId === id) this.cancelEditOfficer();
    this.toast.warning('Officer removed');
  }
  onOfficerNameBlur() {
    const name = (this.officer.name || '').trim();
    const email = (this.officer.email || '').trim();
    if (!email && name) {
      const taken = new Set(this.allEmails());
      this.officer.email = this.suggestEmail(name, this.uniDomain, taken);
    }
  }
  adminOfficerEmailSuggestions: string[] = [];
  adminOfficerSuggestIndex = -1;
  async createAdminAccount() {
    const name = (this.adminAccount.name || '').trim();
    const email = (this.adminAccount.email || '').trim();
    const password = (this.adminAccount.password || '').trim();
    if (!name || !email || !password) { this.toast.warning('Name, email and password are required'); return; }
    // Validate domain for ADMIN
    if (!this.isEmailAllowedForRole(email, 'ADMIN')) {
      const taken = new Set(this.allEmails());
      const suggestion = this.suggestEmail(name, this.uniDomain, taken);
      this.toast.warning(`Officer email must end with ${this.uniDomain}. Suggestion: ${suggestion}`);
      return;
    }
    // Duplicate email
    if (this.allEmails().includes(email.toLowerCase())) {
      const taken = new Set(this.allEmails());
      this.adminOfficerEmailSuggestions = this.suggestEmailOptions(name, this.uniDomain, taken, 4, email);
      this.adminOfficerSuggestIndex = this.adminOfficerEmailSuggestions.length ? 0 : -1;
      this.toast.warning('Email already exists. Choose a suggestion below or edit the email.');
      return;
    }
    const payload: CreateAccountRequest = { name, email, password, role: 'ADMIN' } as any;
    try {
      this.creatingAdmin = true;
  const res = await this.adminApi.createAccount(payload);
  this.toast.success(res?.message || 'Internship Officer added');
      // reflect in local list
      this.store.addInternshipOfficer(name, email);
      this.adminAccount = { name: '', email: '', password: '' };
  } catch (err: any) {
      const status = err?.status ?? 0;
      const networkMsg = status === 0 ? 'Network/CORS error while contacting API. Retrying via proxy failed.' : null;
  const unauthorized = status === 401 ? 'Unauthorized: Your session may be expired or your account lacks ADMIN permission. Try re‑logging in to refresh tokens, then retry. If it persists, verify your role on the backend.' : null;
  const backendDetail = err?.error?.details || err?.error?.error || err?.error?.reason;
  const msg = unauthorized || networkMsg || backendDetail || err?.error?.message || err?.message || 'Failed to add Internship Officer';
      this.toast.danger(msg);
    } finally { this.creatingAdmin = false; }
  }
  onAdminOfficerNameBlur() {
    const name = (this.adminAccount.name || '').trim();
    const email = (this.adminAccount.email || '').trim();
    if (!email && name) {
      const taken = new Set(this.allEmails());
      // Prefill a reasonable email if left empty, but do not show suggestion list here
      this.adminAccount.email = this.suggestEmail(name, this.uniDomain, taken);
    }
    // Only show suggestions when a duplicate is detected (handled in email blur or submit)
    this.adminOfficerEmailSuggestions = [];
  }
  onAdminOfficerEmailBlur() {
    const e = this.ensureDomain(this.adminAccount.email, this.uniDomain);
    this.adminAccount.email = e;
    // if collides, refresh suggestions
    const taken = new Set(this.allEmails());
    if (taken.has(e.toLowerCase())) {
      this.adminOfficerEmailSuggestions = this.suggestEmailOptions(this.adminAccount.name, this.uniDomain, taken, 4, e);
      this.adminOfficerSuggestIndex = this.adminOfficerEmailSuggestions.length ? 0 : -1;
    } else {
      this.adminOfficerEmailSuggestions = [];
      this.adminOfficerSuggestIndex = -1;
    }
  }
  private adminOfficerEmailDebounceId: any;
  onAdminOfficerEmailInput() {
    if (this.adminOfficerEmailDebounceId) clearTimeout(this.adminOfficerEmailDebounceId);
    this.adminOfficerEmailDebounceId = setTimeout(() => {
      const candidate = this.normalizedForCheck(this.adminAccount.email);
      if (!candidate) { this.adminOfficerEmailSuggestions = []; this.adminOfficerSuggestIndex = -1; return; }
      if (this.emailExists(candidate)) {
        const taken = new Set(this.allEmails());
        this.adminOfficerEmailSuggestions = this.suggestEmailOptions(this.adminAccount.name, this.uniDomain, taken, 4, candidate);
        this.adminOfficerSuggestIndex = this.adminOfficerEmailSuggestions.length ? 0 : -1;
      } else {
        this.adminOfficerEmailSuggestions = [];
        this.adminOfficerSuggestIndex = -1;
      }
    }, 250);
  }
  async addFaculty() {
    if (this.addingFaculty) return; // Prevent duplicate submissions
    
    const name = this.faculty.name?.trim() || '';
    const email = this.faculty.email?.trim() || '';
    const dept = this.faculty.department?.trim() || '';
    const pass = this.faculty.password?.trim() || '';
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    if (!pass) { this.toast.warning('Set a temporary password for the faculty supervisor'); return; }
    if (!this.isEmailAllowedForRole(email, 'FACULTY')) {
      const taken = new Set(this.allEmails());
      const suggestion = this.suggestEmail(name, this.uniDomain, taken);
      this.toast.warning(`Faculty email must end with ${this.uniDomain}. Suggestion: ${suggestion}`);
      return;
    }
    if (this.allEmails().includes(email.toLowerCase())) {
      const taken = new Set(this.allEmails());
      this.facultyEmailSuggestions = this.suggestEmailOptions(name, this.uniDomain, taken, 4, email);
      this.facultySuggestIndex = this.facultyEmailSuggestions.length ? 0 : -1;
      this.toast.warning('Email already exists. Choose a suggestion below or edit the email.');
      return;
    }
    
    this.addingFaculty = true;
    try {
      await this.adminApi.createAccount({ name, email, password: pass, role: 'FACULTY' } as any);
      this.store.addFacultySupervisor(name, email, dept, pass);
      this.faculty = { name: '', email: '', department: '', password: '' };
      this.toast.success('Faculty Supervisor added');
      this.cdr.markForCheck();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to add faculty supervisor';
      this.toast.danger(msg);
    } finally {
      this.addingFaculty = false;
      this.cdr.markForCheck();
    }
  }
  onFacultyNameBlur() {
    const name = (this.faculty.name || '').trim();
    const email = (this.faculty.email || '').trim();
    if (!email && name) {
      const taken = new Set(this.allEmails());
      this.faculty.email = this.suggestEmail(name, this.uniDomain, taken);
    }
    // Do not show suggestions here; only when a duplicate is detected
    this.facultyEmailSuggestions = [];
  }
  onFacultyEmailBlur() {
    const e = this.ensureDomain(this.faculty.email, this.uniDomain);
    this.faculty.email = e;
    const taken = new Set(this.allEmails());
    if (taken.has(e.toLowerCase())) {
      this.facultyEmailSuggestions = this.suggestEmailOptions(this.faculty.name, this.uniDomain, taken, 4, e);
      this.facultySuggestIndex = this.facultyEmailSuggestions.length ? 0 : -1;
    } else {
      this.facultyEmailSuggestions = [];
      this.facultySuggestIndex = -1;
    }
  }
  private facultyEmailDebounceId: any;
  onFacultyEmailInput() {
    if (this.facultyEmailDebounceId) clearTimeout(this.facultyEmailDebounceId);
    this.facultyEmailDebounceId = setTimeout(() => {
      const candidate = this.normalizedForCheck(this.faculty.email);
      if (!candidate) { this.facultyEmailSuggestions = []; this.facultySuggestIndex = -1; return; }
      if (this.emailExists(candidate)) {
        const taken = new Set(this.allEmails());
        this.facultyEmailSuggestions = this.suggestEmailOptions(this.faculty.name, this.uniDomain, taken, 4, candidate);
        this.facultySuggestIndex = this.facultyEmailSuggestions.length ? 0 : -1;
      } else {
        this.facultyEmailSuggestions = [];
        this.facultySuggestIndex = -1;
      }
    }, 250);
  }
  facultyEmailSuggestions: string[] = [];
  facultySuggestIndex = -1;

  // Suggestion helpers (Gmail-like keyboard navigation)
  onAdminOfficerEmailKeydown(ev: KeyboardEvent) {
    if (!this.adminOfficerEmailSuggestions.length) return;
    const len = this.adminOfficerEmailSuggestions.length;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.adminOfficerSuggestIndex = (this.adminOfficerSuggestIndex + 1 + len) % len;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.adminOfficerSuggestIndex = (this.adminOfficerSuggestIndex - 1 + len) % len;
    } else if (ev.key === 'Enter') {
      if (this.adminOfficerSuggestIndex >= 0) {
        ev.preventDefault();
        this.selectAdminOfficerSuggestion(this.adminOfficerSuggestIndex);
      }
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.adminOfficerEmailSuggestions = [];
      this.adminOfficerSuggestIndex = -1;
    }
  }
  selectAdminOfficerSuggestion(i: number) {
    const s = this.adminOfficerEmailSuggestions[i];
    if (!s) return;
    this.adminAccount.email = s;
    this.adminOfficerEmailSuggestions = [];
    this.adminOfficerSuggestIndex = -1;
  }

  onFacultyEmailKeydown(ev: KeyboardEvent) {
    if (!this.facultyEmailSuggestions.length) return;
    const len = this.facultyEmailSuggestions.length;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.facultySuggestIndex = (this.facultySuggestIndex + 1 + len) % len;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.facultySuggestIndex = (this.facultySuggestIndex - 1 + len) % len;
    } else if (ev.key === 'Enter') {
      if (this.facultySuggestIndex >= 0) {
        ev.preventDefault();
        this.selectFacultySuggestion(this.facultySuggestIndex);
      }
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.facultyEmailSuggestions = [];
      this.facultySuggestIndex = -1;
    }
  }
  selectFacultySuggestion(i: number) {
    const s = this.facultyEmailSuggestions[i];
    if (!s) return;
    this.faculty.email = s;
    this.facultyEmailSuggestions = [];
    this.facultySuggestIndex = -1;
  }
  async addCompany() {
    if (this.addingCompany) return; // Prevent duplicate submissions
    
    const { name, email, phone, address, website, industry, description } = this.company;
    if (!name?.trim()) { this.toast.warning('Company name is required'); return; }
    if (!email?.trim()) { this.toast.warning('Company email is required'); return; }
    // Duplicate validation by name (case-insensitive)
  const exists = (this.companyList() || []).some(c => (c.name || '').trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) { this.toast.warning('This company is already listed'); return; }
    
    this.addingCompany = true;
    try {
    const res = await this.adminApi.addCompany({ name, email, phone, address, website, industry, description });
    // Refresh from server instead of adding locally
    await this.refreshCompanies();
    // Preselect last created if present
    if (this.site.companyId === '' && res?.id) this.site.companyId = res.id;
      this.company = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '' };
      this.toast.success(res?.message || 'Company added');
      this.cdr.markForCheck();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to add company';
      this.toast.danger(msg);
    } finally {
      this.addingCompany = false;
      this.cdr.markForCheck();
    }
  }
  startEditCompany(id: string) {
    const c = this.companyList().find(x => x.id === id);
    if (!c) return;
    this.editingCompanyId = id;
    this.companyEdit = { ...c };
  }
  cancelEditCompany() {
    this.editingCompanyId = null;
    this.companyEdit = {};
  }
  async saveCompanyEdit() {
    if (!this.editingCompanyId) return;
  const local = this.companyList().find(x => x.id === this.editingCompanyId);
    if (!local) { this.cancelEditCompany(); return; }
    const changes = this.companyEdit;
    const name = (changes.name || local.name || '').trim();
    if (!name) { this.toast.warning('Company name is required'); return; }
    try {
      // Update on backend, then refresh list
      await this.adminApi.updateCompany({ id: (local as any).remoteId || local.id, name, email: changes.email, phone: changes.phone, address: changes.address, website: changes.website, industry: changes.industry, description: changes.description });
      await this.refreshCompanies();
    } catch {}
    this.cancelEditCompany();
    this.toast.success('Company updated');
  }
  async addSite() {
    if (this.siteLoading['add']) return; // Prevent duplicate submissions
    
    const name = this.site.name?.trim() || '';
    const email = this.site.email?.trim() || '';
    const cid = this.site.companyId?.trim() || '';
    const pass = this.site.password?.trim() || '';
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    if (!cid) { this.toast.warning('Select a company for the site supervisor'); return; }
    const emailOk = /^(?=.{3,100}@)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
    if (!emailOk) { this.toast.warning('Enter a valid email address'); return; }
    if (!pass) { this.toast.warning('Set a temporary password for the site supervisor'); return; }
    // No domain restriction for site; still check duplicates
    if (this.allEmails().includes(email.toLowerCase())) { this.toast.warning('Email already exists. Try a different one.'); return; }
    
    this.siteLoading['add'] = true;
    try {
      await this.adminApi.createAccount({ name, email, password: pass, role: 'SITE_SUPERVISOR' } as any);
      this.store.addSiteSupervisor(name, email, cid || undefined, pass);
      this.site = { name: '', email: '', companyId: '', password: '' };
      this.toast.success('Site Supervisor added');
      this.cdr.markForCheck();
    } catch (err: any) {
      const status = err?.status ?? 0;
      const unauthorized = status === 401 ? 'Unauthorized (401): Your session may be expired. Please log in again as ADMIN and retry.' : null;
      const backendDetail = err?.error?.details || err?.error?.error || err?.error?.reason;
      const msg = unauthorized || backendDetail || err?.error?.message || err?.message || 'Failed to add site supervisor';
      this.toast.danger(msg);
    } finally {
      this.siteLoading['add'] = false;
      this.cdr.markForCheck();
    }
  }
  companyName(id?: string) {
    if (!id) return '-';
    const c = this.companyList().find(x => x.id === id);
    return c?.name ?? '-';
  }
  // Approval review state
  approvalDecision: Record<string, 'approved'|'rejected'|''> = {};
  approvalComment: Record<string, string> = {};
  latestApproval(id: string) { const list = this.store.approvals()[id] ?? []; return list.length ? list[list.length - 1] : null; }
  reviewApproval(id: string) {
    const decision = this.approvalDecision[id];
    if (!decision) return;
    const comment = (this.approvalComment[id] ?? '').trim() || undefined;
    this.store.reviewApproval(id, decision, comment);
    delete this.approvalDecision[id];
    delete this.approvalComment[id];
    this.toast.success(`Application ${decision}`);
  }
  studentName(id: string) {
    // Try to find by ID
    const s = this.students().find(x => x.id === id);
    if (s) return `${s.name} (${s.email})`;
    return id;
  }
  resolve(id: string) {
    const resp = this.responses[id];
    if (!resp) return;
    this.resolveComplaintAPI(id, resp);
  }

  async resolveComplaintAPI(id: string, resolutionNotes: string) {
    try {
      const result = await this.adminApi.updateAdminComplaint(id, { status: 'RESOLVED', resolutionNotes });
      this.toast.success('Complaint resolved successfully');
      delete this.responses[id];
      
      // Refresh complaints list
      await this.loadComplaints();
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Failed to resolve complaint';
      this.toast.danger(msg);
    }
  }

  async loadComplaints(page?: number) {
    try {
      console.log('[Admin] Loading complaints, page:', page);
      this.complaintsLoading = true;
      this.complaintsError = null;
      
      const result = await this.adminApi.getAdminComplaints({
        page: page || this.complaintsPagination.page,
        limit: this.complaintsPagination.limit,
        status: this.complaintsFilter.status || undefined,
        search: this.complaintsFilter.search || undefined
      });
      
      console.log('[Admin] Complaints loaded:', result);
      
      this.complaintsList = result.complaints || [];
      this.complaintsPagination = result.pagination || { page: 1, limit: 10, total: 0, pages: 0 };
      this.complaintsStats = result.statistics || { OPEN: 0, IN_REVIEW: 0, RESOLVED: 0, DISMISSED: 0 };
      
      console.log('[Admin] Complaints list after load:', this.complaintsList.length, 'items');
    } catch (error: any) {
      console.error('[Admin] Error loading complaints:', error);
      const msg = error?.error?.message || error?.message || 'Failed to load complaints';
      this.complaintsError = msg;
      this.toast.danger(msg);
    } finally {
      this.complaintsLoading = false;
    }
  }

  async changeComplaintPage(page: number) {
    this.complaintsPagination.page = page;
    await this.loadComplaints(page);
  }

  async changeComplaintStatus(status: string | ''|'OPEN'|'IN_REVIEW'|'RESOLVED'|'DISMISSED') {
    this.complaintsFilter.status = status as any;
    this.complaintsPagination.page = 1;
    await this.loadComplaints();
  }

  onComplaintSearchChange() {
    this.complaintsPagination.page = 1;
  }
  assignCompanyToStudent(studentId: string) {
    const cid = this.companyForStudent[studentId];
    if (!cid) return;
    this.store.assignCompany(studentId, cid);
    delete this.companyForStudent[studentId];
    this.toast.success('Company assigned to student');
  }
  removeFaculty(id: string) {
    if (confirm('Remove this faculty supervisor?')) { this.store.removeFacultySupervisor(id); this.toast.warning('Faculty Supervisor removed'); }
  }
  startEditFaculty(id: string) {
    const current = this.facultyList().find(f => f.id === id);
    if (current) {
      this.editingFacultyId = id;
      this.editingFaculty = {
        id,
        email: current.email || '',
        name: current.name || '',
        password: '',
        department: current.department || '',
        designation: current.designation || '',
        phone: current.phone || '',
        office: current.office || '',
        bio: current.bio || '',
        avatarUrl: current.avatarUrl || '',
        qualifications: current.qualifications || '',
        expertise: current.expertise || ''
      };
    }
  }
  async saveEditFaculty() {
    if (!this.editingFacultyId) return;
    try {
      const result = await this.adminApi.editFaculty({
        id: this.editingFacultyId,
        email: this.editingFaculty.email?.trim() || undefined,
        name: this.editingFaculty.name?.trim() || undefined,
        password: this.editingFaculty.password?.trim() || undefined,
        department: this.editingFaculty.department?.trim() || undefined,
        designation: this.editingFaculty.designation?.trim() || undefined,
        phone: this.editingFaculty.phone?.trim() || undefined,
        office: this.editingFaculty.office?.trim() || undefined,
        bio: this.editingFaculty.bio?.trim() || undefined,
        avatarUrl: this.editingFaculty.avatarUrl?.trim() || undefined,
        qualifications: this.editingFaculty.qualifications?.trim() || undefined,
        expertise: this.editingFaculty.expertise?.trim() || undefined
      });
      // Update local store with new data
      const updatedFaculty = result.faculty;
      if (updatedFaculty) {
        this.store.updateFacultySupervisor(this.editingFacultyId, {
          email: updatedFaculty.email || '',
          name: updatedFaculty.name || '',
          password: this.editingFaculty.password ? this.editingFaculty.password : undefined,
          department: updatedFaculty.department || '',
          designation: updatedFaculty.designation || '',
          phone: updatedFaculty.phone || '',
          office: updatedFaculty.office || '',
          bio: updatedFaculty.bio || '',
          avatarUrl: updatedFaculty.avatarUrl || '',
          qualifications: updatedFaculty.qualifications || '',
          expertise: updatedFaculty.expertise || ''
        });
      }
      this.toast.success('Faculty updated');
      this.editingFacultyId = null;
    } catch (err) {
      this.toast.danger('Failed to update faculty');
    }
  }
  cancelEditFaculty() {
    this.editingFacultyId = null;
    this.editingFaculty = { id: '', email: '', name: '', password: '', department: '', designation: '', phone: '', office: '', bio: '', avatarUrl: '', qualifications: '', expertise: '' };
  }
  setFacultyPassword(id: string) {
    const pw = (this.facultyNewPw[id] ?? '').trim();
    if (!pw) { this.toast.warning('Enter a password'); return; }
    this.store.updateFacultySupervisor(id, { password: pw });
    delete this.facultyNewPw[id];
    this.toast.success('Faculty password set');
  }
  removeSite(id: string) {
    if (confirm('Remove this site supervisor?')) { this.store.removeSiteSupervisor(id); this.toast.warning('Site Supervisor removed'); }
  }
  setSitePassword(id: string) {
    const pw = (this.siteNewPw[id] ?? '').trim();
    if (!pw) { this.toast.warning('Enter a password'); return; }
    this.store.updateSiteSupervisor(id, { password: pw });
    delete this.siteNewPw[id];
    this.toast.success('Site supervisor password set');
  }
  startEditSite(id: string) {
    const current = this.sitesCache.find(s => s.id === id);
    if (current) {
      this.editingSiteId = id;
      this.editingSite = {
        id,
        name: current.name || '',
        email: current.email || '',
        companyId: current.companyId || '',
        password: ''
      };
    }
  }
  async saveEditSite() {
    if (!this.editingSiteId) return;
    const name = this.editingSite.name?.trim();
    const email = this.editingSite.email?.trim();
    if (!name || !email) {
      this.toast.warning('Name and email are required');
      return;
    }
    try {
      const result = await this.adminApi.editSiteSupervisor({
        id: this.editingSiteId,
        name,
        email,
        companyId: this.editingSite.companyId || undefined,
        password: this.editingSite.password?.trim() || undefined
      });
      // Update local store
      const updatedSite = result.siteSupervisor;
      if (updatedSite) {
        this.store.updateSiteSupervisor(this.editingSiteId, {
          name: updatedSite.name || '',
          email: updatedSite.email || '',
          companyId: updatedSite.companyId || '',
          password: this.editingSite.password ? this.editingSite.password : undefined
        });
      }
      this.toast.success('Site supervisor updated');
      this.editingSiteId = null;
    } catch (err) {
      this.toast.danger('Failed to update site supervisor');
    }
  }
  cancelEditSite() {
    this.editingSiteId = null;
    this.editingSite = { id: '', name: '', email: '', companyId: '', password: '' };
  }
  removeCompany(id: string) {
    if (confirm('Remove this company?')) { this.store.removeCompany(id); this.toast.warning('Company removed'); }
  }
  approveRequest(id: string) { this.store.approveRequest(id); this.toast.success('Request approved'); }
  rejectRequest(id: string) {
    const note = prompt('Optional note for rejection:') || undefined;
    this.store.rejectRequest(id, note); this.toast.warning('Request rejected');
  }
  // Announcements actions
  addAnnouncement() {
    const msg = (this.announcement.message ?? '').trim();
    if (!msg) { this.toast.warning('Announcement message is required'); return; }
    this.store.addAnnouncement(msg, this.announcement.title?.trim() || undefined, this.announcement.link?.trim() || undefined, !!this.announcement.pinned);
    this.announcement = { title: '', message: '', link: '', pinned: false };
    this.toast.success('Announcement published');
  }
  togglePinned(id: string) {
    const current = this.store.announcements().find(a => a.id === id)?.pinned;
    this.store.updateAnnouncement(id, { pinned: !current });
  }
  removeAnnouncement(id: string) {
    if (confirm('Remove this announcement?')) { this.store.removeAnnouncement(id); this.toast.warning('Announcement removed'); }
  }
  startEditAnnouncement(id: string) {
    const current = this.store.announcements().find(a => a.id === id);
    if (current) {
      this.editingAnnouncementId = id;
      this.editingAnnouncement = {
        title: current.title || '',
        message: current.message || '',
        link: current.link || '',
        pinned: current.pinned || false
      };
    }
  }
  async saveEditAnnouncement() {
    if (!this.editingAnnouncementId) return;
    const msg = (this.editingAnnouncement.message ?? '').trim();
    if (!msg) { this.toast.warning('Announcement message is required'); return; }
    try {
      await this.store.updateAnnouncement(this.editingAnnouncementId, {
        title: this.editingAnnouncement.title?.trim() || undefined,
        message: msg,
        link: this.editingAnnouncement.link?.trim() || undefined,
        pinned: !!this.editingAnnouncement.pinned
      });
      this.toast.success('Announcement updated');
      this.editingAnnouncementId = null;
    } catch (err) {
      this.toast.danger('Failed to update announcement');
    }
  }
  cancelEditAnnouncement() {
    this.editingAnnouncementId = null;
    this.editingAnnouncement = { title: '', message: '', link: '', pinned: false };
  }
  facultyName(id?: string) {
    const f = this.facultyList().find(x => x.id === id);
    return f ? `${f.name} (${f.email})` : id;
  }
  siteSupervisorName(id?: string) {
    if (!id) return '-';
    const s = this.siteList().find(x => x.id === id);
    return s?.name ?? '-';
  }
  // Filtered views
  filteredFaculty() {
    const list = this.facultyList() || [];
    const q = (this.search.faculty || '').trim().toLowerCase();
    const dept = (this.filter.facultyDept || '').trim().toLowerCase();
    return list.filter(f => {
      if (q) {
        const hay = ((f.name || '') + ' ' + (f.email || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dept) {
        const d = (f.department || '').toLowerCase();
        if (!d.includes(dept)) return false;
      }
      return true;
    });
  }
  // Per-student data getters
  approvalsOf(id: string) { return this.approvals()[id] ?? []; }
  logsOf(id: string) { return this.logsMap()[id] ?? []; }
  reportsOf(id: string) { return this.reportsMap()[id] ?? []; }
  agreementsOf(id: string) { return this.agreementsMap()[id] ?? []; }
  designStatementsOf(id: string) { return this.designStatementsMap()[id] ?? []; }
  assignmentsOf(id: string) { return this.assignmentsMap()[id] ?? []; }
  freelanceOf(id: string) { return this.freelanceMap()[id] ?? []; }
  latestAgreement(id: string) { const list = this.agreementsOf(id) ?? []; return list.length ? list[list.length - 1] : null; }
  requestPrimary(r: import('../../shared/services/store.service').RequestItem) {
    if (r.type === 'company') return r.name;
    // site
    return `${r.name} (${(r as any).email})`;
  }
  requestSecondary(r: import('../../shared/services/store.service').RequestItem) {
    if (r.type === 'company') return r.address || '-';
    const rr = r as any;
    const comp = rr.companyName || this.companyName(rr.companyId);
    return comp ? `Company: ${comp}` : undefined;
  }

  // Download assignment file
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

  // Weekly Log compliance helpers
  private startDate(studentId: string): Date | null {
    const list = this.approvals()[studentId] ?? [];
    if (!list.length) return null;
    const s = list[0].internship?.startDate || list[0].createdAt;
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
    }
  startDateString(studentId: string) {
    const d = this.startDate(studentId);
    return d ? d.toLocaleDateString() : '-';
  }
  expectedWeeks(studentId: string) {
    const start = this.startDate(studentId);
    if (!start) return 0;
    const now = new Date();
    const ms = now.getTime() - start.getTime();
    const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
    return Math.ceil(days / 7);
  }
  logsCount(studentId: string) {
    return (this.logsMap()[studentId] ?? []).length;
  }
  hasLogThisWeek(studentId: string) {
    const logs = this.logsMap()[studentId] ?? [];
    if (!logs.length) return false;
    const now = new Date().getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return logs.some(l => {
      const d = new Date(l.date).getTime();
      return !isNaN(d) && (now - d) <= sevenDays;
    });
  }
  // Applications filter
  showPendingOnly = false;
  showInApplications(id: string) {
    const a = this.latestApproval(id);
    if (!this.showPendingOnly) return true;
    return !!a && (a.status === 'pending' || !a.status);
  }

  // APEX Forms Management Methods
  selectFormsSubTab(subTab: 'apexA' | 'apexB' | 'apexC') {
    console.log('🔄 [Sub-Tab Switch] Switching to:', subTab);
    this.currentFormsSubTab = subTab;
    
    // Load data when switching tabs to ensure fresh data
    if (subTab === 'apexA' && this.apexAForms.length === 0) {
      this.loadApexAForms();
    } else if (subTab === 'apexB' && this.apexBForms.length === 0) {
      this.loadApexBForms();
    } else if (subTab === 'apexC' && this.apexCForms.length === 0) {
      this.loadApexCForms();
    }
    
    // Force UI update
    this.cdr.markForCheck();
  }

  // Filtering and pagination helpers
  get filteredApexAForms() {
    let filtered = this.apexAForms;
    if (this.apexAFilter !== 'all') {
      filtered = filtered.filter(f => f.status === this.apexAFilter);
    }
    if (this.apexASearch) {
      const search = this.apexASearch.toLowerCase();
      filtered = filtered.filter(f => 
        (f.student?.name || '').toLowerCase().includes(search) ||
        (f.student?.email || '').toLowerCase().includes(search) ||
        (f.student?.regNo || '').toLowerCase().includes(search)
      );
    }
    return filtered;
  }

  get filteredApexBForms() {
    let filtered = this.apexBForms;
    if (this.apexBFilter !== 'all') {
      filtered = filtered.filter(f => f.status === this.apexBFilter);
    }
    if (this.apexBSearch) {
      const search = this.apexBSearch.toLowerCase();
      filtered = filtered.filter(f => 
        (f.student?.name || f.name || '').toLowerCase().includes(search) ||
        (f.student?.email || f.email || '').toLowerCase().includes(search) ||
        (f.student?.regNo || '').toLowerCase().includes(search)
      );
    }
    return filtered;
  }

  get filteredApexCForms() {
    let filtered = this.apexCForms;
    if (this.apexCFilter !== 'all') {
      filtered = filtered.filter(f => f.status === this.apexCFilter);
    }
    if (this.apexCSearch) {
      const search = this.apexCSearch.toLowerCase();
      filtered = filtered.filter(f => 
        (f.student?.name || '').toLowerCase().includes(search) ||
        (f.student?.email || '').toLowerCase().includes(search) ||
        (f.student?.regNo || '').toLowerCase().includes(search)
      );
    }
    return filtered;
  }

  // Selection helpers
  toggleApexASelection(id: string) {
    if (this.selectedApexAIds.has(id)) {
      this.selectedApexAIds.delete(id);
    } else {
      this.selectedApexAIds.add(id);
    }
  }

  toggleApexBSelection(id: string) {
    if (this.selectedApexBIds.has(id)) {
      this.selectedApexBIds.delete(id);
    } else {
      this.selectedApexBIds.add(id);
    }
  }

  toggleApexCSelection(id: string) {
    if (this.selectedApexCIds.has(id)) {
      this.selectedApexCIds.delete(id);
    } else {
      this.selectedApexCIds.add(id);
    }
  }

  toggleAllApexASelection() {
    const visible = this.filteredApexAForms;
    if (this.selectedApexAIds.size === visible.length) {
      this.selectedApexAIds.clear();
    } else {
      visible.forEach(f => this.selectedApexAIds.add(f.id));
    }
  }

  toggleAllApexBSelection() {
    const visible = this.filteredApexBForms;
    if (this.selectedApexBIds.size === visible.length) {
      this.selectedApexBIds.clear();
    } else {
      visible.forEach(f => this.selectedApexBIds.add(f.id));
    }
  }

  toggleAllApexCSelection() {
    const visible = this.filteredApexCForms;
    if (this.selectedApexCIds.size === visible.length) {
      this.selectedApexCIds.clear();
    } else {
      visible.forEach(f => this.selectedApexCIds.add(f.id));
    }
  }

  async loadApexAForms() {
    if (this.loadingApexA) return;
    this.loadingApexA = true;
    console.log('🔄 [APEX A] Loading forms...');
    try {
      const result = await this.adminApi.getApexAForms({ page: 1, limit: 10 });
      console.log('✅ [APEX A] API Response:', result);
      console.log('✅ [APEX A] Number of forms:', result?.length || 0);
      
      this.apexAForms = result || [];
      this.selectedApexAIds.clear();
      
      // Force change detection to update UI
      this.cdr.markForCheck();
      
      console.log('✅ [APEX A] Forms loaded successfully. Count:', this.apexAForms.length);
      if (this.apexAForms.length > 0) {
        this.toast.success(`Loaded ${this.apexAForms.length} APEX A forms`);
      } else {
        console.warn('⚠️ [APEX A] No forms returned from API');
      }
    } catch (err: any) {
      console.error('❌ [APEX A] Error loading forms:', err);
      const msg = err?.error?.message || err?.message || 'Failed to load APEX A forms';
      this.toast.danger(msg);
      this.apexAForms = [];
    } finally {
      this.loadingApexA = false;
      this.cdr.markForCheck();
    }
  }

  async loadApexBForms() {
    if (this.loadingApexB) return;
    this.loadingApexB = true;
    console.log('🔄 [APEX B] Loading forms...');
    try {
      const result = await this.adminApi.getApexBForms({ page: 1, limit: 10 });
      
      console.log('✅ [APEX B] Full API Response:', JSON.stringify(result, null, 2));
      console.log('✅ [APEX B] Number of forms:', result?.length || 0);
      
      // Check each form for student verification status
      if (Array.isArray(result) && result.length > 0) {
        console.log('📊 [APEX B] Student Verification Status:');
        result.forEach((form: any, index: number) => {
          console.log(`  Form ${index + 1}: ${form.student?.name || form.name || 'N/A'} - Status: ${form.status || 'N/A'}`);
        });
      }
      
      this.apexBForms = result || [];
      this.selectedApexBIds.clear();
      
      // Force change detection to update UI
      this.cdr.markForCheck();
      
      console.log('✅ [APEX B] Forms loaded successfully. Count:', this.apexBForms.length);
      if (this.apexBForms.length > 0) {
        this.toast.success(`Loaded ${this.apexBForms.length} APEX B forms`);
      } else {
        console.warn('⚠️ [APEX B] No forms returned from API');
      }
    } catch (err: any) {
      console.error('❌ [APEX B] Error loading:', err);
      const msg = err?.error?.message || err?.message || 'Failed to load APEX B forms';
      this.toast.danger(msg);
      this.apexBForms = [];
    } finally {
      this.loadingApexB = false;
      this.cdr.markForCheck();
    }
  }

  async loadApexCForms() {
    if (this.loadingApexC) return;
    this.loadingApexC = true;
    console.log('🔄 [APEX C] Loading forms...');
    try {
      // TODO: Replace with actual API when available
      this.apexCForms = [];
      this.selectedApexCIds.clear();
      // const result = await this.adminApi.getApexCForms();
      // this.apexCForms = result;
      
      // Force change detection to update UI
      this.cdr.markForCheck();
      
      console.log('✅ [APEX C] Forms loaded successfully. Count:', this.apexCForms.length);
    } catch (err: any) {
      console.error('❌ [APEX C] Error loading forms:', err);
      const msg = err?.error?.message || err?.message || 'Failed to load APEX C forms';
      this.toast.danger(msg);
      this.apexCForms = [];
    } finally {
      this.loadingApexC = false;
      this.cdr.markForCheck();
    }
  }

  async updateApexAStatus(formId: string, status: 'approved' | 'rejected') {
    if (this.updatingApexA) return;
    
    const form = this.apexAForms.find(f => f.id === formId);
    if (!form) {
      this.toast.danger('Form not found');
      return;
    }
    
    if (!form.student?.id) {
      this.toast.danger('Student ID is missing from form data');
      return;
    }
    
    if (!formId || !status) {
      this.toast.danger('Form ID and status are required');
      return;
    }
    
    if (!confirm(`Are you sure you want to ${status} this APEX A form?`)) return;
    
    this.updatingApexA = true;
    try {
      await this.adminApi.updateApexAStatus(formId, form.student.id, status);
      this.toast.success(`APEX A form ${status} successfully`);
      // Update local state instead of full reload for better performance
      form.status = status;
      this.selectedApexAIds.delete(formId);
      this.cdr.markForCheck();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || `Failed to ${status} APEX A form`;
      this.toast.danger(msg);
    } finally {
      this.updatingApexA = false;
      this.cdr.markForCheck();
    }
  }

  async approveAllApexA() {
    if (this.approvingAllApexA || this.selectedApexAIds.size === 0) return;
    if (!confirm(`Are you sure you want to approve ${this.selectedApexAIds.size} APEX A form(s)?`)) return;
    
    this.approvingAllApexA = true;
    const ids = Array.from(this.selectedApexAIds);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of ids) {
        try {
          const form = this.apexAForms.find(f => f.id === id);
          if (form && form.student?.id) {
            await this.adminApi.updateApexAStatus(id, form.student.id, 'approved');
            form.status = 'approved';
            this.selectedApexAIds.delete(id);
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        this.toast.success(`${successCount} APEX A form(s) approved successfully`);
      }
      if (failCount > 0) {
        this.toast.danger(`${failCount} APEX A form(s) failed to approve`);
      }
    } finally {
      this.approvingAllApexA = false;
      this.cdr.markForCheck();
    }
  }

  async updateApexBStatus(formId: string, status: 'approved' | 'rejected') {
    if (this.updatingApexB) return;
    
    const form = this.apexBForms.find(f => f.id === formId);
    if (!form) {
      this.toast.danger('Form not found');
      return;
    }
    
    console.log('🔄 [Admin - Update APEX B Status] Form Details:', {
      formId: formId,
      studentName: form.student?.name || form.name || 'N/A',
      studentId: form.student?.id,
      studentEmail: form.student?.email || form.email,
      currentStatus: form.status,
      newStatus: status,
      studentVerified: (form as any).studentVerified || false,
      facultyVerified: (form as any).facultyVerified || false,
      agreementAccepted: form.agreementAccepted || false
    });
    
    if (!form.student?.id) {
      this.toast.danger('Student ID is missing from form data');
      return;
    }
    
    if (!formId || !status) {
      this.toast.danger('Form ID and status are required');
      return;
    }
    
    if (!confirm(`Are you sure you want to ${status} this APEX B form?`)) return;
    
    this.updatingApexB = true;
    try {
      // If approving, check if we have details to send along
      let details = undefined;
      if (status === 'approved' && this.selectedApexBForm?.id === formId && this.apexBDetails.studentId) {
        // Include details if they were filled in the modal
        details = this.apexBDetails;
      }
      
      console.log('📤 [Admin - Update APEX B] Sending request:', { formId, studentId: form.student.id, status, details });
      // Use updateApexBDetails for APEX B updates
      if (details && details.studentId) {
        await this.adminApi.updateApexBDetails(details);
      }
      this.toast.success(`APEX B form ${status} successfully`);
      // Update local state
      form.status = status;
      this.selectedApexBIds.delete(formId);
      
      console.log('✅ [Admin - Update APEX B] Status updated successfully to:', status);
      
      // Close modal if open
      if (this.showApexBModal) {
        this.closeApexBModal();
      }
      
      // Reload forms list to get updated data
      await this.loadApexBForms();
    } catch (err: any) {
      console.error('❌ [Admin - Update APEX B] Error:', err);
      console.error('   Error details:', { status: err?.status, error: err?.error, message: err?.message });
      const msg = err?.error?.message || err?.error?.error || err?.message || `Failed to ${status} APEX B form`;
      this.toast.danger(msg);
    } finally {
      this.updatingApexB = false;
      this.cdr.markForCheck();
    }
  }

  async approveAllApexB() {
    if (this.approvingAllApexB || this.selectedApexBIds.size === 0) return;
    if (!confirm(`Are you sure you want to approve ${this.selectedApexBIds.size} APEX B form(s)?`)) return;
    
    this.approvingAllApexB = true;
    const ids = Array.from(this.selectedApexBIds);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of ids) {
        try {
          const form = this.apexBForms.find(f => f.id === id);
          if (form && form.student?.id) {
            // Use updateApexBDetails for APEX B updates
            await this.adminApi.updateApexBDetails({ studentId: form.student.id });
            form.status = 'approved';
            this.selectedApexBIds.delete(id);
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        this.toast.success(`${successCount} APEX B form(s) approved successfully`);
      }
      if (failCount > 0) {
        this.toast.danger(`${failCount} APEX B form(s) failed to approve`);
      }
    } finally {
      this.approvingAllApexB = false;
      this.cdr.markForCheck();
    }
  }

  async approveAllApexC() {
    if (this.approvingAllApexC || this.selectedApexCIds.size === 0) return;
    if (!confirm(`Are you sure you want to approve ${this.selectedApexCIds.size} APEX C form(s)?`)) return;
    
    this.approvingAllApexC = true;
    const ids = Array.from(this.selectedApexCIds);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of ids) {
        try {
          // TODO: Replace with actual API when available
          // await this.adminApi.updateApexCStatus(id, 'approved');
          const form = this.apexCForms.find(f => f.id === id);
          if (form) form.status = 'approved';
          this.selectedApexCIds.delete(id);
          successCount++;
        } catch {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        this.toast.success(`${successCount} APEX C form(s) approved successfully`);
      }
      if (failCount > 0) {
        this.toast.danger(`${failCount} APEX C form(s) failed to approve`);
      }
    } finally {
      this.approvingAllApexC = false;
      this.cdr.markForCheck();
    }
  }

  viewApexADetails(form: any) {
    this.selectedApexAForm = form;
    this.showApexADetailsModal = true;
  }

  closeApexADetailsModal() {
    this.showApexADetailsModal = false;
    this.selectedApexAForm = null;
  }

  openApexBDetailsModal(form: any) {
    this.selectedApexBForm = form;
    
    // Reset loading state to ensure clean modal open
    this.updatingApexB = false;
    
    // Check if already approved and show warning
    if (form.status === 'approved') {
      console.log('⚠️ [Admin - Open APEX B Modal] Form already approved for student:', form.student?.name);
      this.toast.info('This form has already been approved. You can view details but cannot submit again.');
    }
    
    this.apexBDetails = {
      studentId: form.student?.id || form.id || '',
      companyName: '',
      internshipRole: '',
      facultySupervisorNameDesig: '',
      siteSupervisorNameDesig: '',
      facultyId: '',
      siteId: '',
      durationWeeks: 0,
      startDate: '',
      endDate: ''
    };
    // Initialize search queries
    this.facultySearchQuery = '';
    this.siteSearchQuery = '';
    this.facultySearchResults = [];
    this.siteSearchResults = [];
    this.showFacultyDropdown = false;
    this.showSiteDropdown = false;
    this.showApexBModal = true;
  }

  viewApexBFullDetails(form: any) {
    this.selectedApexBForm = form;
    // Clear the details form to show view-only mode
    this.apexBDetails = {
      studentId: '',
      companyName: '',
      internshipRole: '',
      facultySupervisorNameDesig: '',
      siteSupervisorNameDesig: '',
      facultyId: '',
      siteId: '',
      durationWeeks: 0,
      startDate: '',
      endDate: ''
    };
    this.showApexBModal = true;
  }

  viewApexCDetails(form: any) {
    this.selectedApexCForm = form;
    this.showApexCDetailsModal = true;
  }

  closeApexCDetailsModal() {
    this.showApexCDetailsModal = false;
    this.selectedApexCForm = null;
  }

  isApexBFormAlreadyApproved(form?: any): boolean {
    const targetForm = form || this.selectedApexBForm;
    return targetForm?.status === 'approved';
  }

  canAddApexBDetails(form: any): boolean {
    // Can add details if:
    // 1. Not currently updating
    // 2. Status is not 'approved' (pending or rejected forms can be edited)
    // 3. OR status is 'rejected' (can resubmit after rejection)
    if (this.updatingApexB) return false;
    const status = form?.status || 'pending';
    return status !== 'approved';
  }

  closeApexBModal() {
    this.showApexBModal = false;
    this.selectedApexBForm = null;
    this.updatingApexB = false; // Reset loading state when closing modal
    this.apexBDetails = {
      studentId: '',
      companyName: '',
      internshipRole: '',
      facultySupervisorNameDesig: '',
      siteSupervisorNameDesig: '',
      facultyId: '',
      siteId: '',
      durationWeeks: 0,
      startDate: '',
      endDate: ''
    };
    // Clear search states
    this.facultySearchResults = [];
    this.siteSearchResults = [];
    this.facultySearchQuery = '';
    this.siteSearchQuery = '';
    this.showFacultyDropdown = false;
    this.showSiteDropdown = false;
  }

  // Faculty Search for APEX B
  onFacultySearchInput(value: string) {
    const q = (value || '').trim();
    this.facultySearchQuery = q;
    
    if (this.facultySearchDebounce) clearTimeout(this.facultySearchDebounce);
    
    if (!q || q.length < 2) {
      this.facultySearchResults = [];
      this.showFacultyDropdown = false;
      this.facultySearchLoading = false;
      return;
    }
    
    this.facultySearchDebounce = setTimeout(async () => {
      try {
        this.facultySearchLoading = true;
        this.showFacultyDropdown = true;
        this.facultySearchResults = await this.adminApi.searchFaculty(q);
      } catch (err: any) {
        this.facultySearchResults = [];
        const msg = err?.error?.message || err?.message || 'Failed to search faculty';
        console.error('Faculty search error:', msg);
      } finally {
        this.facultySearchLoading = false;
      }
    }, 300);
  }

  selectFaculty(faculty: { id: string; name: string; email?: string }) {
    this.apexBDetails.facultyId = faculty.id;
    this.apexBDetails.facultySupervisorNameDesig = faculty.name;
    this.facultySearchQuery = faculty.name;
    this.showFacultyDropdown = false;
    this.facultySearchResults = [];
  }

  // Site Supervisor Search for APEX B
  onSiteSearchInput(value: string) {
    const q = (value || '').trim();
    this.siteSearchQuery = q;
    
    if (this.siteSearchDebounce) clearTimeout(this.siteSearchDebounce);
    
    if (!q || q.length < 2) {
      this.siteSearchResults = [];
      this.showSiteDropdown = false;
      this.siteSearchLoading = false;
      return;
    }
    
    this.siteSearchDebounce = setTimeout(async () => {
      try {
        this.siteSearchLoading = true;
        this.showSiteDropdown = true;
        this.siteSearchResults = await this.adminApi.searchSiteSupervisors(q);
      } catch (err: any) {
        this.siteSearchResults = [];
        const msg = err?.error?.message || err?.message || 'Failed to search site supervisors';
        console.error('Site search error:', msg);
      } finally {
        this.siteSearchLoading = false;
      }
    }, 300);
  }

  selectSiteSupervisor(site: { id: string; name: string; email?: string }) {
    this.apexBDetails.siteId = site.id;
    this.apexBDetails.siteSupervisorNameDesig = site.name;
    this.siteSearchQuery = site.name;
    this.showSiteDropdown = false;
    this.siteSearchResults = [];
  }

  async submitApexBDetails() {
    if (this.updatingApexB) return;
    if (!this.selectedApexBForm) return;
    
    // Check if details were already submitted for this student (status is approved)
    if (this.selectedApexBForm.status === 'approved') {
      this.toast.warning('Details have already been submitted for this student');
      console.log('⚠️ [Admin - Submit APEX B Details] Already approved, preventing duplicate submission');
      return;
    }
    
    // Validate that at least one field is filled
    const hasData = this.apexBDetails.companyName ||
                   this.apexBDetails.internshipRole ||
                   this.apexBDetails.facultySupervisorNameDesig ||
                   this.apexBDetails.siteSupervisorNameDesig ||
                   this.apexBDetails.facultyId ||
                   this.apexBDetails.siteId ||
                   this.apexBDetails.durationWeeks > 0 ||
                   this.apexBDetails.startDate ||
                   this.apexBDetails.endDate;
    
    if (!hasData) {
      this.toast.danger('Please fill at least one field');
      return;
    }
    
    this.updatingApexB = true;
    let success = false;
    
    try {
      console.log('📤 [Admin - Submit APEX B Details] Sending details:', this.apexBDetails);
      
      // Submit details with admin approval action
      const payload = {
        ...this.apexBDetails,
        adminApprovalAction: 'approve' as 'approve'
      };
      
      const response = await this.adminApi.updateApexBDetails(payload);
      
      console.log('✅ [Admin - Submit APEX B Details] API call successful', response);
      
      // Mark success to trigger modal close
      success = true;
      
      // Update local state to reflect approval
      const form = this.apexBForms.find(f => f.id === this.selectedApexBForm.id);
      if (form) {
        form.status = 'approved';
        // Update with response data if available
        if (response?.data) {
          Object.assign(form, response.data);
        }
        console.log('✅ [Admin - Submit APEX B Details] Form status updated to approved');
      }
      
      // Show success message
      this.toast.success('APEX B details submitted successfully and form approved');
      
      // Reload the forms list to get updated data from server (in background)
      console.log('🔄 [Admin - Submit APEX B Details] Reloading forms list...');
      this.loadApexBForms().then(() => {
        console.log('✅ [Admin - Submit APEX B Details] Forms list reloaded');
      }).catch(err => {
        console.error('❌ [Admin - Submit APEX B Details] Error reloading forms:', err);
      });
      
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to submit APEX B details';
      this.toast.danger(msg);
      console.error('❌ [Admin - Submit APEX B Details] Error:', err);
    } finally {
      // Reset loading state first
      this.updatingApexB = false;
      
      // Trigger change detection to update button states
      this.cdr.markForCheck();
      
      // Close modal only on success (in finally to ensure it always runs after state reset)
      if (success) {
        console.log('✅ [Admin - Submit APEX B Details] Closing modal after successful submission');
        // Use setTimeout to ensure state is fully updated before closing
        setTimeout(() => {
          this.closeApexBModal();
          this.cdr.markForCheck();
        }, 100);
      }
    }
  }

  // ── Office Evaluation (POST/GET /api/admin/office-evaluation) ──────────────
  readonly criteriaOptions = [
    { label: 'Excellent', value: 10 },
    { label: 'Good', value: 8 },
    { label: 'Satisfactory', value: 5 },
    { label: 'Needs Improvement', value: 3 }
  ];

  officeEvalForm = {
    internshipId: '',
    criteria: {
      internshipReport: 10,
      portfolioEvidence: 10,
      timeManagement: 10,
      overallInternshipImpact: 10
    },
    comments: ''
  };

  officeEvalResult: {
    id?: string;
    type?: string;
    totalMarks?: number;
    maxMarks?: number;
    criteria?: any[];
    comments?: string;
    submittedDate?: string;
    evaluator?: any;
  } | null = null;

  studentFinalResult: any = null;
  loadingFinalResult = false;

  submittingOfficeEval = false;
  loadingOfficeEval = false;
  selectedStudentForEval: any = null;
  // Full internship details from /api/admin/internships/{internshipId}
  internshipDetails: any = null;
  loadingInternshipDetails = false;
  // List of all internships for browsing/selection
  internships: Array<any> = [];
  loadingInternships = false;
  internshipsPage = 1;
  internshipsPageSize = 10;

  get officeEvalTotal(): number {
    const c = this.officeEvalForm.criteria;
    return (c.internshipReport || 0) + (c.portfolioEvidence || 0) + (c.timeManagement || 0) + (c.overallInternshipImpact || 0);
  }

  prepareStudentForEval(internship: any) {
    return {
      id: internship.student?.id,
      ...internship.student,
      internshipId: internship.id
    };
  }

  /** Helper method to extract final result from internship object (handles multiple API response structures) */
  getInternshipFinalResult(internship: any): any {
    if (!internship || !internship.studentFinalResult) return null;
    
    const fr = internship.studentFinalResult;
    
    // Log structure for debugging
    if (internship.id) {
      console.log(`🔍 [getInternshipFinalResult] ${internship.id}:`, {
        frKeys: Object.keys(fr),
        hasFinalResult: !!fr.finalResult,
        finalResultKeys: fr.finalResult ? Object.keys(fr.finalResult) : [],
        finalResultData: fr.finalResult
      });
    }
    
    // Structure 1: fr.finalResult (the actual marks)
    if (fr.finalResult && typeof fr.finalResult === 'object') {
      const result = fr.finalResult;
      // Check for any mark properties
      if (result.totalMarks !== undefined || result.officeMarks !== undefined || 
          result.facultyMarks !== undefined || result.siteMarks !== undefined ||
          result.presentationMarks !== undefined || result.status) {
        console.log('✅ Found marks in fr.finalResult:', result);
        return {
          totalMarks: result.totalMarks,
          officeMarks: result.officeMarks,
          facultyMarks: result.facultyMarks,
          siteMarks: result.siteMarks,
          presentationMarks: result.presentationMarks,
          status: result.status
        };
      }
    }
    
    // Structure 2: Root level (in case API returns flat structure)
    if (fr.totalMarks !== undefined || fr.officeMarks !== undefined || 
        fr.facultyMarks !== undefined || fr.siteMarks !== undefined ||
        fr.presentationMarks !== undefined || fr.status) {
      console.log('✅ Found marks at fr root level:', {
        totalMarks: fr.totalMarks,
        officeMarks: fr.officeMarks
      });
      return {
        totalMarks: fr.totalMarks,
        officeMarks: fr.officeMarks,
        facultyMarks: fr.facultyMarks,
        siteMarks: fr.siteMarks,
        presentationMarks: fr.presentationMarks,
        status: fr.status
      };
    }
    
    // No marks found - data loaded but empty
    console.warn(`⚠️ No marks in ${internship.id}. Data exists but all mark fields are undefined/null`);
    return null;
  }

  selectStudentForEval(student: any) {
    this.selectedStudentForEval = student;
    const internshipId = student?.internshipId || student?.apexBInternshipId || '';
    this.officeEvalForm = {
      internshipId,
      criteria: { internshipReport: 10, portfolioEvidence: 10, timeManagement: 10, overallInternshipImpact: 10 },
      comments: ''
    };
    this.officeEvalResult = null;
    this.internshipDetails = null;
    // Use final result already loaded from table, or get it from the internship object
    const foundInternship = this.internships.find(i => i.id === internshipId);
    this.studentFinalResult = foundInternship?.studentFinalResult ?? null;
    
    // Set loading to true immediately so loading state appears
    this.loadingInternshipDetails = true;
    this.loadingOfficeEval = true;
    this.loadingFinalResult = false;  // Already loaded from table
    
    if (!internshipId) {
      this.toast.warning('This student does not have an internship ID assigned yet.');
      this.loadingInternshipDetails = false;
      this.loadingOfficeEval = false;
      return;
    }
    
    // Load data in parallel for faster loading (internship and office eval only)
    Promise.all([
      this.loadInternshipDetails(internshipId),
      this.loadOfficeEvaluation(internshipId)
    ]).catch(err => {
      console.error('Error loading evaluation data:', err);
    });
  }

  async loadInternshipDetails(internshipId: string) {
    if (!internshipId) {
      this.loadingInternshipDetails = false;
      return;
    }
    try {
      const res = await this.adminApi.getInternshipDetails(internshipId);
      this.internshipDetails = res;
      console.log('✅ Internship details loaded:', res);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load internship details';
      console.error(msg);
      this.internshipDetails = null;
    } finally {
      this.loadingInternshipDetails = false;
    }
  }

  async loadOfficeEvaluation(internshipId: string) {
    if (!internshipId) {
      this.loadingOfficeEval = false;
      return;
    }
    try {
      const res = await this.adminApi.getOfficeEvaluation(internshipId);
      this.officeEvalResult = res?.evaluation ?? null;
    } catch (err: any) {
      if (err?.status !== 404) {
        console.error('Failed to load office evaluation:', err?.message);
      }
      this.officeEvalResult = null;
    } finally {
      this.loadingOfficeEval = false;
    }
  }

  async loadStudentFinalResult(internshipId: string) {
    if (!internshipId) {
      this.loadingFinalResult = false;
      return;
    }
    try {
      const res = await this.adminApi.getStudentFinalResult(internshipId);
      this.studentFinalResult = res?.finalResult ?? null;
      console.log('✅ Student final result loaded:', this.studentFinalResult);
    } catch (err: any) {
      console.error('Failed to load student final result:', err?.message);
      this.studentFinalResult = null;
    } finally {
      this.loadingFinalResult = false;
    }
  }

  async loadAllInternships() {
    if (this.loadingInternships) return;
    this.loadingInternships = true;
    try {
      const res = await this.adminApi.getAllInternships();
      const data = res?.data || [];
      
      // Map internships from API response
      this.internships = Array.isArray(data) ? data.map((item: any) => ({
        id: item.id || item._id || '',
        student: {
          id: item.student?.id || item.student?._id || '',
          name: item.student?.name || item.studentName || '',
          email: item.student?.email || '',
          regNo: item.student?.regNo || item.student?.registrationNo || ''
        },
        company: {
          id: item.site?.company?.id || item.company?.id || item.company?._id || '',
          name: item.site?.company?.name || item.company?.name || item.companyName || ''
        },
        companyName: item.site?.company?.name || item.company?.name || item.companyName || '',
        faculty: {
          id: item.faculty?.id || item.faculty?._id || '',
          name: item.faculty?.name || '',
          email: item.faculty?.email || ''
        },
        site: {
          id: item.site?.id || item.site?._id || '',
          name: item.site?.name || '',
          email: item.site?.email || '',
          company: item.site?.company || {}
        },
        status: item.status || 'pending',
        approvalStatus: item.approvedByHOD ? 'approved' : (item.verified ? 'verified' : 'pending'),
        internshipType: item.type || 'ONSITE',
        startDate: item.startDate,
        endDate: item.endDate,
        studentFinalResult: null,  // Will be populated by loadStudentFinalResults
        loadingFinalResult: false,
        internshipRole: item.internshipRole || ''
      })) : [];
      
      console.log('✅ Internships list loaded:', this.internships.length, 'internships');
      
      // Load final results for all internships using /api/admin/internships/{internshipId}
      this.loadStudentFinalResultsForAll();
      
      // Preload details for first 3 internships in background (don't show loading)
      this.preloadInternshipDetails();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to load internships';
      console.error(msg);
      this.internships = [];
    } finally {
      this.loadingInternships = false;
    }
  }

  private async loadStudentFinalResultsForAll(): Promise<void> {
    // Load final results for all internships using /api/admin/internships/{internshipId}
    try {
      await Promise.all(this.internships.map(async (internship) => {
        if (internship.id) {
          internship.loadingFinalResult = true;
          try {
            console.log(`📥 [loadStudentFinalResultsForAll] Fetching result for internship ${internship.id} (student: ${internship.student?.name})`);
            const res = await this.adminApi.getStudentFinalResult(internship.id);
            console.log(`📦 [loadStudentFinalResultsForAll] Full Response for ${internship.id}:`, {
              responseKeys: Object.keys(res || {}),
              fullResponse: res,
              hasData: !!res?.data,
              hasFinalResult: !!res?.finalResult,
              hasFinalResultObj: !!res?.finalResult,
              allProps: res ? Object.entries(res).map(([k, v]) => `${k}: ${typeof v}`) : []
            });
            // Store entire response (contains both finalResult and internship data from the endpoint)
            internship.studentFinalResult = res ?? null;
            console.log('✅ Final result loaded for internship:', internship.id, {
              data: internship.studentFinalResult,
              totalMarks: internship.studentFinalResult?.totalMarks,
              officeMarks: internship.studentFinalResult?.officeMarks,
              finalResultTotalMarks: internship.studentFinalResult?.finalResult?.totalMarks
            });
            this.cdr.markForCheck();
          } catch (err: any) {
            console.log('⚠️ Final result not available for internship:', internship.id, err?.message);
            internship.studentFinalResult = null;
          } finally {
            internship.loadingFinalResult = false;
            this.cdr.markForCheck();
          }
        }
      }));
      console.log('✅ All student final results loaded');
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading final results:', error);
    }
  }

  private async loadAllStudentFinalResults(): Promise<void> {
    // Note: Renamed to loadStudentFinalResultsForAll()
    console.log('✅ All student final results already loaded');
  }

  private async preloadInternshipDetails(): Promise<void> {
    // Preload first 3 internship details in background (silent loading, no UI updates)
    const toPreload = this.internships.slice(0, 3);
    try {
      await Promise.all(toPreload.map(internship => 
        this.adminApi.getInternshipDetails(internship.id).catch(() => null)
      ));
      console.log('✅ Preloaded', toPreload.length, 'internship details');
    } catch (error) {
      // Silent fail on preload
      console.log('Preload complete (some may have failed)');
    }
  }

  async submitOfficeEvaluation() {
    const id = this.officeEvalForm.internshipId?.trim();
    if (!id) { 
      this.toast.warning('Internship ID not available. Please select a student with a valid internship.');
      return;
    }
    
    // Prevent submission if evaluation already exists
    if (this.officeEvalResult) {
      this.toast.warning('An evaluation has already been submitted for this internship. The form should not be visible.');
      return;
    }
    
    // Prevent duplicate submissions
    if (this.submittingOfficeEval) {
      this.toast.warning('Submission in progress. Please wait...');
      return;
    }
    
    this.submittingOfficeEval = true;
    try {
      const res = await this.adminApi.submitOfficeEvaluation({
        internshipId: id,
        criteria: this.officeEvalForm.criteria,
        comments: this.officeEvalForm.comments
      });
      this.toast.success(res?.message || 'Office evaluation submitted successfully');
      this.officeEvalResult = res?.evaluation ?? null;
      await this.loadOfficeEvaluation(id);
      
      // Update the internship in the list with the new final result
      const foundInternship = this.internships.find(i => i.id === id);
      if (foundInternship) {
        foundInternship.loadingFinalResult = true;
        try {
          const updatedResult = await this.adminApi.getStudentFinalResult(id);
          foundInternship.studentFinalResult = updatedResult ?? null;
        } catch (err: any) {
          console.warn('Failed to refresh internship final result:', err?.message || 'Unknown error');
        } finally {
          foundInternship.loadingFinalResult = false;
        }
      }
      
      this.cdr.markForCheck();
    } catch (err: any) {
      // Handle 409 Conflict (evaluation already exists)
      if (err?.status === 409) {
        this.toast.warning('Evaluation already exists for this internship. Reload to view latest data.');
        await this.loadOfficeEvaluation(id);
      } else {
        const msg = err?.error?.message || err?.message || 'Failed to submit office evaluation';
        this.toast.danger(msg);
      }
      this.cdr.markForCheck();
    } finally {
      this.submittingOfficeEval = false;
      this.cdr.detectChanges();
    }
  }
}
