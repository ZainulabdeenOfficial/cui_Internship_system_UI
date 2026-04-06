import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Centralized API configuration service
 * Ensures all services use the same correct base URL
 * This prevents any inconsistencies or caching issues with the environment
 */
@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private readonly _baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor() {
    console.log(`✅ [ApiConfigService] Initialized with baseUrl: ${this._baseUrl}`);
  }

  /**
   * Get the API base URL
   * Always returns the current configured URL from environment
   */
  getBaseUrl(): string {
    return this._baseUrl;
  }

  /**
   * Get a full API URL by combining base URL with path
   * @param path The API path (e.g., '/api/student/appex-a')
   * @returns Full API URL
   */
  getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this._baseUrl}${cleanPath}`;
  }

  /**
   * Log current API configuration (for debugging)
   */
  logConfig(): void {
    console.table({
      'Base URL': this._baseUrl,
      'Environment': environment.production ? 'PRODUCTION' : 'DEVELOPMENT',
      'Timestamp': new Date().toISOString()
    });
  }
}
