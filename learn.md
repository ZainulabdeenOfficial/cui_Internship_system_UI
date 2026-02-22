# Learn — CUI Internship Management System UI

A guided reference for developers and contributors who want to understand, run, and extend this Angular-based front-end.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Folder Structure](#folder-structure)
5. [Getting Started](#getting-started)
6. [Key Concepts](#key-concepts)
7. [Routing](#routing)
8. [API Integration](#api-integration)
9. [Styling](#styling)
10. [Testing](#testing)
11. [Useful Resources](#useful-resources)

---

## Project Overview

The **CUI Internship Management System UI** is the Angular front-end for the CUI Internship Management System.  
It allows students, faculty supervisors, site supervisors, and internship-office staff to manage every stage of the internship lifecycle — from registration and proposal submission through weekly logs, evaluations, and final grading.

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | [Angular 20](https://angular.dev/)  |
| Language     | TypeScript 5.8                      |
| UI Library   | [Bootstrap 5](https://getbootstrap.com/) + [ng-bootstrap 19](https://ng-bootstrap.github.io/) |
| HTTP Client  | Angular `HttpClient` (RxJS-based)   |
| Routing      | Angular Router                      |
| Forms        | Angular Reactive Forms              |
| Build Tool   | Angular CLI / `@angular/build`      |
| Testing      | Karma + Jasmine (configured in `karma.conf.js`) |
| Deployment   | [Vercel](https://vercel.com/)       |

---

## Architecture

The application follows the standard Angular feature-module architecture:

```
Browser
  └── AppComponent (root)
        ├── RouterOutlet  (lazy-loaded feature modules)
        ├── Student Module
        ├── Supervisor Module
        └── Admin / Internship-Office Module
```

Each module encapsulates its own components, services, and routing. Shared utilities (guards, interceptors, pipes) live in a `shared` or `core` module.

---

## Folder Structure

```
cui_Internship_system_UI/
├── src/
│   ├── app/                 # Feature modules and components
│   ├── assets/              # Static assets (images, icons)
│   ├── environments/        # Environment configs (dev/prod)
│   ├── index.html           # App shell
│   ├── main.ts              # Bootstrap entry point
│   └── styles.css           # Global styles
├── public/                  # Files served at root (favicons, etc.)
├── angular.json             # Angular workspace configuration
├── package.json             # NPM dependencies & scripts
├── proxy.conf.json          # Dev-server API proxy config
├── tsconfig.json            # TypeScript compiler config
└── vercel.json              # Vercel deployment config
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Angular CLI** (optional but helpful): `npm install -g @angular/cli`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ZainulabdeenOfficial/cui_Internship_system_UI.git
cd cui_Internship_system_UI

# 2. Install dependencies
npm install

# 3. Start the development server
npm start          # or: ng serve
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Connecting to the Back-End API

The dev-server proxy is configured in `proxy.conf.json`.  
Set the `target` URL there (or via environment files) to point at a running back-end instance.

Back-end Swagger docs:  
`https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/docs`

---

## Key Concepts

### Angular Standalone Components / Modules

The app uses Angular modules for feature grouping. Each feature area (student, supervisor, admin) has its own `NgModule` with declared components and a dedicated routing module.

### Reactive Forms

Forms for internship registration, log submission, and evaluations are built with `ReactiveFormsModule` for strong validation and testability.

### HTTP Interceptors

An HTTP interceptor attaches the JWT bearer token to outgoing requests. It can be found in the `core/interceptors` folder.

### Guards

Route guards (`AuthGuard`, role-based guards) protect routes so only the appropriate user role can access certain pages.

---

## Routing

Top-level routes are defined in `app-routing.module.ts`.  
Feature modules are lazy-loaded to keep the initial bundle small:

| Path             | Module / Component         | Role            |
|------------------|----------------------------|-----------------|
| `/student`       | StudentModule              | Student         |
| `/supervisor`    | SupervisorModule           | Faculty / Site  |
| `/admin`         | AdminModule                | Internship Office |
| `/auth`          | AuthModule                 | All             |

---

## API Integration

All API calls are made through Angular services that wrap `HttpClient`.  
Base URL and environment-specific settings are stored in `src/environments/environment.ts`.

Example service pattern:

```typescript
@Injectable({ providedIn: 'root' })
export class InternshipService {
  constructor(private http: HttpClient) {}

  getInternships(): Observable<Internship[]> {
    return this.http.get<Internship[]>('/api/internships');
  }
}
```

---

## Styling

- Global styles: `src/styles.css`
- Bootstrap 5 utility classes are used throughout templates.
- Component-scoped styles live in each component's `.css` / `.scss` file.
- The CUI brand banner asset is at `cui banner updated.png` in the project root.

---

## Testing

```bash
# Run unit tests (Karma + Jasmine)
npm test          # or: ng test

# Build for production (validates compilation)
npm run build
```

Test files follow the `.spec.ts` naming convention and live next to the files they test.

---

## Useful Resources

| Resource | Link |
|----------|------|
| Angular Documentation | https://angular.dev/ |
| Angular CLI Reference | https://angular.dev/tools/cli |
| Bootstrap 5 Docs | https://getbootstrap.com/docs/5.3/ |
| ng-bootstrap | https://ng-bootstrap.github.io/ |
| RxJS | https://rxjs.dev/ |
| TypeScript Handbook | https://www.typescriptlang.org/docs/ |
| Project Back-End API | https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/docs |
| Vercel Deployment | https://vercel.com/docs |
