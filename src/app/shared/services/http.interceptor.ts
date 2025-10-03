import { HttpInterceptorFn } from '@angular/common/http';


export const jsonInterceptor: HttpInterceptorFn = (req, next) => {
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !(req.body instanceof FormData)) {
    req = req.clone({ setHeaders: { 'Content-Type': 'application/json' } });
  }
  return next(req);
};
