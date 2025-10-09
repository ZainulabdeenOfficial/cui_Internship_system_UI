import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';


export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  try {
    // Read token from session first; support multiple common keys
    const token = sessionStorage.getItem('authToken')
      || sessionStorage.getItem('accessToken')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken');
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const isApi = req.url.startsWith('/api') || req.url.startsWith(base);
    if (token && isApi) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    // Ensure JSON content type for write operations if not already set
    const method = req.method?.toUpperCase?.() || '';
    const hasBody = ['POST','PUT','PATCH','DELETE'].includes(method);
    const ct = req.headers.get('Content-Type');
    if (isApi && hasBody && !ct) {
      req = req.clone({ setHeaders: { 'Content-Type': 'application/json', Accept: 'application/json' } });
    }
    if (isApi) req = req.clone({ withCredentials: true });
  } catch {}
  return next(req);
};
