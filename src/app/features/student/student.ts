import { Component, computed, effect } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { StudentService } from '../../shared/services/student.service';
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
  get students() { return this.store.students; }
  get me() { return this.store.currentUser; }
  selectedId: string | null = null;
  selectedStudent = computed(() => this.selectedId ? this.students().find(s => s.id === this.selectedId!) : undefined);
  myStudentId = computed(() => this.me()?.studentId ?? null);
  isApproved = computed(() => !!this.selectedStudent()?.approved);
  private lockSelection: any;
  // tabs
  currentTab: 'overview'|'applications'|'evidence'|'logs'|'reports'|'assignments'|'complaints'|'marks' = 'overview';
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
  approval = {
    studentInfo: { name: '', studentId: '', program: '', semester: '' },
    company: { name: '', address: '', supervisorName: '', supervisorEmail: '', supervisorPhone: '' },
    internship: { startDate: '', endDate: '', hoursPerWeek: 40, paid: 'No' as 'Yes'|'No' },
    objectives: '',
    outcomes: ''
  };
  agreement = {
    policyAcknowledgement: false,
    confidentialityAgreement: false,
    safetyTraining: false,
    studentSignatureName: '',
    date: ''
  };
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
  approvals = computed(() => this.selectedId ? (this.store.approvals()[this.selectedId] ?? []) : []);
  agreements = computed(() => this.selectedId ? (this.store.agreements()[this.selectedId] ?? []) : []);
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
  private hasSubmittedApproval(): boolean { return (this.approvals() ?? []).length > 0; }
  private hasSubmittedAgreement(): boolean { return (this.agreements() ?? []).length > 0; }
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  // complaints
  complaint = { category: 'Other' as 'Technical'|'Supervisor'|'Organization'|'Other', message: '' };
  myComplaints = () => {
    if (!this.selectedId) return [] as any[];
    return this.store.complaints().filter(c => c.studentId === this.selectedId);
  };
  
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private studentApi: StudentService) {
    this.lockSelection = effect(() => {
      const mine = this.myStudentId();
      if (mine && this.selectedId !== mine) this.selectedId = mine;
    });
    // Initialize tab from query params
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['overview','applications','evidence','logs','reports','assignments','complaints','marks'] as const;
        if ((allowed as readonly string[]).includes(t)) this.currentTab = t as any;
        // guard: if not approved, restrict to overview/applications/evidence/complaints
        const isOk = this.isApproved();
        const visibleWhenPending = new Set(['overview','applications','evidence','complaints']);
        if (!isOk && !visibleWhenPending.has(this.currentTab)) {
          this.currentTab = 'applications';
          try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'applications' }, queryParamsHandling: 'merge' }); } catch {}
        }
      });
    } catch {}
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
    internshipField: '', internshipLocation: '', startDate: '', endDate: '', workingDays: '', workingHours: ''
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
      const res = await this.studentApi.getMyCompanyRequests();
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
        workingDays: ax.workingDays || '', workingHours: ax.workingHours || ''
      };
    } catch {}
  }
  async submitAppExAFromForm() {
    try { await this.apiSubmitAppExA({ ...this.appexAForm }); } catch {}
  }
  async updateAppExAFromForm() {
    try { await this.apiUpdateAppExA({ ...this.appexAForm }); } catch {}
  }

  private isApprovalComplete(): boolean {
    const a = this.approval;
    const required = [
      a.studentInfo.name,
      a.studentInfo.studentId,
      a.studentInfo.program,
      a.studentInfo.semester,
      a.company.name,
      a.company.address,
      a.company.supervisorName,
      a.company.supervisorEmail,
      a.company.supervisorPhone,
      a.internship.startDate,
      a.internship.endDate,
      String(a.internship.hoursPerWeek || '') ,
      a.objectives,
      a.outcomes
    ];
    const allFilled = required.every(v => !!(v && (''+v).toString().trim().length));
    if (!allFilled) return false;
    // basic email/phone sanity checks
    const emailOk = /.+@.+\..+/.test(a.company.supervisorEmail.trim());
    const phoneOk = a.company.supervisorPhone.replace(/[^0-9]/g, '').length >= 7;
    const hoursOk = (a.internship.hoursPerWeek || 0) > 0;
    return emailOk && phoneOk && hoursOk;
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

  submitApproval() {
    if (!this.selectedId) return;
  if (!this.ensureMine()) return;
  if (!this.isApprovalComplete()) {
    this.toast.warning('Please complete all fields in Internship Offer & Approval (student info, company, supervisor, internship, objectives, outcomes) before submitting.');
    return;
  }
  this.store.submitApproval(this.selectedId, { ...this.approval });
  this.toast.success('Approval form submitted');
    this.approval = {
      studentInfo: { name: '', studentId: '', program: '', semester: '' },
      company: { name: '', address: '', supervisorName: '', supervisorEmail: '', supervisorPhone: '' },
      internship: { startDate: '', endDate: '', hoursPerWeek: 40, paid: 'No' },
      objectives: '', outcomes: ''
    };
  }
  submitAgreement() {
    if (!this.selectedId) return;
  if (!this.ensureMine()) return;
  this.store.submitAgreement(this.selectedId, { ...this.agreement });
  this.toast.success('Agreement submitted');
    this.agreement = { policyAcknowledgement: false, confidentialityAgreement: false, safetyTraining: false, studentSignatureName: '', date: '' };
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
  // allow editing by pre-filling from latest approval
  loadLatestApproval() {
    const list = this.approvals();
    if (!list.length) return;
    const a = list[list.length - 1];
    this.approval = {
      studentInfo: { ...a.studentInfo },
      company: { ...a.company },
      internship: { ...a.internship },
      objectives: a.objectives,
      outcomes: a.outcomes
    };
  }
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
