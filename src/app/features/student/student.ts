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
import { AssignmentForm } from './assignment-form';
import { Form3Form } from './form3-form';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule, RouterModule, PaginatePipe, PaginatorComponent, AssignmentForm, Form3Form],
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
  // tabs: make each form an explicit tab so AppEx-A is first
  currentTab: 'appex'|'assignment'|'form3'|'evidence'|'logs'|'reports'|'assignments'|'complaints'|'marks' = 'appex';
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
          const allowed = ['appex','assignment','form3','evidence','logs','reports','assignments','complaints','marks'] as const;
          if (tabParam) {
            // record raw value for diagnostics
            this.lastQueryTab = tabParam;
            // Normalize common aliases: remove non-alphanum, collapse dashes/underscores/spaces
            const norm = (tabParam || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            // map some legacy/alternate names to canonical tabs
            const aliasMap: Record<string, string> = {
              'forms': 'appex', // legacy alias
              'form3': 'form3',
              'form03': 'form3',
              'form-3': 'form3',
              'form_3': 'form3',
              'formthree': 'form3',
              'assignment': 'assignment',
              'assignments': 'assignments',
              'complaints': 'complaints',
              'appex': 'appex',
              'approval': 'appex'
            };
            const mapped = aliasMap[norm] ?? norm;
            if ((allowed as readonly string[]).includes(mapped)) {
              this.currentTab = mapped as any;
              // Reflect canonical tab in URL so aliases normalize in address bar.
              // Avoid navigating if the incoming param already matches the canonical value
              // (prevents unnecessary re-navigation / re-entry loops).
              try {
                if (tabParam !== mapped) {
                  this.router.navigate([], { relativeTo: this.route, queryParams: { tab: mapped }, queryParamsHandling: 'merge' });
                }
              } catch {}
            } else {
              this.currentTab = 'appex';
            }
          } else {
            // No explicit tab requested: default students to the AppEx-A tab so Internship Approval shows first
            this.currentTab = 'appex';
          }
        // guard: if not approved, restrict to core forms/evidence/complaints
        const isOk = this.isApproved();
        const visibleWhenPending = new Set(['appex','assignment','form3','evidence','complaints']);
        if (!isOk && !visibleWhenPending.has(this.currentTab)) {
          this.currentTab = 'appex';
          try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'appex' }, queryParamsHandling: 'merge' }); } catch {}
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
          try {
            const dsList = this.store.designStatements()[sid] ?? [];
            if (dsList.length) {
              const latestDs = dsList[dsList.length - 1] as any;
              if (latestDs) {
                // Restore overview
                this.form3.organizationOverview = latestDs.placement?.overview || this.form3.organizationOverview || '';

                // Many fields were serialized into `scopeAndDeliverables` when saved.
                // Attempt to parse common labeled sections so UI fields (scope, keyActivities, tools, expectedDeliverables)
                // are restored for editing.
                const raw = (latestDs.scopeAndDeliverables || '').toString();
                if (raw) {
                  // Split into labeled blocks separated by blank lines (as saved in submitForm3)
                  const parts = raw.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                  // Helper to strip leading label like 'Scope: '
                  const stripLabel = (text: string, label: string) => {
                    if (!text) return '';
                    const idx = text.toLowerCase().indexOf(label.toLowerCase());
                    return idx === -1 ? text : text.slice(idx + label.length).trim();
                  };

                  // Part 0: Scope
                  if (parts[0]) this.form3.scopeOfWork = stripLabel(parts[0], 'Scope:') || this.form3.scopeOfWork || '';

                  // Part 1: Key Activities
                  if (parts[1]) {
                    const kaRaw = stripLabel(parts[1], 'Key Activities:') || '';
                    // activities were saved as comma-separated names
                    const items = kaRaw.split(',').map(s => s.trim()).filter(s => s.length);
                    // reset activities
                    const k = { ...this.form3.keyActivities };
                    // normalize and map
                    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
                    const itemNorms = items.map(norm);
                    k.coding = itemNorms.includes('coding');
                    k.testing = itemNorms.includes('testing');
                    k.documentation = itemNorms.includes('documentation');
                    k.dataAnalysis = itemNorms.includes('dataanalysis') || itemNorms.includes('dataanalysis');
                    k.research = itemNorms.includes('research');
                    k.technicalSupport = itemNorms.includes('technicalsupport') || itemNorms.includes('technical');
                    k.dashboard = itemNorms.includes('dashboardreportcreation') || itemNorms.includes('dashboard') || itemNorms.includes('reportcreation');
                    // detect 'other' and capture trailing text if present in same part
                    const otherEntry = items.find(it => /other/i.test(it));
                    if (otherEntry) {
                      k.other = true;
                      // if other contains a parenthetical or colon, try to extract text after ':' or '-' or '('
                      const m = otherEntry.split(/[:\-\(\)]/).slice(1).join(':').trim();
                      k.otherText = m || this.form3.keyActivities.otherText || '';
                    } else {
                      k.other = this.form3.keyActivities.other || false;
                      k.otherText = this.form3.keyActivities.otherText || '';
                    }
                    this.form3.keyActivities = k;
                  }

                  // Part 2: Tools/Technologies
                  if (parts[2]) this.form3.tools = stripLabel(parts[2], 'Tools/Technologies:') || this.form3.tools || '';

                  // Part 3: Expected Deliverables
                  if (parts[3]) this.form3.expectedDeliverables = stripLabel(parts[3], 'Expected Deliverables:') || this.form3.expectedDeliverables || '';
                } else {
                  // Fallback: if no structured string, preserve existing scopeOfWork (already set above)
                  this.form3.scopeOfWork = this.form3.scopeOfWork || '';
                }
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
    try {
      return await this.studentApi.getAppExA();
    } catch (err: any) {
      // Network/CORS errors surface as status === 0 in Angular HttpErrorResponse
      const isNet = err && (err.status === 0 || (err.message || '').toString().toLowerCase().includes('unknown error'));
      if (isNet) {
        this.toast.warning('Unable to reach AppEx-A server (network/CORS). Working offline and using local draft if available.');
        // return empty object so caller can fallback to local draft
        return {};
      }
      this.toast.danger(err?.error?.message || err?.message || 'Failed to load AppEx-A');
      throw err;
    }
  }
  async apiSubmitAppExA(payload: any) {
    try {
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

  // Submit Form 3 (Organization Overview & Scope of Work)
  submitForm3() {
    if (!this.selectedId) return;
    if (!this.ensureMine()) return;
    const f = this.form3 as any;
    if (!f.organizationOverview?.trim() && !f.scopeOfWork?.trim()) {
      this.toast.warning('Please provide organization overview or scope of work before submitting.');
      return;
    }
    try {
      // Map fields to DesignStatement structure: keep scope/tools/deliverables in scopeAndDeliverables
      const ds = {
        careerGoal: '',
        learningObjectives: '',
        placement: { organization: '', mode: 'On-site', functionalArea: '', overview: f.organizationOverview || '' },
        supervisor: { name: '', designation: '', email: '', contact: '' },
        scopeAndDeliverables: `Scope: ${f.scopeOfWork || ''}\n\nKey Activities: ${Object.entries(f.keyActivities).filter(([k,v]) => k !== 'other' && v).map(([k]) => k).join(', ')}${f.keyActivities.other ? (', ' + (f.keyActivities.otherText || 'Other')) : ''}\n\nTools/Technologies: ${f.tools || ''}\n\nExpected Deliverables: ${f.expectedDeliverables || ''}`,
        academicPreparation: '',
        comments: ''
      };
      this.store.submitDesignStatement(this.selectedId, ds as any);
      this.toast.success('Form 3 (Organization Overview & Scope) saved');
      // clear form3
      this.form3 = { organizationOverview: '', scopeOfWork: '', keyActivities: { coding: false, testing: false, documentation: false, dataAnalysis: false, research: false, technicalSupport: false, dashboard: false, other: false, otherText: '' }, tools: '', expectedDeliverables: '' };
    } catch (err: any) {
      this.toast.danger('Failed to save Form 3');
    }
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
