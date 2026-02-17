import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../../shared/services/admin-api.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { PaginatorComponent } from '../../../shared/pagination/paginator';
import { ButtonLoadingDirective } from '../../../core/directives/button-loading.directive';
import { trackById } from '../../../core/utils/track-by.utils';

export interface ApexAForm {
  id: string;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'approved' | 'rejected';
  student?: {
    id: string;
    name: string;
    email: string;
    regNo: string;
  };
}

/**
 * APEX A Forms Management Component
 * Demonstrates: Signals, OnPush, trackBy, proper loading states, caching
 */
@Component({
  selector: 'app-apex-a-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SearchInputComponent,
    PaginatorComponent,
    ButtonLoadingDirective
  ],
  templateUrl: './apex-a-management.component.html',
  styleUrls: ['./apex-a-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApexAManagementComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private toast = inject(ToastService);

  // State using Angular Signals
  forms = signal<ApexAForm[]>([]);
  loading = signal(false);
  updatingFormId = signal<string | null>(null);
  approvingAll = signal(false);
  
  // Filters
  searchQuery = signal('');
  statusFilter = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');
  currentPage = signal(1);
  pageSize = signal(10);
  
  // Selection
  selectedIds = signal<Set<string>>(new Set());
  
  // Computed values
  filteredForms = computed(() => {
    let result = this.forms();
    
    // Apply status filter
    const status = this.statusFilter();
    if (status !== 'all') {
      result = result.filter(f => f.status === status);
    }
    
    // Apply search filter
    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(f => 
        f.student?.name.toLowerCase().includes(query) ||
        f.student?.email.toLowerCase().includes(query) ||
        f.student?.regNo.toLowerCase().includes(query)
      );
    }
    
    return result;
  });
  
  paginatedForms = computed(() => {
    const all = this.filteredForms();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;
    return all.slice(start, end);
  });
  
  totalCount = computed(() => this.filteredForms().length);
  selectedCount = computed(() => this.selectedIds().size);
  
  // TrackBy function for performance
  trackByFormId = trackById;
  
  // Modal state
  selectedForm = signal<ApexAForm | null>(null);
  showDetailsModal = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadForms();
  }

  async loadForms(forceRefresh = false): Promise<void> {
    this.loading.set(true);
    
    try {
      const data = await this.adminApi.getApexAForms(forceRefresh);
      this.forms.set(data);
      
      if (forceRefresh) {
        this.toast.success('Forms refreshed successfully');
      }
    } catch (error) {
      // Error already handled by AdminApiService
      this.forms.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(formId: string, status: 'approved' | 'rejected'): Promise<void> {
    const form = this.forms().find(f => f.id === formId);
    if (!form?.student?.id) {
      this.toast.danger('Invalid form data');
      return;
    }
    
    this.updatingFormId.set(formId);
    
    try {
      await this.adminApi.updateApexAStatus(formId, form.student.id, status);
      
      // Update local state
      this.forms.update(forms => 
        forms.map(f => f.id === formId ? { ...f, status } : f)
      );
      
      this.toast.success(`Form ${status} successfully`);
    } catch (error) {
      // Error already handled
    } finally {
      this.updatingFormId.set(null);
    }
  }

  async approveSelected(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) {
      this.toast.warning('No forms selected');
      return;
    }
    
    this.approvingAll.set(true);
    
    try {
      const promises = ids.map(id => {
        const form = this.forms().find(f => f.id === id);
        return form?.student?.id 
          ? this.adminApi.updateApexAStatus(id, form.student.id, 'approved')
          : Promise.resolve();
      });
      
      await Promise.all(promises);
      
      // Update local state
      this.forms.update(forms =>
        forms.map(f => ids.includes(f.id) ? { ...f, status: 'approved' as const } : f)
      );
      
      // Clear selection
      this.selectedIds.set(new Set());
      
      this.toast.success(`${ids.length} forms approved successfully`);
    } catch (error) {
      this.toast.danger('Some forms failed to approve');
    } finally {
      this.approvingAll.set(false);
    }
  }

  toggleSelection(formId: string): void {
    this.selectedIds.update(ids => {
      const newIds = new Set(ids);
      if (newIds.has(formId)) {
        newIds.delete(formId);
      } else {
        newIds.add(formId);
      }
      return newIds;
    });
  }

  toggleSelectAll(): void {
    const currentForms = this.paginatedForms();
    const allSelected = currentForms.every(f => this.selectedIds().has(f.id));
    
    this.selectedIds.update(ids => {
      const newIds = new Set(ids);
      if (allSelected) {
        currentForms.forEach(f => newIds.delete(f.id));
      } else {
        currentForms.forEach(f => newIds.add(f.id));
      }
      return newIds;
    });
  }

  viewDetails(form: ApexAForm): void {
    this.selectedForm.set(form);
    this.showDetailsModal.set(true);
  }

  closeDetailsModal(): void {
    this.showDetailsModal.set(false);
    this.selectedForm.set(null);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1); // Reset to first page on search
  }

  onStatusFilterChange(): void {
    this.currentPage.set(1); // Reset to first page on filter change
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(): void {
    this.currentPage.set(1); // Reset to first page on page size change
  }

  isSelected(formId: string): boolean {
    return this.selectedIds().has(formId);
  }

  isAllSelected(): boolean {
    const currentForms = this.paginatedForms();
    return currentForms.length > 0 && currentForms.every(f => this.selectedIds().has(f.id));
  }
}
