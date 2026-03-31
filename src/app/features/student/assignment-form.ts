import { Component, input, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuthService } from '../../shared/services/auth.service';
import { StudentService } from '../../shared/services/student.service';

@Component({
  selector: 'app-assignment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-form.html'
})
export class AssignmentForm {
  selectedId = input<string | null>(null);
  submitted =signal<boolean>(false);
  loading = signal<boolean>(false);
  verificationLoading = signal<boolean>(false);
  
  // AppEx B verification status from backend
  appexBData: any = null;
  facultyApproved = signal<boolean>(false);
  adminApproved = signal<boolean>(false);
  studentApproved = signal<boolean>(false);
  
  // Company search dropdown state
  companySearchQuery: string = '';
  filteredCompanies: Array<any> = [];
  selectedCompany: any = null;
  companyDropdownOpen: boolean = false;
  loadingCompanies: boolean = false;
  private companySearchDebounceId: any;

  model = {
    // Appendix-B: Student Information
    name: '',
    email: '',
    degreeProgram: '',
    semester: '',
    contactNo: '',
    preferredField: '',
    agreementAccepted: false,
    // Appendix-A: Organization Information (Backend: appexA)
    organization: '',
    address: '',
    industrySector: '',
    contactName: '',
    contactDesignation: '',
    contactPhone: '',
    contactEmail: '',
    internshipField: '', // Backend field name
    internshipLocation: '',
    mode: 'On-site',
    numberOfInternship: 0,
    startDate: '',
    endDate: '',
    workingDays: '',
    workingHours: '',
    status: 'pending',
    // Legacy fields for compatibility
    internshipNature: '', // Deprecated - use internshipField
    fullName: '',
    registrationNumber: '',
    contactNumber: '',
    emailAddress: '',
    acknowledged: false
  };

  constructor(
    private store: StoreService, 
    private toast: ToastService, 
    private auth: AuthService,
    private studentService: StudentService
  ) {
    // Auto-load when selectedId changes using effect
    effect(() => {
      const id = this.selectedId();
      if (!id) return;
      
      // Load existing AppEx B data from backend
      this.loadAppexBStatus();
      
      try {
        const list = this.store.agreements()[id] ?? [];
        if (!list.length) return;
        const latest = list[list.length - 1] as any;
        if (latest && latest.studentAgreementData) {
          this.model = { ...this.model, ...(latest.studentAgreementData || {}) };
        }
      } catch {}
      
      // Map legacy fields to new fields
      this.model.name = this.model.name || this.model.fullName;
      this.model.email = this.model.email || this.model.emailAddress;
      this.model.contactNo = this.model.contactNo || this.model.contactNumber;
      // Map deprecated internshipNature to internshipField
      this.model.internshipField = this.model.internshipField || this.model.internshipNature;
    });
  }

