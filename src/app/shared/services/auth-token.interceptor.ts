import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

type RouteRule = RegExp;

const API_BASE = environment.apiBaseUrl.replace(/\/$/, '');
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
  } catch {
    // Storage blocked (e.g. Edge Tracking Prevention) — use memory cache
    return _cachedToken;
  }
}

function normalizePath(req: HttpRequest<any>): string {
  // Strip protocol and host for any absolute URL to get just the path
  const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/i, '');
  // Also strip configured API_BASE if it's an absolute backend URL
  const raw = withoutOrigin.replace(API_BASE, '');
  return raw.split('?')[0];
}

/** 
 * Uses native fetch (bypasses Angular interceptors) to call GET /api/auth/sessions.
 * The backend authenticates via httpOnly session cookie (withCredentials).
 * Returns an access token string if the server provides one, empty string '' if the
 * session is valid but no token is in the response, or null if session is invalid/expired.
 */
async function trySessionFetch(): Promise<string | null> {
  const urls = ['/api/auth/sessions', API_BASE ? `${API_BASE}/api/auth/sessions` : null].filter(Boolean) as string[];
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (res.status === 401 || res.status === 403) return null; // genuinely expired
      if (!res.ok) continue;
      const data = await res.json();
      // Extract token from various response shapes
      const sessions = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : null;
      const token = data?.accessToken || data?.token
        || data?.data?.accessToken || data?.data?.token
        || (sessions?.[0]?.accessToken) || (sessions?.[0]?.token);
      if (token) {
        _cachedToken = token;
        try {
          sessionStorage.setItem('authToken', token);
          sessionStorage.setItem('accessToken', token);
          localStorage.setItem('authToken', token);
          localStorage.setItem('accessToken', token);
        } catch {}
        return token;
      }
      // Session exists on server (200 OK) but no token in body — session is valid
      return '';
    } catch { continue; }
  }
  return null;
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
  // If a logout redirect is already in progress, abort all further API calls immediately
  if (isLoggingOut) {
    return throwError(() => new Error('Session expired. Please log in again.'));
  }
  try {
    const path = normalizePath(req);
    const isApi = path.startsWith('/api');
    const needsAuth = isApi && NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));

    const token = needsAuth ? getSessionToken() : null;
    if (needsAuth && !token) {
      console.warn('⚠️ [authTokenInterceptor] No access token for protected endpoint:', path);
      // Only attempt a proactive refresh if a refresh token exists (cookie or localStorage).
      // Without one, redirect to login immediately to avoid unnecessary 405 errors.
      const hasRefreshToken = (() => { try { return !!localStorage.getItem('refreshToken'); } catch { return false; } })();
      if (!hasRefreshToken && !_cachedToken) {
        // No refresh token in storage and no in-memory cache.
        // Before logging out, check if the session cookie is still valid via GET /api/auth/sessions.
        // This handles Edge Tracking Prevention which blocks localStorage but leaves httpOnly cookies intact.
        if (isRefreshingGlobally) {
          return from(new Promise<void>(r => setTimeout(r, 800))).pipe(
            switchMap(() => {
              const t = getSessionToken();
              return next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
            })
          );
        }
        console.log('🔍 [authTokenInterceptor] No token in storage or cache — checking session cookie via /api/auth/sessions');
        isRefreshingGlobally = true;
        return from(trySessionFetch()).pipe(
          switchMap((sessionToken) => {
            isRefreshingGlobally = false;
            if (sessionToken === null) {
              // Definitely no valid session
              console.warn('⚠️ [authTokenInterceptor] Session invalid, redirecting to login');
              triggerLogout(auth);
              return throwError(() => new Error('Session expired. Please log in again.'));
            }
            const freshToken = getSessionToken();
            if (freshToken) {
              console.log('✅ [authTokenInterceptor] Session active, token retrieved, retrying:', path);
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${freshToken}` } }));
            }
            // Session is valid (cookie) but backend didn't return a new token — proceed without bearer
            // and let the 401 handler below do a final retry.
            console.log('ℹ️ [authTokenInterceptor] Session valid via cookie but no bearer token available, proceeding without bearer');
            return next(req);
          }),
          catchError(() => {
            isRefreshingGlobally = false;
            triggerLogout(auth);
            return throwError(() => new Error('Session expired. Please log in again.'));
          })
        );
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
        const path = normalizePath(req);
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
