import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../shared/toast/toast.service';

export interface ErrorOptions {
  silent?: boolean;
  customMessage?: string;
}

/**
 * Centralized Error Handler Service
 * Provides consistent error handling across the application
 */
@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  constructor(private toast: ToastService) {}

  /**
   * Handle HTTP errors
   */
  handleError(error: any, options: ErrorOptions = {}): void {
    if (options.silent) return;

    const message = this.extractErrorMessage(error, options.customMessage);
    this.toast.danger(message);

    // Log to console in development
    if (!this.isProduction()) {
      console.error('Error occurred:', error);
    }
  }

  /**
   * Extract user-friendly error message
   */
  private extractErrorMessage(error: any, customMessage?: string): string {
    if (customMessage) return customMessage;

    if (error instanceof HttpErrorResponse) {
      // Backend returned an unsuccessful response code
      if (error.error?.message) {
        return error.error.message;
      }
      
      switch (error.status) {
        case 0:
          return 'Unable to connect to server. Please check your internet connection.';
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Unauthorized. Please log in again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 500:
          return 'Server error. Please try again later.';
        default:
          return `An error occurred: ${error.statusText || 'Unknown error'}`;
      }
    }

    if (error?.message) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return typeof window !== 'undefined' && 
           (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1') === false;
  }
}
