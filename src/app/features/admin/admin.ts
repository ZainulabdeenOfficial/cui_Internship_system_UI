import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { AdminService } from '../../shared/services/admin.service';
import { CreateAccountRequest } from '../../shared/models/admin/create-account.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private adminApi: AdminService) {
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','applications','requests','announcements','officers','faculty','companies','sites','compliance','complaints','scheme','evidence'] as const;
        if ((allowed as readonly string[]).includes(t)) this.currentTab = t as any;
      });
    } catch {}
  }
  get students() { return this.store.students; }
  get complaints() { return this.store.complaints; }
  get requests() { return this.store.requests; }
  get approvals() { return this.store.approvals; }
  get logsMap() { return this.store.logs; }
  get reportsMap() { return this.store.reports; }
  get agreementsMap() { return this.store.agreements; }
  get designStatementsMap() { return this.store.designStatements; }
  get assignmentsMap() { return this.store.assignments; }
  get freelanceMap() { return this.store.freelance; }
  get facultyList() { return this.store.facultySupervisors; }
  get companyList() { return this.store.companies; }
  get siteList() { return this.store.siteSupervisors; }
  // search/filter inputs
  search = { officers: '', faculty: '', companies: '', sites: '' };
  filter = { facultyDept: '', industry: '' };
  facultyId = '';
  siteId = '';
  selectedId: string | null = null;
  currentTab: 'students'|'applications'|'requests'|'announcements'|'officers'|'faculty'|'companies'|'sites'|'compliance'|'complaints'|'scheme'|'evidence' = 'students';
  // pagination
  page = { students: 1, requests: 1, complaints: 1, faculty: 1, sites: 1, companies: 1, announcements: 1, officers: 1 };
  pageSize = 10;
  selectTab(tab: Admin['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
  }
  get officers() { return this.store.internshipOfficers; }
  officer = { name: '', email: '' };
  responses: Record<string, string> = {};
  // create ADMIN account form (absolute API)
  adminAccount: { name: string; email: string; password: string } = { name: '', email: '', password: '' };
  creatingAdmin = false;
  // forms for adding supervisors/company
  faculty = { name: '', email: '', department: '', password: '' };
  company = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '' };
  site = { name: '', email: '', companyId: '', password: '' };
  // inline company edit buffers
  editingCompanyId: string | null = null;
  companyEdit: Partial<import('../../shared/services/store.service').Company> = {};
  // assign company
  companyForStudent: Record<string, string> = {};
  // password reset buffers
  facultyNewPw: Record<string, string> = {};
  siteNewPw: Record<string, string> = {};
  // announcements
  announcement = { title: '', message: '', link: '', pinned: false };
  get announcements() { return this.store.announcements; }
  // Evidence review state
  evidenceDecision: Record<string, 'approved'|'rejected'|''> = {};
  evidenceComment: Record<string, string> = {};
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
    const base = (name || '').toLowerCase().replace(/[^a-z0-9\s.]+/g, '').trim().replace(/\s+/g, '.');
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
  onOfficerNameBlur() {
    const name = (this.officer.name || '').trim();
    const email = (this.officer.email || '').trim();
    if (!email && name) {
      const taken = new Set(this.allEmails());
      this.officer.email = this.suggestEmail(name, this.uniDomain, taken);
    }
  }
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
    if (this.allEmails().includes(email.toLowerCase())) { this.toast.warning('Email already exists. Try a different one.'); return; }
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
  async addFaculty() {
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
    if (this.allEmails().includes(email.toLowerCase())) { this.toast.warning('Email already exists. Try a different one.'); return; }
    try {
      await this.adminApi.createAccount({ name, email, password: pass, role: 'FACULTY' } as any);
      this.store.addFacultySupervisor(name, email, dept, pass);
      this.faculty = { name: '', email: '', department: '', password: '' };
      this.toast.success('Faculty Supervisor added');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to add faculty supervisor';
      this.toast.danger(msg);
    }
  }
  onFacultyNameBlur() {
    const name = (this.faculty.name || '').trim();
    const email = (this.faculty.email || '').trim();
    if (!email && name) {
      const taken = new Set(this.allEmails());
      this.faculty.email = this.suggestEmail(name, this.uniDomain, taken);
    }
  }
  async addCompany() {
    const { name, email, phone, address, website, industry, description } = this.company;
    if (!name?.trim()) { this.toast.warning('Company name is required'); return; }
    if (!email?.trim()) { this.toast.warning('Company email is required'); return; }
    // Duplicate validation by name (case-insensitive)
    const exists = (this.companyList() || []).some(c => (c.name || '').trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) { this.toast.warning('This company is already listed'); return; }
    try {
  const res = await this.adminApi.addCompany({ name, email, phone, address, website, industry, description });
      // Also update local store for immediate UI feedback
  const cid = this.store.addCompany(name, address, { email, phone, website, industry, description, remoteId: res?.id });
      if (this.site.companyId === '') this.site.companyId = cid;
      this.company = { name: '', email: '', phone: '', address: '', website: '', industry: '', description: '' };
      this.toast.success(res?.message || 'Company added');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to add company';
      this.toast.danger(msg);
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
      // Attempt backend update if we have remoteId or name present
      await this.adminApi.updateCompany({ id: local.remoteId, name, email: changes.email, phone: changes.phone, address: changes.address, website: changes.website, industry: changes.industry, description: changes.description });
    } catch {}
    // Always update local store
    this.store.updateCompany(local.id, { ...changes, name });
    this.cancelEditCompany();
    this.toast.success('Company updated');
  }
  async addSite() {
    const name = this.site.name?.trim() || '';
    const email = this.site.email?.trim() || '';
    const cid = this.site.companyId?.trim() || '';
    const pass = this.site.password?.trim() || '';
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    if (!pass) { this.toast.warning('Set a temporary password for the site supervisor'); return; }
    // No domain restriction for site; still check duplicates
    if (this.allEmails().includes(email.toLowerCase())) { this.toast.warning('Email already exists. Try a different one.'); return; }
    try {
      await this.adminApi.createAccount({ name, email, password: pass, role: 'SITE' } as any);
      this.store.addSiteSupervisor(name, email, cid || undefined, pass);
      this.site = { name: '', email: '', companyId: '', password: '' };
      this.toast.success('Site Supervisor added');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to add site supervisor';
      this.toast.danger(msg);
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
    const s = this.students().find(x => x.id === id);
    return s ? `${s.name} (${s.email})` : id;
  }
  resolve(id: string) {
    const resp = this.responses[id];
    if (!resp) return;
    this.store.resolveComplaint(id, resp);
    delete this.responses[id];
    this.toast.success('Complaint resolved');
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
  facultyName(id?: string) {
    const f = this.facultyList().find(x => x.id === id);
    return f ? `${f.name} (${f.email})` : id;
  }
  siteSupervisorName(id?: string) {
    if (!id) return '-';
    const s = this.siteList().find(x => x.id === id);
    return s?.name ?? '-';
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
}
