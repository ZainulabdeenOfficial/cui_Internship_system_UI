import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type RouteRule = RegExp;

const API_BASE = environment.apiBaseUrl.replace(/\/$/, '');
const NEEDS_BEARER: RouteRule[] = [
  /^\/api\/admin\//,
  /^\/api\/student\//,
  /^\/api\/faculty\//,
  /^\/api\/site\//,
  /^\/api\/secure\//,
  /^\/api\/auth\/refresh-toke$/
];
const PUBLIC_AUTH: RouteRule[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/
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
  const raw = req.url.startsWith('http') ? req.url.replace(API_BASE, '') : req.url;
  return raw.split('?')[0];
}

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  try {
    const isApi = req.url.startsWith('/api') || req.url.startsWith(API_BASE);
    const path = normalizePath(req);
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
      req = req.clone({ withCredentials: true });
    }
  } catch {}
  return next(req);
};
