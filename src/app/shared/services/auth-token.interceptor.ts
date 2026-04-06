import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiConfigService } from '../../core/services/api-config.service';
import { catchError, from, switchMap, throwError } from 'rxjs';

type RouteRule = RegExp;
const NEEDS_BEARER: RouteRule[] = [
  /^\/api\/admin\//,
  /^\/api\/admin\/create-account$/,
  /^\/api\/student\//,
  /^\/api\/faculty\//,
  /^\/api\/site\//,
  /^\/api\/secure\//,
  /^\/api\/maintenance\//
];
const PUBLIC_AUTH: RouteRule[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/refresh-token$/
];

// In-memory token cache: populated whenever storage is successfully read.
// Falls back to this when browser Tracking Prevention blocks localStorage/sessionStorage.
let _cachedToken: string | null = null;

function getSessionToken(): string | null {
  try {
    const stored = sessionStorage.getItem('authToken')
      || sessionStorage.getItem('accessToken')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken')
      || localStorage.getItem('accessToken');
    if (stored) { _cachedToken = stored; }
    return stored || _cachedToken;
  } catch (e) {
    // Storage blocked (e.g. Safari Tracking Prevention, private mode) — use memory cache silently
    // Don't log or throw - just use cached token if available
    return _cachedToken || null;
  }
}

function normalizePath(req: HttpRequest<any>, apiConfig: ApiConfigService): string {
  const API_BASE = apiConfig.getBaseUrl();
  // Strip protocol and host for any absolute URL to get just the path
  const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/i, '');
  // Also strip configured API_BASE if it's an absolute backend URL
  const raw = withoutOrigin.replace(API_BASE, '');
  return raw.split('?')[0];
}



// Prevents duplicate concurrent refreshes (many parallel API calls all seeing no token).
let isRefreshingGlobally = false;
// Prevents multiple simultaneous logout redirects (race condition when multiple API calls
// fire concurrently and all detect missing tokens before the router navigation completes).
let isLoggingOut = false;

