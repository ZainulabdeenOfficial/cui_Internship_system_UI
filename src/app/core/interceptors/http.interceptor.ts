import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { LoadingService } from '../../core/services/loading.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

/** Pass `true` via HttpContext to suppress the global loading spinner for a request. */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Pass `true` via HttpContext to suppress global error toasts for a request. */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

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

  // Use HttpContext tokens instead of custom headers to avoid CORS preflight failures
  const skipGlobalLoading = req.context.get(SKIP_GLOBAL_LOADING);
  
  if (!skipGlobalLoading) {
    loadingService.show();
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const silent = req.context.get(SILENT_ERROR);
      
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
