import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiCacheService } from '../../core/services/api-cache.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { AdminService } from './admin.service';

/**
 * Optimized Admin API Service
 * Wraps AdminService with caching and better error handling
 * Follows SOLID principles and provides a cleaner API
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private adminService = inject(AdminService);
  private cache = inject(ApiCacheService);
  private errorHandler = inject(ErrorHandlerService);
  private http = inject(HttpClient);

  /**
   * Get dropdown companies with caching
   */
  async getDropdownCompanies(query?: string): Promise<Array<{ id: string; name: string; email?: string; address?: string }>> {
    const cacheKey = `dropdown-companies-${query || 'all'}`;
    
    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.getDropdownCompanies(query)
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 2 * 60 * 1000 } // Cache for 2 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to load companies'
      });
      return [];
    }
  }

  /**
   * Get all companies with caching
   */
  async getCompanies(forceRefresh = false): Promise<Array<{ id: string; name: string; email?: string; phone?: string; address?: string; website?: string; industry?: string; description?: string }>> {
    const cacheKey = 'admin-companies';
    
    if (forceRefresh) {
      this.cache.invalidate(cacheKey);
    }

    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.getCompanies()
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to load companies list'
      });
      return [];
    }
  }

  /**
   * Search faculty supervisors with debounced caching
   */
  async searchFaculty(query: string): Promise<Array<{ id: string; name: string; email?: string; companyName?: string }>> {
    if (!query || query.length < 2) return [];

    const cacheKey = `faculty-search-${query.toLowerCase()}`;

    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.searchFaculty(query)
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 3 * 60 * 1000 } // Cache for 3 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to search faculty'
      });
      return [];
    }
  }

  /**
   * Search site supervisors with debounced caching
   */
  async searchSiteSupervisors(query: string): Promise<Array<{ id: string; name: string; email?: string; companyName?: string }>> {
    if (!query || query.length < 2) return [];

    const cacheKey = `site-search-${query.toLowerCase()}`;

    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.searchSiteSupervisors(query)
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 3 * 60 * 1000 } // Cache for 3 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to search site supervisors'
      });
      return [];
    }
  }

  /**
   * Get APEX A forms with caching
   */
  async getApexAForms(forceRefresh = false): Promise<Array<any>> {
    const cacheKey = 'apex-a-forms';

    if (forceRefresh) {
      this.cache.invalidate(cacheKey);
    }

    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.getApexAForms()
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 2 * 60 * 1000 } // Cache for 2 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to load APEX A forms'
      });
      return [];
    }
  }

  /**
   * Get APEX B forms with caching
   */
  async getApexBForms(forceRefresh = false): Promise<Array<any>> {
    const cacheKey = 'apex-b-forms';

    if (forceRefresh) {
      this.cache.invalidate(cacheKey);
    }

    try {
      return await firstValueFrom(
        this.cache.get(
          cacheKey,
          () => {
            return new Observable(observer => {
              this.adminService.getApexBForms()
                .then(data => {
                  observer.next(data);
                  observer.complete();
                })
                .catch(err => observer.error(err));
            });
          },
          { maxAge: 2 * 60 * 1000 } // Cache for 2 minutes
        )
      );
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to load APEX B forms'
      });
      return [];
    }
  }

  /**
   * Update APEX A status and invalidate cache
   */
  async updateApexAStatus(formId: string, studentId: string, status: 'approved' | 'rejected'): Promise<any> {
    try {
      const result = await this.adminService.updateApexAStatus(formId, studentId, status);
      
      // Invalidate cache after update
      this.cache.invalidate('apex-a-forms');
      
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: `Failed to ${status} APEX A form`
      });
      throw error;
    }
  }

  /**
   * Update APEX B details and invalidate cache
   */
  async updateApexBDetails(details: any): Promise<any> {
    try {
      const result = await this.adminService.updateApexBDetails(details);
      
      // Invalidate cache after update
      this.cache.invalidate('apex-b-forms');
      
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, {
        customMessage: 'Failed to update APEX B form'
      });
      throw error;
    }
  }

  /**
   * Invalidate all admin-related caches
   */
  invalidateAllCaches(): void {
    this.cache.invalidatePattern(/^(admin|apex|faculty|site|company|dropdown)/);
  }
}
