import { Injectable, signal } from '@angular/core';

export type WeeklyLog = { id: string; week: number; note: string; date: string };
export type Report = { id: string; type: 'proposal'|'progress'|'final'|'mid'|'site-final'|'reflective'; title: string; content: string; date: string; score?: number; approved?: boolean };
export type StudentProfile = { id: string; name: string; email: string; registrationNo?: string; password?: string; avatarBase64?: string; bio?: string; approved?: boolean; facultyId?: string; siteId?: string; companyId?: string; internshipMode?: 'OnSite'|'Virtual'|'Fiverr'|'Upwork'; marks?: { faculty?: number; admin?: number; site?: number; adminProposal?: number; adminLogs?: number; adminFinal?: number } };
export type Role = 'student'|'admin'|'faculty'|'site'|'site_supervisor';

// Public announcements displayed on Home page (managed by Internship Office)
export type Announcement = {
  id: string;
  message: string;
  title?: string;
  link?: string;
  pinned?: boolean;
  createdAt: string;
};

// Additional forms
export type ApprovalForm = {
  id: string;
  studentInfo: { name: string; studentId: string; program: string; semester: string };
  company: { name: string; address: string; supervisorName: string; supervisorEmail: string; supervisorPhone: string };
  internship: { startDate: string; endDate: string; hoursPerWeek: number; paid: 'Yes'|'No' };
  objectives: string;
  outcomes: string;
  createdAt: string;
  status?: 'pending'|'approved'|'rejected';
  officerComment?: string;
  resolvedAt?: string;
  version?: number;
};
export type Agreement = {
  id: string;
  policyAcknowledgement: boolean;
  confidentialityAgreement: boolean;
  safetyTraining: boolean;
  studentSignatureName: string;
  date: string;
  createdAt: string;
  facultySignatureName?: string;
  facultySignedAt?: string;
  officeSignatureName?: string;
  officeSignedAt?: string;
};
export type Evaluation = {
  id: string;
  role: 'faculty'|'site'|'admin';
  period: 'mid'|'final'|'overall';
  criteria: Record<string, number>;
  comments: string;
  total: number;
  createdAt: string;
};
export type FreelanceRecord = {
  id: string;
  platform: 'Fiverr'|'Upwork'|'OnSite'|'Virtual';
  profileAuthentic?: boolean;
  proposalsApplied?: number; // Upwork
  gigsCompleted?: number; // Fiverr
  earningsUSD?: number;
  avgRating?: number;
  clientFeedback?: string;
  approvalEvidence?: string; // text summary/identifier
  contractSummary?: string;
  workSummary?: string; // description of delivered work
  mentorName?: string;
  mentorContact?: string;
  technologies?: string;
  logbook?: string;
  createdAt: string;
  status?: 'pending'|'approved'|'rejected';
  officerComment?: string;
  resolvedAt?: string;
};

export type Complaint = {
  id: string;
  studentId: string;
  category: 'Technical'|'Supervisor'|'Organization'|'Other';
  message: string;
  status: 'open'|'resolved';
  response?: string;
  createdAt: string;
  resolvedAt?: string;
};

// Requests from Faculty to Internship Office
export type RequestStatus = 'pending'|'approved'|'rejected';
export type BaseRequest = { id: string; type: 'company'|'site'; status: RequestStatus; requestedByFacultyId: string; responseNote?: string; createdAt: string; resolvedAt?: string };
export type CompanyRequest = BaseRequest & { type: 'company'; name: string; address?: string; createdCompanyId?: string };
export type SiteSupervisorRequest = BaseRequest & { type: 'site'; name: string; email: string; companyId?: string; companyName?: string; createdSiteId?: string; createdCompanyId?: string };
export type RequestItem = CompanyRequest | SiteSupervisorRequest;

export type FacultySupervisor = { id: string; name: string; email: string; department?: string; password?: string; avatarBase64?: string; bio?: string };
export type Company = { id: string; name: string; address?: string; email?: string; phone?: string; website?: string; industry?: string; description?: string; remoteId?: string };
export type SiteSupervisor = { id: string; name: string; email: string; companyId?: string; password?: string; avatarBase64?: string; bio?: string };