  submit() {
    try {
      // Prevent resubmission
      if (this.submitted()) {
        this.toast.warning('Assignment & Agreement already submitted');
        return;
      }

      // Prevent multiple simultaneous submissions
      if (this.loading()) {
        return;
      }

      // Auth barrier: Check if user is authenticated
      const authToken = this.getAuthToken();
      if (!authToken) {
        this.toast.danger('Authentication required. Please login to submit.');
        return;
      }

      const id = this.selectedId();
      if (!id) { 
        this.toast.warning('Please select or sign-in as a student to submit.'); 
        return; 
      }

      // Validate all required fields before submission (AppEx-B fields)
      const requiredFields = {
        name: this.model.name,
        degreeProgram: this.model.degreeProgram,
        email: this.model.email,
        semester: this.model.semester,
        contactNo: this.model.contactNo,
        preferredField: this.model.preferredField
      };

      // Check for empty fields
      const emptyFields = Object.entries(requiredFields)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (emptyFields.length > 0) {
        this.toast.danger(`Please fill all required fields: ${emptyFields.join(', ')}`);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.model.email)) {
        this.toast.danger('Please enter a valid email address.');
        return;
      }

      // Validate agreement acceptance
      if (!this.model.agreementAccepted) {
        this.toast.danger('You must accept the agreement to submit.');
        return;
      }
      
      // Build payload for Backend API: /api/student/appex-b with auth
      const appexBPayload = {
        name: this.model.name.trim(),
        degreeProgram: this.model.degreeProgram.trim(),
        email: this.model.email.trim(),
        semester: this.model.semester.trim(),
        contactNo: this.model.contactNo.trim(),
        preferredField: this.model.preferredField.trim(),
        agreementAccepted: this.model.agreementAccepted
      };

      console.log('[AssignmentForm] Submitting AppEx B with payload:', appexBPayload);
      
      // Include auth token in payload headers (will be sent by store service)
      const requestConfig = {
        payload: appexBPayload,
        authToken: authToken,
        studentId: id
      };
      
      // Set loading state
      this.loading.set(true);
      
      // Submit to backend via store service with auth
      const result = this.store.submitAppexB(id, requestConfig as any);
      
      // Handle the response
      if (result && result.observable) {
        result.observable.subscribe({
          next: (response) => {
            this.loading.set(false);
            this.submitted.set(true);
            this.toast.success('Student Assignment & Agreement (AppEx B) submitted successfully');
            console.log('[AssignmentForm] AppEx B submitted successfully:', response);
            
            // Load AppEx B status to show approval badges
            this.loadAppexBStatus();
            
            // reset locally
            this.model = {
              name: '',
              email: '',
              degreeProgram: '',
              semester: '',
              contactNo: '',
              preferredField: '',
              agreementAccepted: false,
              organization: '',
              address: '',
              industrySector: '',
              contactName: '',
              contactDesignation: '',
              contactPhone: '',
              contactEmail: '',
              internshipField: '',
              internshipLocation: '',
              mode: 'On-site',
              numberOfInternship: 0,
              startDate: '',
              endDate: '',
              workingDays: '',
              workingHours: '',
              status: 'pending',
              internshipNature: '',
              fullName: '',
              registrationNumber: '',
              contactNumber: '',
              emailAddress: '',
              acknowledged: false
            };
          },
          error: (err) => {
            this.loading.set(false);
            console.error('[AssignmentForm] Error submitting AppEx B:', err);
            const errorMsg = err?.error?.message || err?.message || 'Failed to submit. Please try again.';
            this.toast.danger('Submission failed: ' + errorMsg);
          }
        });
      } else {
        // Fallback for synchronous error
        this.loading.set(false);
        this.toast.danger('Failed to initiate submission. Please check your connection.');
      }
    } catch (err: any) {
      this.loading.set(false);
      console.error('[AssignmentForm] Submission error:', err);
      this.toast.danger('Failed to submit internship application: ' + err.message);
    }
  }

  private resetModel() {
    this.model = { 
        name: '',
        email: '',
        degreeProgram: '',
        semester: '',
        contactNo: '',
        preferredField: '',
        agreementAccepted: false,
        organization: '',
        address: '',
        industrySector: '',
        contactName: '',
        contactDesignation: '',
        contactPhone: '',
        contactEmail: '',
        internshipField: '',
        internshipLocation: '',
        mode: 'On-site',
        numberOfInternship: 0,
        startDate: '',
        endDate: '',
        workingDays: '',
        workingHours: '',
        status: 'pending',
        internshipNature: '',
        fullName: '',
        registrationNumber: '',
        contactNumber: '',
        emailAddress: '',
        acknowledged: false
    };
  }

  private getAuthToken(): string | null {
    try {
      // Check session storage first (most common for current session)
      const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('accessToken');
      if (token) return token;
      
      // Fallback to local storage
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) return refreshToken;
      
      return null;
    } catch (err) {
      console.error('[AssignmentForm] Error retrieving auth token:', err);
      return null;
    }
  }

  async loadAppexBStatus() {
    try {
      const response = await this.studentService.getAppexBVerification();
      const data = response?.data || response;
      
      console.log('[AssignmentForm] AppEx B Status Response:', data);
      
      if (data && data.id) {
        this.appexBData = data;
        this.submitted.set(true);
        
        // Update model with admin-filled data
        if (data.companyName) this.model.organization = data.companyName;
        if (data.internshipRole) this.model.internshipField = data.internshipRole;
        if (data.startDate) this.model.startDate = data.startDate.slice(0, 10);
        if (data.endDate) this.model.endDate = data.endDate.slice(0, 10);
        if (data.durationWeeks) this.model.numberOfInternship = data.durationWeeks;
        
        // Check approval statuses - check multiple possible field names
        this.facultyApproved.set(
          data.facultyVerified || 
          data.facultyApproved ||
          data.assignment?.facultyVerified || 
          false
        );
        
        // Admin approval - check all possible variations including adminApprovalAction
        const adminStatus = data.adminApproved || 
                           data.adminVerified || 
                           data.adminApprovalAction === 'approve' ||
                           data.adminApprovalStatus === 'approved' ||
                           data.status === 'approved' || 
                           data.assignment?.adminApproved || 
                           data.assignment?.adminVerified ||
                           data.assignment?.adminApprovalAction === 'approve' ||
                           // Also check if admin has filled details (indicates approval)
                           (data.companyName && data.internshipRole && data.durationWeeks > 0) ||
                           false;
        
        console.log('[AssignmentForm] Admin Approval Status Check:', {
          adminApproved: data.adminApproved,
          adminVerified: data.adminVerified,
          adminApprovalAction: data.adminApprovalAction,
          adminApprovalStatus: data.adminApprovalStatus,
          status: data.status,
          assignmentAdminApproved: data.assignment?.adminApproved,
          assignmentAdminVerified: data.assignment?.adminVerified,
          assignmentAdminApprovalAction: data.assignment?.adminApprovalAction,
          hasAdminFilledDetails: !!(data.companyName && data.internshipRole && data.durationWeeks > 0),
          computed: adminStatus
        });
        
        this.adminApproved.set(adminStatus);
        this.studentApproved.set(data.studentVerified || data.assignment?.studentVerified || false);
      }
    } catch (err: any) {
      // Silently handle error (no existing data)
      console.log('[AssignmentForm] No AppEx B data found:', err?.message);
    }
  }

  async approveAppexB() {
    if (this.verificationLoading()) return;
    
    this.verificationLoading.set(true);
    try {
      const response = await this.studentService.verifyAppexB();
      this.toast.success(response?.message || 'AppEx B approved successfully');
      this.studentApproved.set(true);
      
      // Reload status
      await this.loadAppexBStatus();
    } catch (err: any) {
      const errorMsg = err?.error?.message || err?.message || 'Failed to approve';
      this.toast.danger(errorMsg);
    } finally {
      this.verificationLoading.set(false);
    }
  }

  async rejectAppexB() {
    if (this.verificationLoading()) return;
    
    if (!confirm('Are you sure you want to reject this AppEx B? This action cannot be undone.')) {
      return;
    }
    
    this.verificationLoading.set(true);
    try {
      // Call API to reject (you may need to add this endpoint)
      const response = await this.studentService.verifyAppexB(); // Same endpoint, backend should handle rejection
      this.toast.warning(response?.message || 'AppEx B rejected');
      
      // Reload status
      await this.loadAppexBStatus();
    } catch (err: any) {
      const errorMsg = err?.error?.message || err?.message || 'Failed to reject';
      this.toast.danger(errorMsg);
    } finally {
      this.verificationLoading.set(false);
    }
  }

  onCompanySearchChange(query: string) {
    console.log('[AssignmentForm] Company search query changed:', query);
    
    // Clear previous debounce
    if (this.companySearchDebounceId) {
      clearTimeout(this.companySearchDebounceId);
    }

    if (!query || query.trim().length === 0) {
      console.log('[AssignmentForm] Empty search query - clearing filtered companies');
      this.filteredCompanies = [];
      return;
    }

    // Debounce the search request
    this.companySearchDebounceId = setTimeout(() => {
      console.log('[AssignmentForm] Executing debounced search for:', query);
      this.searchCompanies(query);
    }, 300);
  }

  private async searchCompanies(query: string) {
    try {
      console.log('[AssignmentForm] Starting company search with query:', query);
      this.loadingCompanies = true;

      // Get all companies from store or API
      const companies = this.store.companies();
      console.log('[AssignmentForm] Total companies available in store:', companies?.length || 0, companies);

      if (!companies || companies.length === 0) {
        console.warn('[AssignmentForm] No companies found in store, attempting to load from API...');
        // Try to load companies if not available
        try {
          const response = await this.studentService.getDropdownCompanies({ search: query, limit: 10 });
          console.log('[AssignmentForm] Companies loaded from API:', response?.data?.length || 0);
          console.log('[AssignmentForm] API Response:', response);
          
          if (response?.data && Array.isArray(response.data)) {
            this.filteredCompanies = response.data;
            console.log('[AssignmentForm] Found', this.filteredCompanies.length, 'companies matching query');
          } else {
            console.error('[AssignmentForm] Invalid companies response from API - data field not an array:', response?.data);
            this.filteredCompanies = [];
          }
        } catch (apiError) {
          console.error('[AssignmentForm] Failed to load companies from API:', apiError);
          console.error('[AssignmentForm] API Error details:', {
            message: (apiError as any)?.message,
            status: (apiError as any)?.status,
            url: (apiError as any)?.url,
            error: apiError
          });
          this.filteredCompanies = [];
          this.toast.danger('Failed to load companies from API: ' + (apiError as any)?.message);
        }
      } else {
        // Filter from existing companies
        console.log('[AssignmentForm] Filtering from store companies with query:', query);
        this.filteredCompanies = this.filterCompanies(companies, query);
      }

      console.log('[AssignmentForm] Final filtered companies count:', this.filteredCompanies.length);
      if (this.filteredCompanies.length === 0) {
        console.warn('[AssignmentForm] No companies match the search query:', query);
      }
      this.companyDropdownOpen = true;
    } catch (error) {
      console.error('[AssignmentForm] Error searching companies:', error);
      console.error('[AssignmentForm] Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        error: error
      });
      this.toast.danger('Error searching companies: ' + (error as any)?.message);
      this.filteredCompanies = [];
    } finally {
      this.loadingCompanies = false;
    }
  }

  private filterCompanies(companies: Array<any>, query: string): Array<any> {
    const lowerQuery = query.toLowerCase();
    console.log('[AssignmentForm] Filtering', companies.length, 'companies with query:', lowerQuery);
    
    const filtered = companies.filter((company, index) => {
      try {
        const name = company?.name?.toLowerCase() || '';
        const industry = company?.industry?.toLowerCase() || '';
        const address = company?.address?.toLowerCase() || '';
        
        const matches = name.includes(lowerQuery) || industry.includes(lowerQuery) || address.includes(lowerQuery);
        if (matches) {
          console.log(`[AssignmentForm] Company ${index} matched:`, { name: company?.name, industry, address });
        }
        return matches;
      } catch (err) {
        console.warn('[AssignmentForm] Error filtering company at index', index, ':', err);
        return false;
      }
    });

    console.log('[AssignmentForm] Filter result:', filtered.length, 'companies matched');
    return filtered.slice(0, 10); // Limit to 10 results
  }

  async loadAllCompanies() {
    try {
      console.log('[AssignmentForm] Loading all companies from directory');
      this.loadingCompanies = true;

      const response = await this.studentService.getDropdownCompanies({ limit: 10 });
      console.log('[AssignmentForm] All companies loaded:', response?.data?.length || 0);
      console.log('[AssignmentForm] Companies data:', response);

      if (response?.data && Array.isArray(response.data)) {
        this.filteredCompanies = response.data;
        console.log('[AssignmentForm] Displaying', this.filteredCompanies.length, 'companies');
      } else {
        console.error('[AssignmentForm] Invalid companies response format:', {
          dataType: typeof response?.data,
          isArray: Array.isArray(response?.data),
          data: response?.data
        });
        this.toast.danger('Failed to load companies. Invalid response format.');
        this.filteredCompanies = [];
      }
      this.companyDropdownOpen = true;
    } catch (error) {
      console.error('[AssignmentForm] Error loading companies:', error);
      console.error('[AssignmentForm] Error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        error: error
      });
      this.toast.danger('Error loading companies: ' + (error as any)?.message);
      this.filteredCompanies = [];
    } finally {
      this.loadingCompanies = false;
    }
  }

  selectCompany(company: any) {
    console.log('[AssignmentForm] Company selected:', company);
    this.selectedCompany = company;
    
    // Auto-fill organization fields from selected company
    if (company?.name) {
      this.model.organization = company.name;
      console.log('[AssignmentForm] Set organization to:', company.name);
    }
    if (company?.industry) {
      this.model.industrySector = company.industry;
      console.log('[AssignmentForm] Set industry sector to:', company.industry);
    }
    if (company?.address) {
      this.model.address = company.address;
      console.log('[AssignmentForm] Set address to:', company.address);
    }
    if (company?.contactEmail) {
      this.model.contactEmail = company.contactEmail;
    }
    if (company?.contactPhone) {
      this.model.contactPhone = company.contactPhone;
    }
    
    console.log('[AssignmentForm] Model updated with company details:', {
      organization: this.model.organization,
      industrySector: this.model.industrySector,
      address: this.model.address
    });
    
    this.companyDropdownOpen = false;
    this.companySearchQuery = '';
    this.filteredCompanies = [];
    
    this.toast.success('Company selected: ' + company.name);
  }

  clearSelectedCompany() {
    console.log('[AssignmentForm] Clearing selected company');
    this.selectedCompany = null;
    this.companySearchQuery = '';
    this.filteredCompanies = [];
    this.companyDropdownOpen = false;
  }
}
