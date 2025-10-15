import { Routes } from '@angular/router';
import { roleCanActivate, roleCanMatch } from './shared/guards/role.guard';
import { Home } from './features/home/home';

export const routes: Routes = [
    { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/auth/login').then(m => m.Login) },
    { path: 'signup', loadComponent: () => import('./features/auth/signup').then(m => m.Signup) },
    { path: 'verify-email', loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmail) },
    { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPassword) },
    { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password').then(m => m.ResetPassword) },
    { path: 'guidance', loadComponent: () => import('./features/guidance/guidance').then(m => m.Guidance) },
    { path: 'guide/student', loadComponent: () => import('./features/guides').then(m => m.StudentGuide) },
    { path: 'guide/office', loadComponent: () => import('./features/guides').then(m => m.OfficeGuide) },
    { path: 'guide/supervisors', loadComponent: () => import('./features/guides').then(m => m.SupervisorsGuide) },
    { path: 'complaints', loadComponent: () => import('./features/complaints/complaints').then(m => m.Complaints) },
    { path: 'student', loadComponent: () => import('./features/student/student').then(m => m.Student), canMatch: [roleCanMatch], canActivate: [roleCanActivate], data: { roles: ['student'] } },
    { path: 'admin',   loadComponent: () => import('./features/admin/admin').then(m => m.Admin), canMatch: [roleCanMatch], canActivate: [roleCanActivate], data: { roles: ['admin'] } },
    { path: 'faculty', loadComponent: () => import('./features/faculty-supervisor/faculty-supervisor').then(m => m.FacultySupervisor), canMatch: [roleCanMatch], canActivate: [roleCanActivate], data: { roles: ['faculty'] } },
    { path: 'site',    loadComponent: () => import('./features/site-supervisor/site-supervisor').then(m => m.SiteSupervisor), canMatch: [roleCanMatch], canActivate: [roleCanActivate], data: { roles: ['site'] } },
    { path: '**', redirectTo: '',component:Home}
];
