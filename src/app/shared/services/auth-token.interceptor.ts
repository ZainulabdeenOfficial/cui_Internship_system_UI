import {
  HttpInterceptorFn,
  HttpRequest,
  HttpContextToken,
  HttpContext,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiConfigService } from '../../core/services/api-config.service';

// ─── Route rule sets ────────────────────────────────────────────────────────
type RouteRule = RegExp;

/** Paths that require a Bearer token. */
const NEEDS_BEARER: RouteRule[] = [
  /^\/api\/admin\//,
  /^\/api\/admin\/create-account$/,
  /^\/api\/student\//,
  /^\/api\/faculty\//,
  /^\/api\/site\//,
  /^\/api\/secure\//,
  /^\/api\/maintenance\//,
];

/** Auth paths that must NOT receive a Bearer token (or be retried). */
const PUBLIC_AUTH: RouteRule[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/refresh-token$/,
];

// ─── Context token: marks a request as "already retried after refresh" ───────
/**
 * Set this token to `true` when cloning a request for the post-refresh retry.
 * The interceptor will NOT attempt another refresh for such requests.
 * If the retried request still gets a 401, the user is redirected to login.
 */
export const IS_REFRESH_RETRY = new HttpContextToken<boolean>(() => false);

// ─── In-memory token cache ────────────────────────────────────────────────────
let _cachedToken: string | null = null;

function getSessionToken(): string | null {
  try {
    const stored =
      sessionStorage.getItem('authToken') ||
      sessionStorage.getItem('accessToken') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('accessToken');
    if (stored) _cachedToken = stored;
    return stored || _cachedToken;
  } catch {
    return _cachedToken ?? null;
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────────────
function normalizePath(req: HttpRequest<any>, apiConfig: ApiConfigService): string {
  const API_BASE = apiConfig.getBaseUrl();
  const withoutOrigin = req.url.replace(/^https?:\/\/[^/]+/i, '');
  const raw = withoutOrigin.replace(API_BASE, '');
  return raw.split('?')[0];
}

// ─── Guard: prevent concurrent logouts (race condition) ───────────────────────
let isLoggingOut = false;

function triggerSessionExpired(auth: AuthService) {
  if (isLoggingOut) return;
  isLoggingOut = true;

  // Show a visible alert so the user knows why they are being redirected.
  // We use a small timeout so Angular can finish rendering before the redirect.
  setTimeout(() => {
    alert('⚠️ Session expired. Please log in again.');
  }, 0);

  auth
    .logout({ redirect: true })
    .catch(() => {})
    .finally(() => {
      setTimeout(() => {
        isLoggingOut = false;
      }, 5000);
    });
}

// ─── Guard: prevent concurrent refresh calls ──────────────────────────────────
let isRefreshingGlobally = false;

// ─── Interceptor ──────────────────────────────────────────────────────────────
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const apiConfig = inject(ApiConfigService);

  // If logout is already in progress abort any further API calls immediately.
  if (isLoggingOut) {
    return throwError(() => new Error('Session expired. Please log in again.'));
  }

  // ── Attach Bearer token when the route requires it ────────────────────────
  let processedReq = req;
  try {
    const path = normalizePath(req, apiConfig);
    const isApi = path.startsWith('/api');
    const needsAuth =
      isApi &&
      NEEDS_BEARER.some((r) => r.test(path)) &&
      !PUBLIC_AUTH.some((r) => r.test(path));

    if (needsAuth) {
      const token = getSessionToken();
      if (token) {
        processedReq = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
      }
    }

    // Ensure JSON Content-Type on mutating requests when missing.
    if (isApi) {
      const method = processedReq.method?.toUpperCase?.() ?? '';
      const hasBody =
        method === 'POST' ||
        method === 'PUT' ||
        method === 'PATCH' ||
        method === 'DELETE';
      if (hasBody && !processedReq.headers.has('Content-Type')) {
        processedReq = processedReq.clone({
          setHeaders: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });
      }
    }
  } catch {
    // If path normalisation fails fall through with the original request.
  }

  // ── Execute request and handle 401 ────────────────────────────────────────
  return next(processedReq).pipe(
    catchError((err) => {
      try {
        const path = normalizePath(processedReq, apiConfig);
        const isRefreshEndpoint = /\/api\/auth\/refresh-token$/.test(path);
        const isLoginEndpoint = /\/api\/auth\/login$/.test(path);
        const is401 = err?.status === 401;
        const isRetry = processedReq.context.get(IS_REFRESH_RETRY);

        // ── Case 1: This was already a retried request → session truly expired ──
        if (is401 && isRetry) {
          console.warn(
            '❌ [authInterceptor] Retried request still got 401. Session expired.',
            path
          );
          triggerSessionExpired(auth);
          return throwError(() => err);
        }

        // ── Case 2: Eligible for token refresh ────────────────────────────────
        const eligible =
          is401 && !isRefreshEndpoint && !isLoginEndpoint && !isRetry;

        if (!eligible) {
          return throwError(() => err);
        }

        // ── Case 3: Another refresh already in-flight → wait then retry once ──
        if (isRefreshingGlobally) {
          console.warn(
            '⚠️ [authInterceptor] Already refreshing, waiting 1 s before retry for:',
            path
          );
          return from(
            new Promise<void>((resolve) => setTimeout(resolve, 1000))
          ).pipe(
            switchMap(() => {
              const newToken = getSessionToken();
              if (!newToken) {
                triggerSessionExpired(auth);
                return throwError(() => err);
              }
              const needsAuth =
                NEEDS_BEARER.some((r) => r.test(path)) &&
                !PUBLIC_AUTH.some((r) => r.test(path));
              const retried = needsAuth
                ? processedReq.clone({
                    setHeaders: { Authorization: `Bearer ${newToken}` },
                    context: new HttpContext().set(IS_REFRESH_RETRY, true),
                  })
                : processedReq.clone({
                    context: new HttpContext().set(IS_REFRESH_RETRY, true),
                  });
              return next(retried);
            })
          );
        }

        // ── Case 4: First 401 for this request → call refresh-token endpoint ──
        console.log(
          '🔄 [authInterceptor] 401 received, attempting token refresh for:',
          path
        );
        isRefreshingGlobally = true;

        return from(auth.refreshAccessToken()).pipe(
          switchMap(() => {
            isRefreshingGlobally = false;
            const newToken = getSessionToken();
            console.log(
              '✅ [authInterceptor] Token refreshed. Retrying request:',
              path
            );

            const needsAuth =
              NEEDS_BEARER.some((r) => r.test(path)) &&
              !PUBLIC_AUTH.some((r) => r.test(path));

            // Mark the clone as IS_REFRESH_RETRY so a second 401 triggers logout.
            const retried =
              newToken && needsAuth
                ? processedReq.clone({
                    setHeaders: { Authorization: `Bearer ${newToken}` },
                    context: new HttpContext().set(IS_REFRESH_RETRY, true),
                  })
                : processedReq.clone({
                    context: new HttpContext().set(IS_REFRESH_RETRY, true),
                  });

            return next(retried);
          }),
          catchError((refreshErr) => {
            isRefreshingGlobally = false;
            console.error(
              '❌ [authInterceptor] Token refresh failed → session expired.',
              refreshErr
            );
            triggerSessionExpired(auth);
            return throwError(() => err); // bubble original 401 error
          })
        );
      } catch (interceptErr) {
        console.error('❌ [authInterceptor] Unexpected error:', interceptErr);
        return throwError(() => err);
      }
    })
  );
};
