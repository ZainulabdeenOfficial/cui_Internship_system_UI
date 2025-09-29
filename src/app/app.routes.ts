import { Routes, CanMatchFn } from '@angular/router';
import { inject } from '@angular/core';
import { StoreService } from './shared/services/store.service';

const roleGuard = (role: 'student'|'admin'|'faculty'|'site'): CanMatchFn => () => {
    const store = inject(StoreService);
    return store.currentUser()?.role === role;
};

export const routes: Routes = [
    { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/auth/login').then(m => m.Login) },
    { path: 'signup', loadComponent: () => import('./features/auth/signup').then(m => m.Signup) },
    // Single login page handles all roles via role selector/query param
    { path: 'student', canMatch: [roleGuard('student')], loadComponent: () => import('./features/student/student').then(m => m.Student) },
    { path: 'admin',   canMatch: [roleGuard('admin')],   loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
    { path: 'faculty', canMatch: [roleGuard('faculty')], loadComponent: () => import('./features/faculty-supervisor/faculty-supervisor').then(m => m.FacultySupervisor) },
    { path: 'site',    canMatch: [roleGuard('site')],    loadComponent: () => import('./features/site-supervisor/site-supervisor').then(m => m.SiteSupervisor) },
    { path: '**', redirectTo: 'login' }
];
