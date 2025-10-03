import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';


export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  try {
    const token = localStorage.getItem('authToken');
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const isApi = req.url.startsWith('/api') || req.url.startsWith(base);
    if (token && isApi) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    if (isApi) req = req.clone({ withCredentials: true });
  } catch {}
  return next(req);
};
