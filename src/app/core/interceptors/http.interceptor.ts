import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { LoadingService } from '../../core/services/loading.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

/**
 * Enhanced HTTP Interceptor
 * - Adds Content-Type headers
 * - Manages global loading state
 * - Handles errors centrally
 */
export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);

  // Clone request with Content-Type for JSON requests
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && 
      !(req.body instanceof FormData)) {
    req = req.clone({ 
      setHeaders: { 'Content-Type': 'application/json' } 
    });
  }

  // Check if this request should show global loading
  const skipGlobalLoading = req.headers.has('X-Skip-Global-Loading');
  
  if (!skipGlobalLoading) {
    loadingService.show();
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check if error should be silent
      const silent = req.headers.has('X-Silent-Error');
      
      if (!silent) {
        errorHandler.handleError(error);
      }
      
      return throwError(() => error);
    }),
    finalize(() => {
      if (!skipGlobalLoading) {
        loadingService.hide();
      }
    })
  );
};

// Keep the old interceptor for backward compatibility
export const jsonInterceptor: HttpInterceptorFn = (req, next) => {
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !(req.body instanceof FormData)) {
    req = req.clone({ setHeaders: { 'Content-Type': 'application/json' } });
  }
  return next(req);
};
