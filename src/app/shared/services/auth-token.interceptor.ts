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
      || localStorage.getItem('authToken');
  } catch { return null; }
}

function normalizePath(req: HttpRequest<any>): string {
  // Strip protocol and host for any absolute URL to get just the path
  const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/i, '');
  // Also strip configured API_BASE if it's an absolute backend URL
  const raw = withoutOrigin.replace(API_BASE, '');
  return raw.split('?')[0];
}

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  try {
    const path = normalizePath(req);
    const isApi = path.startsWith('/api');
    const needsAuth = isApi && NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));

    const token = needsAuth ? getSessionToken() : null;
    if (token) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

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
        if (!eligible) return throwError(() => err);
        // Attempt a single refresh then retry the original request with updated token
        return from(auth.refreshAccessToken()).pipe(
          switchMap(() => {
            const token = getSessionToken();
            const needsAuth = NEEDS_BEARER.some(r => r.test(path)) && !PUBLIC_AUTH.some(r => r.test(path));
            const retried = (token && needsAuth)
              ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
              : req;
            return next(retried);
          }),
          catchError(() => throwError(() => err))
        );
      } catch {
        return throwError(() => err);
      }
    })
  );
};
