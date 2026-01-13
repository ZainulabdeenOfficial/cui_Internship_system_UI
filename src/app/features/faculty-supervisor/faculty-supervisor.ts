import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatePipe } from '../../shared/pagination/paginate.pipe';
import { PaginatorComponent } from '../../shared/pagination/paginator';
import { FacultyService, FacultyProfile } from '../../shared/services/faculty.service';

@Component({
  selector: 'app-faculty-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatePipe, PaginatorComponent],
  templateUrl: './faculty-supervisor.html',
  styleUrl: './faculty-supervisor.css'
})
export class FacultySupervisor {
  constructor(private store: StoreService, private toast: ToastService, private route: ActivatedRoute, private router: Router, private facultyApi: FacultyService) {
    try {
      this.route.queryParamMap.subscribe(p => {
        const t = (p.get('tab') || '').toLowerCase();
        const allowed = ['students','details','reports','assignments','agreements','profile'] as const;
        if ((allowed as readonly string[]).includes(t)) {
          this.currentTab = t as any;
          if (this.currentTab === 'profile') this.loadMyProfileFromApi();
        }
      });
    } catch {}
  }
  get students() { return this.store.students; }
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  get companyList() { return this.store.companies; }
  selectedId: string | null = null;
  currentTab: 'students'|'details'|'reports'|'assignments'|'agreements'|'profile' = 'students';
  page = { students: 1 };
  pageSize = 10;
  selectTab(tab: FacultySupervisor['currentTab']) {
    this.currentTab = tab;
    try { this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' }); } catch {}
    if (tab === 'profile') this.loadMyProfileFromApi();
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
  async loadMyProfileFromApi() {
    if (this.loadingProfile) return;
    this.loadingProfile = true;
    try {
      const res = await this.facultyApi.getProfile();
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
}
