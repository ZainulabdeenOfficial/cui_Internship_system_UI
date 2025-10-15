import { CanActivateFn, CanMatchFn, Route, Router, UrlSegment, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { StoreService, Role } from '../services/store.service';
import { ToastService } from '../toast/toast.service';

type RolesMeta = { roles?: Role[] };

function checkAllowedRoles(allowed: Role[] | undefined, current: Role | undefined): boolean {
  if (!allowed || allowed.length === 0) return true; // no restriction
  if (!current) return false;
  return allowed.includes(current);
}

function notAllowedToHome(): UrlTree {
  const router = inject(Router);
  return router.createUrlTree(['']); // Home
}

export const roleCanMatch: CanMatchFn = (route: Route, segments: UrlSegment[]) => {
  const store = inject(StoreService);
  const toast = inject(ToastService);
  const meta = (route.data as RolesMeta) || {};
  const user = store.currentUser();
  const currentRole = user?.role;
  const ok = checkAllowedRoles(meta.roles, currentRole);
  if (!ok) {
    try { toast.warning('You are not authorized to view that page.'); } catch {}
    return notAllowedToHome();
  }
  return true;
};

export const roleCanActivate: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const store = inject(StoreService);
  const toast = inject(ToastService);
  const meta = (route.data as RolesMeta) || {};
  const user = store.currentUser();
  const currentRole = user?.role;
  const ok = checkAllowedRoles(meta.roles, currentRole);
  if (!ok) {
    try { toast.warning('You are not authorized to view that page.'); } catch {}
    return notAllowedToHome();
  }
  return true;
};
