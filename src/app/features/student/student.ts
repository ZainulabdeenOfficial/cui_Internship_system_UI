import { Component, computed, effect } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule],
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
  get facultyList() { return this.store.facultySupervisors; }
  get siteList() { return this.store.siteSupervisors; }
  // complaints
  complaint = { category: 'Other' as 'Technical'|'Supervisor'|'Organization'|'Other', message: '' };
  myComplaints = () => {
    if (!this.selectedId) return [] as any[];
    return this.store.complaints().filter(c => c.studentId === this.selectedId);
  };
  constructor(private store: StoreService, private toast: ToastService) {
    this.lockSelection = effect(() => {
      const mine = this.myStudentId();
      if (mine && this.selectedId !== mine) this.selectedId = mine;
    });
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
  this.store.submitFreelance(this.selectedId, { ...this.freel });
  this.toast.success('Evidence saved');
    this.freel = {
      platform: 'Fiverr', profileAuthentic: false, proposalsApplied: 0, gigsCompleted: 0, earningsUSD: 0,
      avgRating: 0, clientFeedback: '', approvalEvidence: '', contractSummary: '', workSummary: '',
      mentorName: '', mentorContact: '', technologies: '', logbook: ''
    };
  }

  submitApproval() {
    if (!this.selectedId) return;
  if (!this.ensureMine()) return;
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
