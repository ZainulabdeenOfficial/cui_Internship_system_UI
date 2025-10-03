import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router) {
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','applications','requests','announcements','officers','faculty','companies','compliance','complaints','scheme'] as const;
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
  facultyId = '';
  siteId = '';
  selectedId: string | null = null;
  currentTab: 'students'|'applications'|'requests'|'announcements'|'officers'|'faculty'|'companies'|'compliance'|'complaints'|'scheme' = 'students';
  // pagination
  page = { students: 1, requests: 1, complaints: 1, faculty: 1, sites: 1, companies: 1, announcements: 1 };
  pageSize = 10;
  selectTab(tab: Admin['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
  }
  get officers() { return this.store.internshipOfficers; }
  officer = { name: '', email: '' };
  responses: Record<string, string> = {};
  // forms for adding supervisors/company
  faculty = { name: '', email: '', department: '', password: '' };
  company = { name: '', address: '' };
  site = { name: '', email: '', companyId: '', password: '' };
  // assign company
  companyForStudent: Record<string, string> = {};
  // password reset buffers
  facultyNewPw: Record<string, string> = {};
  siteNewPw: Record<string, string> = {};
  // announcements
  announcement = { title: '', message: '', link: '', pinned: false };
  get announcements() { return this.store.announcements; }

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
  addFaculty() {
    const name = this.faculty.name?.trim();
    const email = this.faculty.email?.trim();
    const dept = this.faculty.department?.trim();
    const pass = this.faculty.password?.trim();
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    if (!pass) { this.toast.warning('Set a temporary password for the faculty supervisor'); return; }
    this.store.addFacultySupervisor(name, email, dept, pass);
    this.faculty = { name: '', email: '', department: '', password: '' };
    this.toast.success('Faculty Supervisor added');
  }
  addCompany() {
    if (!this.company.name) return;
    const cid = this.store.addCompany(this.company.name, this.company.address);
    if (this.site.companyId === '') this.site.companyId = cid;
    this.company = { name: '', address: '' };
    this.toast.success('Company added');
  }
  addSite() {
    const name = this.site.name?.trim();
    const email = this.site.email?.trim();
    const cid = this.site.companyId?.trim();
    const pass = this.site.password?.trim();
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    if (!pass) { this.toast.warning('Set a temporary password for the site supervisor'); return; }
    this.store.addSiteSupervisor(name, email, cid || undefined, pass);
    this.site = { name: '', email: '', companyId: '', password: '' };
    this.toast.success('Site Supervisor added');
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
  facultyName(id: string) {
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