// Internship Design Statement (submitted in first week along with initial progress)
export type DesignStatement = {
  id: string;
  careerGoal: string;
  learningObjectives: string;
  placement: { organization: string; mode: 'On-site'|'Remote'|'Hybrid'; functionalArea: string; overview?: string };
  supervisor: { name: string; designation: string; email: string; contact: string };
  scopeAndDeliverables: string; // tasks, tools, platforms, technologies
  academicPreparation: string; // relevant coursework/projects
  comments?: string;
  createdAt: string;
};

// Assignment uploads (any file types). Content stored as base64 for demo persistence.
export type Assignment = {
  id: string;
  title?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  contentBase64: string; // caution: localStorage size limits
  uploadedAt: string;
  facultyMark?: number; // mark set by faculty for this assignment
};

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  students = signal<StudentProfile[]>(load('students', []));
  logs = signal<Record<string, WeeklyLog[]>>(load('logs', {}));
  reports = signal<Record<string, Report[]>>(load('reports', {}));
  currentStudentId = signal<string | null>(load('currentStudentId', null));
  currentUser = signal<{ role: Role; studentId?: string; facultyId?: string; siteId?: string } | null>(load('currentUser', null));
  approvals = signal<Record<string, ApprovalForm[]>>(load('approvals', {}));
  agreements = signal<Record<string, Agreement[]>>(load('agreements', {}));
  evaluations = signal<Record<string, Evaluation[]>>(load('evaluations', {}));
  freelance = signal<Record<string, FreelanceRecord[]>>(load('freelance', {}));
  internshipOfficers = signal<{ id: string; name: string; email: string }[]>(load('officers', []));
  complaints = signal<Complaint[]>(load('complaints', []));
  facultySupervisors = signal<FacultySupervisor[]>(load('facultySupervisors', []));
  companies = signal<Company[]>(load('companies', []));
  siteSupervisors = signal<SiteSupervisor[]>(load('siteSupervisors', []));
  requests = signal<RequestItem[]>(load('requests', []));
  designStatements = signal<Record<string, DesignStatement[]>>(load('designStatements', {}));
  assignments = signal<Record<string, Assignment[]>>(load('assignments', {}));
  announcements = signal<Announcement[]>(load('announcements', []));
  adminProfile = signal<{ email?: string; username?: string; password: string; name?: string; avatarBase64?: string; bio?: string }>(
    load('adminProfile', { email: 'office@cuisahiwal.edu.pk', password: 'admin123', name: 'Internship Office' })
  );

  private persist() {
    save('students', this.students());
    save('logs', this.logs());
    save('reports', this.reports());
    save('currentStudentId', this.currentStudentId());
    save('currentUser', this.currentUser());
    save('approvals', this.approvals());
    save('agreements', this.agreements());
    save('evaluations', this.evaluations());
    save('freelance', this.freelance());
    save('officers', this.internshipOfficers());
    save('complaints', this.complaints());
    save('facultySupervisors', this.facultySupervisors());
    save('companies', this.companies());
    save('siteSupervisors', this.siteSupervisors());
    save('requests', this.requests());
    save('designStatements', this.designStatements());
    save('assignments', this.assignments());
    save('announcements', this.announcements());
    save('adminProfile', this.adminProfile());
  }

  constructor() {
    // Seed requested sample faculty supervisor if none exists
    try {
      if (this.facultySupervisors().length === 0) {
        const exists = this.facultySupervisors().some(f => f.email.toLowerCase() === 'zu4425@gmail.com');
        if (!exists) {
          this.addFacultySupervisor('zain1234', 'zu4425@gmail.com', undefined, 'zain1234');
        }
      }
    } catch {}
  }
  updateStudent(id: string, changes: Partial<StudentProfile>) {
    this.students.update(a => a.map(s => s.id === id ? { ...s, ...changes } : s));
    this.persist();
  }

  // Announcements (Office)
  addAnnouncement(message: string, title?: string, link?: string, pinned?: boolean) {
    const a: Announcement = { id: crypto.randomUUID(), message, title, link, pinned, createdAt: new Date().toISOString() };
    this.announcements.update(arr => [a, ...arr]);
    this.persist();
    return a;
  }
  updateAnnouncement(id: string, changes: Partial<Announcement>) {
    this.announcements.update(arr => arr.map(x => x.id === id ? { ...x, ...changes } : x));
    this.persist();
  }
  removeAnnouncement(id: string) {
    this.announcements.update(arr => arr.filter(x => x.id !== id));
    this.persist();
  }

  // Student actions
  createStudent(profile: Omit<StudentProfile, 'id'>) {
    const id = crypto.randomUUID();
    const s: StudentProfile = { id, ...profile };
    this.students.update(a => [...a, s]);
    this.persist();
    return s;
  }
  addInternshipOfficer(name: string, email: string) {
    const id = crypto.randomUUID();
    this.internshipOfficers.update(a => [...a, { id, name, email }]);
    this.persist();
  }
  updateInternshipOfficer(id: string, changes: Partial<{ name: string; email: string }>) {
    this.internshipOfficers.update(a => a.map(o => o.id === id ? { ...o, ...changes } : o));
    this.persist();
  }
  removeInternshipOfficer(id: string) {
    this.internshipOfficers.update(a => a.filter(o => o.id !== id));
    this.persist();
  }
  addFacultySupervisor(name: string, email: string, department?: string, password?: string) {
    const id = crypto.randomUUID();
    this.facultySupervisors.update(a => [...a, { id, name, email, department, password }]);
    this.persist();
  }
  addCompany(name: string, address?: string, extras?: { email?: string; phone?: string; website?: string; industry?: string; description?: string; remoteId?: string }) {
    const id = crypto.randomUUID();
    this.companies.update(a => [...a, { id, name, address, ...(extras || {}) }]);
    this.persist();
    return id;
  }
  addSiteSupervisor(name: string, email: string, companyId?: string, password?: string) {
    const id = crypto.randomUUID();
    this.siteSupervisors.update(a => [...a, { id, name, email, companyId, password }]);
    this.persist();
    return id;
  }

  // Supervisor logins
  loginFaculty(email: string, password: string) {
    const f = this.facultySupervisors().find(u => u.email.toLowerCase() === email.toLowerCase() && (u.password ?? '') === password);
    if (!f) throw new Error('Invalid faculty credentials');
    this.currentUser.set({ role: 'faculty', facultyId: f.id });
    this.currentStudentId.set(null);
    this.persist();
    return f;
  }

  // Faculty requests
  requestAddCompany(requestedByFacultyId: string, name: string, address?: string) {
    const r: CompanyRequest = { id: crypto.randomUUID(), type: 'company', status: 'pending', requestedByFacultyId, name, address, createdAt: new Date().toISOString() };
    this.requests.update(a => [r, ...a]);
    this.persist();
    return r;
  }
  requestAddSiteSupervisor(requestedByFacultyId: string, name: string, email: string, companyId?: string, companyName?: string) {
    const r: SiteSupervisorRequest = { id: crypto.randomUUID(), type: 'site', status: 'pending', requestedByFacultyId, name, email, companyId, companyName, createdAt: new Date().toISOString() };
    this.requests.update(a => [r, ...a]);
    this.persist();
    return r;
  }
  approveRequest(id: string) {
    const items = this.requests();
    const idx = items.findIndex(x => x.id === id && x.status === 'pending');
    if (idx === -1) return;
    const req = items[idx];
    if (req.type === 'company') {
      const compId = this.addCompany(req.name, req.address);
      const updated: CompanyRequest = { ...req, status: 'approved', createdCompanyId: compId, resolvedAt: new Date().toISOString() };
      this.requests.update(a => a.map(x => x.id === id ? updated : x));
    } else if (req.type === 'site') {
      let compId = req.companyId;
      if (!compId && req.companyName) {
        const existing = this.companies().find(c => c.name.toLowerCase() === req.companyName!.toLowerCase());
        compId = existing?.id || this.addCompany(req.companyName!);
      }
      const siteId = this.addSiteSupervisor(req.name, req.email, compId);
      const updated: SiteSupervisorRequest = { ...req, status: 'approved', createdSiteId: siteId, createdCompanyId: compId, resolvedAt: new Date().toISOString() };
      this.requests.update(a => a.map(x => x.id === id ? updated : x));
    }
    this.persist();
  }
  rejectRequest(id: string, responseNote?: string) {
    const now = new Date().toISOString();
    this.requests.update(a => a.map(x => x.id === id && x.status === 'pending' ? { ...x, status: 'rejected', responseNote, resolvedAt: now } : x));
    this.persist();
  }
  loginSite(email: string, password: string) {
    const s = this.siteSupervisors().find(u => u.email.toLowerCase() === email.toLowerCase() && (u.password ?? '') === password);
    if (!s) throw new Error('Invalid site supervisor credentials');
    this.currentUser.set({ role: 'site_supervisor', siteId: s.id });
    this.currentStudentId.set(null);
    this.persist();
    return s;
  }
  // Admin login using adminProfile state (email + password). Supports legacy username for backward compatibility.
  loginAdmin(email: string, password: string) {
    const p = this.adminProfile();
    const emailLower = (email ?? '').toLowerCase();
    const matchesEmail = (p.email ?? '').toLowerCase() === emailLower;
    const matchesLegacyUsername = (p.username ?? '') === email; // fallback if profile was previously username-based
    const ok = (matchesEmail || matchesLegacyUsername) && (p.password ?? '') === password;
    if (!ok) throw new Error('Invalid admin credentials');
    this.currentUser.set({ role: 'admin' });
    this.currentStudentId.set(null);
    this.persist();
    return { email: p.email, name: p.name };
  }
  signup(name: string, email: string, password: string, registrationNo: string) {
    const exists = this.students().some(s => s.email.toLowerCase() === email.toLowerCase());
    if (exists) throw new Error('Email already registered');
    // Validate registration number and email domain
    const regPattern = /^FA\d{2}-[A-Z]{2,}-\d{3}$/; // e.g., FA23-BCS-090
    if (!regPattern.test(registrationNo)) throw new Error('Registration No must match FAyy-PROGRAM-ROLL (e.g., FA22-BCS-090)');
    const allowedDomains = ['@sahiwal.comsats.edu.pk', '@cuisahiwal.edu.pk', '@students.cuisahiwal.edu.pk'];
    const lower = email.toLowerCase();
    if (!allowedDomains.some(d => lower.endsWith(d))) throw new Error('Use your CUI Sahiwal email (e.g., fa22-bcs-090@students.cuisahiwal.edu.pk)');
    // If using students.cuisahiwal.edu.pk, enforce local-part matches registration no in lowercase
    if (lower.endsWith('@students.cuisahiwal.edu.pk')) {
      const localPart = lower.split('@')[0];
      const expected = registrationNo.toLowerCase();
      if (localPart !== expected) {
        throw new Error('Email local part must match your Registration No (e.g., FA22-BCS-090 -> fa22-bcs-090@students.cuisahiwal.edu.pk)');
      }
    }
    const s = this.createStudent({ name, email, password, registrationNo });
    this.currentStudentId.set(s.id);
    this.currentUser.set({ role: 'student', studentId: s.id });
    this.persist();
    return s;
  }
  login(email: string, password: string) {
    const s = this.students().find(u => u.email.toLowerCase() === email.toLowerCase() && (u.password ?? '') === password);
    if (!s) throw new Error('Invalid credentials');
    this.currentStudentId.set(s.id);
    this.currentUser.set({ role: 'student', studentId: s.id });
    this.persist();
    return s;
  }
  changeStudentPassword(id: string, oldPassword: string, newPassword: string) {
    const s = this.students().find(x => x.id === id);
    if (!s) throw new Error('Student not found');
    if ((s.password ?? '') !== oldPassword) throw new Error('Old password is incorrect');
    this.updateStudent(id, { password: newPassword });
  }
  loginAsRole(role: Role) {
    // For demo purposes, allow non-student roles without identities
    this.currentUser.set({ role });
    this.currentStudentId.set(null);
    this.persist();
  }
  logout() { this.currentStudentId.set(null); this.currentUser.set(null); this.persist(); }
  submitWeeklyLog(studentId: string, log: Omit<WeeklyLog, 'id'|'date'>) {
    const entry: WeeklyLog = { id: crypto.randomUUID(), date: new Date().toISOString(), ...log };
    this.logs.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  submitReport(studentId: string, report: Omit<Report, 'id'|'date'>) {
    const entry: Report = { id: crypto.randomUUID(), date: new Date().toISOString(), ...report };
    this.reports.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  setReportScore(studentId: string, reportId: string, score: number) {
    const list = this.reports()[studentId] ?? [];
    const updated = list.map(r => r.id === reportId ? { ...r, score } : r);
    this.reports.update(m => ({ ...m, [studentId]: updated }));
    this.persist();
  }
  setReportApproved(studentId: string, reportId: string, approved: boolean) {
    const list = this.reports()[studentId] ?? [];
    const updated = list.map(r => r.id === reportId ? { ...r, approved } : r);
    this.reports.update(m => ({ ...m, [studentId]: updated }));
    this.persist();
  }
  submitApproval(studentId: string, form: Omit<ApprovalForm, 'id'|'createdAt'>) {
    const current = this.approvals()[studentId] ?? [];
    const version = (current[current.length - 1]?.version ?? 0) + 1;
    const entry: ApprovalForm = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending', version, ...form };
    this.approvals.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  reviewApproval(studentId: string, decision: 'approved'|'rejected', officerComment?: string) {
    const list = this.approvals()[studentId] ?? [];
    if (!list.length) return;
    const last = list[list.length - 1];
    const updated: ApprovalForm = { ...last, status: decision, officerComment, resolvedAt: new Date().toISOString() };
    this.approvals.update(m => ({ ...m, [studentId]: [...list.slice(0, -1), updated] }));
    if (decision === 'approved') {
      // mark student as approved for internship
      this.students.update(a => a.map(s => s.id === studentId ? { ...s, approved: true } : s));
    }
    this.persist();
    return updated;
  }

  // Assignment operations
  submitAssignment(studentId: string, a: { title?: string; fileName: string; fileType: string; fileSize: number; contentBase64: string }) {
    const entry: Assignment = { id: crypto.randomUUID(), uploadedAt: new Date().toISOString(), ...a };
    this.assignments.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  setAssignmentFacultyMark(studentId: string, assignmentId: string, mark: number) {
    const list = this.assignments()[studentId] ?? [];
    const updated = list.map(x => x.id === assignmentId ? { ...x, facultyMark: mark } : x);
    this.assignments.update(m => ({ ...m, [studentId]: updated }));
    this.persist();
  }
  submitAgreement(studentId: string, form: Omit<Agreement, 'id'|'createdAt'>) {
    const entry: Agreement = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...form };
    this.agreements.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  signAgreementByFaculty(studentId: string, signerName: string) {
    const list = this.agreements()[studentId] ?? [];
    if (list.length === 0) return;
    const last = list[list.length - 1];
    const updated: Agreement = { ...last, facultySignatureName: signerName, facultySignedAt: new Date().toISOString() };
    this.agreements.update(m => ({ ...m, [studentId]: [...list.slice(0, -1), updated] }));
    this.persist();
    return updated;
  }
  signAgreementByOffice(studentId: string, signerName: string) {
    const list = this.agreements()[studentId] ?? [];
    if (list.length === 0) return;
    const last = list[list.length - 1];
    const updated: Agreement = { ...last, officeSignatureName: signerName, officeSignedAt: new Date().toISOString() };
    this.agreements.update(m => ({ ...m, [studentId]: [...list.slice(0, -1), updated] }));
    this.persist();
    return updated;
  }
  submitEvaluation(studentId: string, form: Omit<Evaluation, 'id'|'createdAt'>) {
    const entry: Evaluation = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...form };
    this.evaluations.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }
  submitFreelance(studentId: string, rec: Omit<FreelanceRecord, 'id'|'createdAt'>) {
    const entry: FreelanceRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending', ...rec };
    this.freelance.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    // set student's internship mode based on entry
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, internshipMode: entry.platform } : s));
    this.persist();
    return entry;
  }
  reviewFreelance(studentId: string, recordId: string, decision: 'approved'|'rejected', officerComment?: string) {
    const list = this.freelance()[studentId] ?? [];
    const now = new Date().toISOString();
    const updated = list.map(r => r.id === recordId ? { ...r, status: decision, officerComment, resolvedAt: now } : r);
    this.freelance.update(m => ({ ...m, [studentId]: updated }));
    this.persist();
  }
  submitDesignStatement(studentId: string, ds: Omit<DesignStatement, 'id'|'createdAt'>) {
    const entry: DesignStatement = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...ds };
    this.designStatements.update(m => ({ ...m, [studentId]: [...(m[studentId] ?? []), entry] }));
    this.persist();
    return entry;
  }

  // Admin actions
  approveStudent(studentId: string) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, approved: true } : s));
    this.persist();
  }
  assignSupervisors(studentId: string, facultyId: string, siteId: string) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, facultyId, siteId } : s));
    this.persist();
  }
  setAdminMarks(studentId: string, admin: number) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, marks: { ...s.marks, admin } } : s));
    this.persist();
  }
  setAdminSubMarks(studentId: string, proposal: number, logs: number, final: number) {
    const sum = (proposal || 0) + (logs || 0) + (final || 0);
    // Scale depending on internship mode: freelancing -> 40 (double), on-site/virtual -> 20
    const st = this.students().find(s => s.id === studentId);
    const isFreelance = st?.internshipMode === 'Fiverr' || st?.internshipMode === 'Upwork';
    const admin = isFreelance ? sum * 2 : sum;
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, marks: { ...s.marks, admin, adminProposal: proposal, adminLogs: logs, adminFinal: final } } : s));
    this.persist();
  }

  // Faculty actions
  setFacultyMarks(studentId: string, faculty: number) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, marks: { ...s.marks, faculty } } : s));
    this.persist();
  }

  // Site actions
  setSiteMarks(studentId: string, site: number) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, marks: { ...s.marks, site } } : s));
    this.persist();
  }
  assignCompany(studentId: string, companyId: string) {
    this.students.update(a => a.map(s => s.id === studentId ? { ...s, companyId } : s));
    this.persist();
  }

  // Complaints & Grievances
  submitComplaint(studentId: string, category: Complaint['category'], message: string) {
    const c: Complaint = { id: crypto.randomUUID(), studentId, category, message, status: 'open', createdAt: new Date().toISOString() };
    this.complaints.update(a => [c, ...a]);
    this.persist();
    return c;
  }
  resolveComplaint(id: string, response: string) {
    const now = new Date().toISOString();
    this.complaints.update(a => a.map(c => c.id === id ? { ...c, status: 'resolved', response, resolvedAt: now } : c));
    this.persist();
  }

  // Removal operations
  removeFacultySupervisor(id: string) {
    this.facultySupervisors.update(a => a.filter(f => f.id !== id));
    // clear from students
    this.students.update(a => a.map(s => s.facultyId === id ? { ...s, facultyId: undefined } : s));
    this.persist();
  }
  removeSiteSupervisor(id: string) {
    this.siteSupervisors.update(a => a.filter(sup => sup.id !== id));
    this.students.update(a => a.map(s => s.siteId === id ? { ...s, siteId: undefined } : s));
    this.persist();
  }
  removeCompany(id: string) {
    this.companies.update(a => a.filter(c => c.id !== id));
    // clear company from site supervisors and students
    this.siteSupervisors.update(a => a.map(sup => sup.companyId === id ? { ...sup, companyId: undefined } : sup));
    this.students.update(a => a.map(s => s.companyId === id ? { ...s, companyId: undefined } : s));
    this.persist();
  }
  updateFacultySupervisor(id: string, changes: Partial<FacultySupervisor>) {
    this.facultySupervisors.update(a => a.map(f => f.id === id ? { ...f, ...changes } : f));
    this.persist();
  }
  updateCompany(id: string, changes: Partial<Company>) {
    this.companies.update(a => a.map(c => c.id === id ? { ...c, ...changes } : c));
    this.persist();
  }
  updateSiteSupervisor(id: string, changes: Partial<SiteSupervisor>) {
    this.siteSupervisors.update(a => a.map(s => s.id === id ? { ...s, ...changes } : s));
    this.persist();
  }
  updateAdminProfile(changes: Partial<{ email?: string; username?: string; password: string; name?: string; avatarBase64?: string; bio?: string }>) {
    this.adminProfile.update(p => ({ ...p, ...changes }));
    this.persist();
  }

  // Password updates
  changeFacultyPassword(id: string, oldPassword: string, newPassword: string) {
    const f = this.facultySupervisors().find(x => x.id === id);
    if (!f) throw new Error('Faculty not found');
    if ((f.password ?? '') !== oldPassword) throw new Error('Old password is incorrect');
    this.updateFacultySupervisor(id, { password: newPassword });
  }
  changeSitePassword(id: string, oldPassword: string, newPassword: string) {
    const s = this.siteSupervisors().find(x => x.id === id);
    if (!s) throw new Error('Site supervisor not found');
    if ((s.password ?? '') !== oldPassword) throw new Error('Old password is incorrect');
    this.updateSiteSupervisor(id, { password: newPassword });
  }
  changeAdminPassword(oldPassword: string, newPassword: string) {
    const p = this.adminProfile();
    if ((p.password ?? '') !== oldPassword) throw new Error('Old password is incorrect');
    this.updateAdminProfile({ password: newPassword });
  }
}

// Removal helpers (placed after class for clarity if needed)