function triggerLogout(auth: AuthService) {
  if (isLoggingOut) return;
  isLoggingOut = true;
  auth.logout({ redirect: true }).catch(() => {}).finally(() => {
    // Reset after navigation so a fresh login can work normally
    setTimeout(() => { isLoggingOut = false; }, 5000);
  });
}

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const apiConfig = inject(ApiConfigService);
  
  // If a logout redirect is already in progress, abort all further API calls immediately
  if (isLoggingOut) {
    return throwError(() => new Error('Session expired. Please log in again.'));
  }
  try {
    const path = normalizePath(req, apiConfig);
    const isApi = path.startsWith('/api');
    const needsAuth = isApi && NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));

    const token = needsAuth ? getSessionToken() : null;
    if (needsAuth && !token) {
      console.warn('⚠️ [authTokenInterceptor] No access token for protected endpoint:', path);
      // Only attempt a proactive refresh if a refresh token exists (cookie or localStorage).
      // Without one, redirect to login immediately to avoid unnecessary 405 errors.
      const hasRefreshToken = (() => { try { return !!localStorage.getItem('refreshToken'); } catch { return false; } })();
      if (!hasRefreshToken && !_cachedToken) {
        // No refresh token in storage and no in-memory cache — redirect to login
        console.warn('⚠️ [authTokenInterceptor] No token in storage or cache, redirecting to login');
        triggerLogout(auth);
        return throwError(() => new Error('Session expired. Please log in again.'));
      }
      if (!hasRefreshToken) {
        // Memory cache has a token but storage is blocked — use it directly
        console.log('✅ [authTokenInterceptor] Using in-memory cached token (storage blocked)');
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${_cachedToken!}` } }));
      }
      if (isRefreshingGlobally) {
        // Another in-flight request is already refreshing; wait then send with available token
        return from(new Promise<void>(r => setTimeout(r, 800))).pipe(
          switchMap(() => {
            const t = getSessionToken();
            return next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
          })
        );
      }
      console.log('🔄 [authTokenInterceptor] Proactive refresh (no access token) for:', path);
      isRefreshingGlobally = true;
      return from(auth.refreshAccessToken()).pipe(
        switchMap(() => {
          isRefreshingGlobally = false;
          const newToken = getSessionToken();
          console.log('✅ [authTokenInterceptor] Proactive refresh done, retrying:', path);
          const authed = newToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : req;
          return next(authed);
        }),
        catchError((refreshErr) => {
          isRefreshingGlobally = false;
          const refreshStatus: number = refreshErr?.status ?? 0;
          // For definitive server errors (4xx/5xx, e.g. 405), the refresh endpoint is broken
          // or the token is invalid. Clear stale tokens and redirect to login immediately
          // instead of falling through with no token (which causes a 401 storm).
          if (refreshStatus >= 400 && refreshStatus < 600) {
            console.warn(`⚠️ [authTokenInterceptor] Proactive refresh failed (HTTP ${refreshStatus}), clearing tokens and redirecting to login`);
            auth.clearTokens();
            triggerLogout(auth);
            return throwError(() => new Error('Session expired. Please log in again.'));
          }
          console.warn('⚠️ [authTokenInterceptor] Proactive refresh failed:', refreshErr?.message);
          // For network errors (status 0), fall through; the 401 handler below will retry
          return next(req);
        })
      );
    }
    if (token) {
      console.log('✅ [authTokenInterceptor] Adding Bearer token for:', path);
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    // Ensure JSON headers on write when missing
  if (isApi) {
      const method = req.method?.toUpperCase?.() || '';
      const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
      if (hasBody && !req.headers.has('Content-Type')) {
        req = req.clone({ setHeaders: { 'Content-Type': 'application/json', Accept: 'application/json' } });
      }
      // Avoid cross-origin cookies (most vercel endpoints reject). Use bearer token only.
    }
  } catch {}
  return next(req).pipe(
    catchError(err => {
      try {
        const path = normalizePath(req, apiConfig);
        const isApi = path.startsWith('/api');
        const isRefresh = /\/api\/auth\/refresh-token$/.test(path);
        const isLogin = /\/api\/auth\/login$/.test(path);
        const eligible = isApi && !isRefresh && !isLogin && err?.status === 401;
        
        console.log('🔍 [authTokenInterceptor] Error caught:', {
          status: err?.status,
          path,
          isRefresh,
          isLogin,
          eligible,
          isRefreshingGlobally
        });
        
        if (!eligible) return throwError(() => err);
        
        // The refresh token is an httpOnly cookie — JS cannot read it via localStorage.
        // Always attempt the refresh; the browser will send the cookie automatically.
        // If the refresh endpoint itself returns 401 the catchError below will logout.
        
        // If another request is already refreshing, wait a bit and retry once
        if (isRefreshingGlobally) {
          console.warn('⚠️ [authTokenInterceptor] Already refreshing, waiting 1s before retry');
          return from(new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 1000);
          })).pipe(
            switchMap(() => {
              const newToken = getSessionToken();
              if (newToken) {
                console.log('✅ [authTokenInterceptor] Token refreshed by another request, retrying');
                const needsAuth = NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));
                const retried = needsAuth
                  ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                  : req;
                return next(retried);
              } else {
                console.error('❌ [authTokenInterceptor] Still no token after wait, logging out');
                triggerLogout(auth);
                return throwError(() => err);
              }
            })
          );
        }
        
        console.log('🔄 [authTokenInterceptor] Attempting token refresh for 401 on:', path);
        isRefreshingGlobally = true;
        
        return from(auth.refreshAccessToken()).pipe(
          switchMap(() => {
            isRefreshingGlobally = false;
            console.log('✅ [authTokenInterceptor] Token refreshed successfully, retrying request');
            const token = getSessionToken();
            const needsAuth = NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));
            const retried = (token && needsAuth)
              ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
              : req;
            return next(retried);
          }),
          catchError((refreshErr) => {
            isRefreshingGlobally = false;
            // refresh failed, logout and bubble error
            console.error('❌ [authTokenInterceptor] Token refresh failed, logging out:', {
              error: refreshErr,
              message: refreshErr?.message,
              status: refreshErr?.status
            });
            triggerLogout(auth);
            return throwError(() => err);
          })
        );
      } catch (interceptErr) {
        console.error('❌ [authTokenInterceptor] Interceptor error:', interceptErr);
        return throwError(() => err);
      }
    })
  );
};
