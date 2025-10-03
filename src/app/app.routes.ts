import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/auth/login').then(m => m.Login) },
    { path: 'signup', loadComponent: () => import('./features/auth/signup').then(m => m.Signup) },
    { path: 'verify-email', loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmail) },
    { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPassword) },
    { path: 'guidance', loadComponent: () => import('./features/guidance/guidance').then(m => m.Guidance) },
    { path: 'complaints', loadComponent: () => import('./features/complaints/complaints').then(m => m.Complaints) },
    { path: 'student', loadComponent: () => import('./features/student/student').then(m => m.Student) },
    { path: 'admin',   loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
    { path: 'faculty', loadComponent: () => import('./features/faculty-supervisor/faculty-supervisor').then(m => m.FacultySupervisor) },
    { path: 'site',    loadComponent: () => import('./features/site-supervisor/site-supervisor').then(m => m.SiteSupervisor) },
    { path: '**', redirectTo: 'login' }
];
