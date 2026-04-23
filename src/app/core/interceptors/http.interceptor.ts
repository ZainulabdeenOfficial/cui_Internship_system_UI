import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError, timeout } from 'rxjs';
import { LoadingService } from '../../core/services/loading.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { RequestDeduplicatorService } from '../../core/services/request-deduplicator.service';

/** Pass `true` via HttpContext to suppress the global loading spinner for a request. */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Pass `true` via HttpContext to suppress global error toasts for a request. */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

/** Pass `true` via HttpContext to disable request deduplication (for unique requests). */
export const SKIP_DEDUP = new HttpContextToken<boolean>(() => false);

/**
 * Enhanced HTTP Interceptor
 * - Adds Content-Type headers
 * - Manages global loading state with proper cleanup
 * - Handles errors centrally
 * - Ensures loading state is always reset, even on timeout/network errors
 * - Deduplicates concurrent identical GET requests
 * - Adds cache control headers
 */
export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);
  const dedup = inject(RequestDeduplicatorService);

  // Clone request with Content-Type for JSON requests
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && 
      !(req.body instanceof FormData)) {
    req = req.clone({ 
      setHeaders: { 'Content-Type': 'application/json' } 
    });
  }

  // Add cache control headers for GET requests (browser HTTP cache)
  if (req.method === 'GET') {
    // Cache public endpoints for 5 minutes, private for 1 minute
    const isPublic = !req.url.includes('/api/admin') && 
                     !req.url.includes('/api/secure') &&
                     !req.url.includes('/api/student') &&
                     !req.url.includes('/api/faculty') &&
                     !req.url.includes('/api/site');
    
    const cacheAge = isPublic ? '300' : '60'; // 5 min vs 1 min
    req = req.clone({
      setHeaders: {
        'Cache-Control': `public, max-age=${cacheAge}`,
        'Pragma': 'cache'
      }
    });
  }

  // Use HttpContext tokens instead of custom headers to avoid CORS preflight failures
  const skipGlobalLoading = req.context.get(SKIP_GLOBAL_LOADING);
  const skipDedup = req.context.get(SKIP_DEDUP);
  
  if (!skipGlobalLoading) {
    loadingService.show();
    // Register this key with the deduplicator so it can fix the counter on navigation
    if (req.method === 'GET' && !skipDedup) {
      const key = `${req.method}:${req.urlWithParams}`;
      dedup.trackSpinner(key);
    }
  }

  // Execute the request with deduplication for GET requests
  const request$ = next(req).pipe(
    // Add timeout to prevent indefinite loading states
    timeout(120000), // 2 minute timeout
    
    catchError((error: any) => {
      const silent = req.context.get(SILENT_ERROR);
      
      // Handle timeout errors
      if (error.name === 'TimeoutError') {
        if (!silent) {
          errorHandler.handleError({
            status: 504,
            statusText: 'Gateway Timeout',
            message: 'Request timeout. Please try again.'
          } as any);
        }
        return throwError(() => error);
      }
      
      // Handle other errors
      if (error instanceof HttpErrorResponse && !silent) {
        errorHandler.handleError(error);
      }
      
      return throwError(() => error);
    }),
    
    finalize(() => {
      // ALWAYS reset loading state, regardless of success/failure
      if (!skipGlobalLoading) {
        loadingService.hide();
      }
    })
  );

  // Deduplicate concurrent identical GET requests
  if (req.method === 'GET' && !skipDedup) {
    return dedup.deduplicate(req, request$);
  }

  return request$;
};

// Keep the old interceptor for backward compatibility
export const jsonInterceptor: HttpInterceptorFn = (req, next) => {
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !(req.body instanceof FormData)) {
    req = req.clone({ setHeaders: { 'Content-Type': 'application/json' } });
  }
  return next(req);
};
