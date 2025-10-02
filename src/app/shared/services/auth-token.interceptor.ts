import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Attach Authorization header if token exists for our API base URL
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  try {
    const token = localStorage.getItem('authToken');
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    if (token && req.url.startsWith(base)) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  } catch {}
  return next(req);
};
