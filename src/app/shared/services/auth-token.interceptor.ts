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
  /^\/api\/maintenance\//,
  /^\/api\/auth\/refresh-token$/
];
const PUBLIC_AUTH: RouteRule[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/refresh-token$/
];

function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem('authToken')
      || sessionStorage.getItem('accessToken')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken')
      || localStorage.getItem('accessToken');
  } catch { return null; }
}

function normalizePath(req: HttpRequest<any>): string {
  // Strip protocol and host for any absolute URL to get just the path
  const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/i, '');
  // Also strip configured API_BASE if it's an absolute backend URL
  const raw = withoutOrigin.replace(API_BASE, '');
  return raw.split('?')[0];
}

let isRefreshingGlobally = false;
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  try {
    const path = normalizePath(req);
    const isApi = path.startsWith('/api');
    const needsAuth = isApi && NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));

    const token = needsAuth ? getSessionToken() : null;
    if (needsAuth && !token) {
      console.warn('⚠️ [authTokenInterceptor] No access token for protected endpoint:', path);
      // Refresh token is an httpOnly cookie — JS cannot read it, but the browser sends it
      // automatically via withCredentials. Always attempt a proactive refresh.
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
          console.warn('⚠️ [authTokenInterceptor] Proactive refresh failed:', refreshErr?.message);
          // Forward without auth; let the server 401 drive the retry flow below
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
                auth.logout({ redirect: true }).catch(() => {});
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
            auth.logout({ redirect: true }).catch(() => {});
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
