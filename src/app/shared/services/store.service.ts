import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { AdminService } from './admin.service';

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

  constructor(private http: HttpClient, private adminService: AdminService) {
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

  // Announcements (Office) - with API integration
  async addAnnouncement(message: string, title?: string, link?: string, pinned?: boolean) {
    try {
      // Call API to create announcement
      const response = await this.adminService.createAnnouncement({ message, title, link, pinned });
      const createdAnnouncement = response.announcement || {
        id: response.id || crypto.randomUUID(),
        message,
        title,
        link,
        pinned,
        createdAt: new Date().toISOString()
      };
      
      // Update local state
      this.announcements.update(arr => [createdAnnouncement, ...arr]);
      this.persist();
      return createdAnnouncement;
    } catch (error) {
      console.error('Failed to create announcement via API, using local storage:', error);
      // Fallback to local storage
      const a: Announcement = { id: crypto.randomUUID(), message, title, link, pinned, createdAt: new Date().toISOString() };
      this.announcements.update(arr => [a, ...arr]);
      this.persist();
      return a;
    }
  }

  async updateAnnouncement(id: string, changes: Partial<Announcement>) {
    try {
      // Get the current announcement to construct full payload
      const current = this.announcements().find(a => a.id === id);
      if (!current) throw new Error('Announcement not found');
      
      // Call API to update announcement with id in payload
      await this.adminService.updateAnnouncement({
        id,
        title: changes.title ?? current.title ?? '',
        message: changes.message ?? current.message ?? '',
        link: changes.link ?? current.link ?? '',
        pinned: changes.pinned ?? current.pinned ?? false
      });
      
      // Update local state
      this.announcements.update(arr => arr.map(x => x.id === id ? { ...x, ...changes } : x));
      this.persist();
    } catch (error) {
      console.error('Failed to update announcement via API, using local storage:', error);
      // Fallback to local storage
      this.announcements.update(arr => arr.map(x => x.id === id ? { ...x, ...changes } : x));
      this.persist();
    }
  }

  async removeAnnouncement(id: string) {
    try {
      // Call API to delete announcement
      await this.adminService.deleteAnnouncement(id);
      
      // Update local state
      this.announcements.update(arr => arr.filter(x => x.id !== id));
      this.persist();
    } catch (error) {
      console.error('Failed to remove announcement via API, using local storage:', error);
      // Fallback to local storage
      this.announcements.update(arr => arr.filter(x => x.id !== id));
      this.persist();
    }
  }

  async loadAnnouncements() {
    try {
      // Fetch announcements from API
      const announcements = await this.adminService.getAnnouncements();
      this.announcements.set(announcements);
      this.persist();
      return announcements;
    } catch (error) {
      console.error('Failed to load announcements from API:', error);
      // Continue using local announcements
      return this.announcements();
    }
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
  
  submitAppexA(studentId: string, requestConfig: any) {
    // Extract auth token and payload from config
    const { payload, authToken, studentId: configStudentId } = requestConfig;
    
    try {
      if (!authToken) {
        throw new Error('Authentication required: Auth token missing');
      }

      if (!payload) {
        throw new Error('Payload is required');
      }

      // Validate required fields before sending
      const requiredFields = [
        'organization', 'address', 'industrySector', 'contactName',
        'contactDesignation', 'contactPhone', 'contactEmail',
        'internshipLocation', 'internshipNature', 'mode', 'numberOfInternship',
        'startDate', 'endDate', 'workingDays', 'workingHours'
      ];

      const missingFields = requiredFields.filter(field => {
        const value = payload[field];
        return value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '');
      });

      if (missingFields.length > 0) {
        throw new Error(`Missing or empty required fields: ${missingFields.join(', ')}`);
      }

      // Validate date format and logic
      try {
        const startDate = new Date(payload.startDate);
        const endDate = new Date(payload.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format. Use YYYY-MM-DD');
        }
        if (startDate >= endDate) {
          throw new Error('Start date must be before end date');
        }
      } catch (dateErr: any) {
        throw new Error(`Date validation error: ${dateErr.message}`);
      }

      // Validate numberOfInternship is a positive number
      const numInternship = Number(payload.numberOfInternship);
      if (isNaN(numInternship) || numInternship < 1) {
        throw new Error('Number of Internship must be a positive number');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.contactEmail)) {
        throw new Error('Invalid contact email format');
      }

      const appexAPayload = {
        ...payload,
        numberOfInternship: numInternship
      };
      
      // Build Authorization header
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      });

      // Get API base URL from environment
      const apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
      const apiUrl = `${apiBaseUrl}/api/student/appex-a`;

      console.log('[Store] Submitting AppEx A to:', apiUrl);
      console.log('[Store] Payload:', JSON.stringify(appexAPayload, null, 2));
      console.log('[Store] Auth Token present:', !!authToken);

      // Make actual HTTP POST request to backend and return the observable
      const request$ = this.http.post<any>(apiUrl, appexAPayload, { headers });

      // Return an object containing the observable for the component to subscribe
      return {
        success: true,
        message: 'AppEx A submission initiated',
        studentId: configStudentId || studentId,
        observable: request$
      };
    } catch (err: any) {
      console.error('[Store] ✗ Error preparing AppEx A submission:', err.message);
      console.error('[Store] Full error:', err);
      throw err;
    }
  }

  submitAppexB(studentId: string, requestConfig: any) {
    // Extract auth token and payload from config
    const { payload, authToken, studentId: configStudentId } = requestConfig;
    
    try {
      if (!authToken) {
        throw new Error('Authentication required: Auth token missing');
      }

      if (!payload) {
        throw new Error('Payload is required');
      }

      // Validate required fields before sending
      const requiredFields = [
        'name', 'degreeProgram', 'email', 'semester', 'contactNo', 'preferredField'
      ];

      const missingFields = requiredFields.filter(field => {
        const value = payload[field];
        return value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '');
      });

      if (missingFields.length > 0) {
        throw new Error(`Missing or empty required fields: ${missingFields.join(', ')}`);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        throw new Error('Invalid email format');
      }

      // Validate agreement acceptance
      if (!payload.agreementAccepted) {
        throw new Error('Agreement must be accepted');
      }

      const appexBPayload = {
        name: payload.name,
        degreeProgram: payload.degreeProgram,
        email: payload.email,
        semester: payload.semester,
        contactNo: payload.contactNo,
        preferredField: payload.preferredField,
        agreementAccepted: !!payload.agreementAccepted
      };
      
      // Build Authorization header
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      });

      // Get API base URL from environment
      const apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
      const apiUrl = `${apiBaseUrl}/api/student/appex-b`;

      console.log('[Store] Submitting AppEx B to:', apiUrl);
      console.log('[Store] Payload:', JSON.stringify(appexBPayload, null, 2));
      console.log('[Store] Auth Token present:', !!authToken);

      // Make actual HTTP POST request to backend and return the observable
      const request$ = this.http.post<any>(apiUrl, appexBPayload, { headers });

      // Return an object containing the observable for the component to subscribe
      return {
        success: true,
        message: 'AppEx B submission initiated',
        studentId: configStudentId || studentId,
        observable: request$
      };
    } catch (err: any) {
      console.error('[Store] ✗ Error preparing AppEx B submission:', err.message);
      console.error('[Store] Full error:', err);
      throw err;
    }
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
