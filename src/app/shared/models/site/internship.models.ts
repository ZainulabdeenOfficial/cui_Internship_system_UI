/**
 * Site Internship Models
 * Matches the backend response structure for /api/site/internships
 */

export interface StudentInfo {
  id: string;
  name: string;
  email: string;
  regNo: string;
}

export interface FacultyInfo {
  id: string;
  name: string;
  email: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  industry: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  email: string;
  company: CompanyInfo;
}

export interface FinalResult {
  id: string;
  internshipId: string;
  facultyMarks: number | null;
  siteMarks: number | null;
  officeMarks: number | null;
  presentationMarks: number | null;
  totalMarks: number | null;
  status: string;
  hodSignatureUrl: string | null;
}

export interface SiteInternship {
  id: string;
  studentId: string;
  facultyId: string;
  siteId: string;
  type: 'ONSITE' | 'REMOTE' | 'HYBRID';
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'IN_PROGRESS';
  createdAt: string;
  updatedAt: string;
  internshipApprovalId?: string | null;
  internshipAssignmentId?: string | null;
  internshipProposalId?: string | null;
  student: StudentInfo;
  faculty: FacultyInfo;
  site: SiteInfo;
  finalResult?: FinalResult | null;
}

export interface GetSiteInternshipsResponse {
  message: string;
  data: SiteInternship[];
}
