import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-faculty-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faculty-supervisor.html',
  styleUrl: './faculty-supervisor.css'
})
export class FacultySupervisor {
  constructor(private store: StoreService, private toast: ToastService) {}
  get students() { return this.store.students; }
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  get companyList() { return this.store.companies; }
  selectedId: string | null = null;
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
  updateMyProfile(changes: any) {
    const id = this.myFacultyId();
    if (!id) return;
    this.store.updateFacultySupervisor(id, changes);
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
}
