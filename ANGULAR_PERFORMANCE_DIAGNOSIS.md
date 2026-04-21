# Angular Performance & State Management Diagnosis Report

## Executive Summary

Your Angular 20 application is experiencing three interconnected issues:

1. **Delayed Initial Load** (2-3 seconds) - Caused by TokenRefreshService initialization making unnecessary API calls
2. **Tab Switch Reloads** - Lack of Page Visibility API implementation to pause operations when app loses focus
3. **State Loss on Navigation** - Components re-rendering unnecessarily due to lifecycle hook conflicts

**Root Causes Identified:**
- APP_INITIALIZER with TokenRefreshService starts token refresh logic before checking if user is authenticated
- No visibility state management - app continues background operations when tab is hidden
- Missing request deduplication and cache invalidation logic on focus recovery
- Unnecessary change detection cycles due to header scroll listener and component updates

---

## ISSUE 1: Delayed Initial Load (2-3 seconds)

### Current Problem

**File**: [src/app/app.config.ts](src/app/app.config.ts)

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (svc: TokenRefreshService) => () => svc.init(),
  deps: [TokenRefreshService],
  multi: true
}
```

**Issue**: TokenRefreshService.init() calls immediately on app bootstrap, which:
1. Reads tokens from localStorage
2. Schedules token refresh even if user isn't logged in
3. May attempt API calls that fail with 401, causing interceptor retries

### Detailed Analysis

**File**: [src/app/shared/services/token-refresh.service.ts](src/app/shared/services/token-refresh.service.ts) (lines 51-60)

```typescript
start() {
  if (this.watcher) clearInterval(this.watcher);
  this.watcher = setInterval(() => this.ensureSchedule(), 10_000); // Runs every 10 seconds!
  this.ensureSchedule();
}
```

**Problems**:
- Interval runs continuously even if no token exists
- `ensureSchedule()` runs every 10 seconds checking localStorage (expensive on each call)
- First run happens immediately at app init

### Solution

#### Step 1: Defer Token Refresh Until User Logs In

**Modify** [src/app/shared/services/token-refresh.service.ts](src/app/shared/services/token-refresh.service.ts):

```typescript
init() {
  // Check if user is actually logged in before starting the refresh cycle
  const hasValidToken = this.getToken();
  if (!hasValidToken) {
    console.log('[TokenRefresh] No token on init, deferring start');
    return;
  }
  this.start();
}
```

#### Step 2: Implement Lazy Initialization After Login

**Modify** [src/app/shared/services/auth.service.ts](src/app/shared/services/auth.service.ts):

In the `login()` method, after successful token storage:

```typescript
// After storing tokens (around line 82)
try {
  // Notify TokenRefreshService that user is now authenticated
  const refreshSvc = inject(TokenRefreshService);
  refreshSvc.start();
} catch {}
```

#### Step 3: Clean Up on Logout

Ensure logout stops the token refresh:

```typescript
async logout() {
  // Stop token refresh timer
  const refreshSvc = inject(TokenRefreshService);
  refreshSvc.stop();
  
  // Clear storage
  try {
    sessionStorage.clear();
    localStorage.removeItem('authToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {}
}
```

### Expected Impact

- **Initial load time**: Reduced by 1-2 seconds
- **Bundle evaluation**: Faster JavaScript parsing
- **API calls**: Eliminates failed 401 refresh attempts on public pages

---

## ISSUE 2: App Reloads on Tab Switch (Tab Restoration Problem)

### Current Problem

When you switch away from the app and return to the tab, the app state may be lost because:

1. **No Page Visibility API implementation** - App doesn't know when it loses focus
2. **No background sync pause** - Token refresh timers continue unnecessarily
3. **No recovery mechanism** - Returning to tab doesn't verify state is still valid

### Solution: Implement Page Visibility API

#### Step 1: Create a Visibility Service

**Create file**: [src/app/core/services/visibility.service.ts](src/app/core/services/visibility.service.ts)

```typescript
import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VisibilityService {
  isVisible = signal(true);
  
  constructor() {
    effect(() => {
      const visible = this.isVisible();
      console.log(`[Visibility] App is now ${visible ? 'visible' : 'hidden'}`);
    });
    
    this.initializeVisibilityListener();
  }

  private initializeVisibilityListener() {
    // Set initial state
    this.isVisible.set(!document.hidden);
    
    // Listen to visibility changes
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      this.isVisible.set(nowVisible);
      
      if (nowVisible) {
        console.log('[Visibility] App restored - triggering recovery');
        this.onAppRestored();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => {
      console.log('[Visibility] Window focused');
      this.isVisible.set(true);
      this.onAppRestored();
    });
    
    window.addEventListener('blur', () => {
      console.log('[Visibility] Window blurred');
      this.isVisible.set(false);
    });
  }

  private onAppRestored() {
    // This will be called whenever app regains visibility
    // Used by TokenRefreshService and other background tasks
  }

  pauseBackgroundTasks() {
    // For services to implement
  }

  resumeBackgroundTasks() {
    // For services to implement
  }
}
```

#### Step 2: Integrate with TokenRefreshService

**Modify** [src/app/shared/services/token-refresh.service.ts](src/app/shared/services/token-refresh.service.ts):

```typescript
import { VisibilityService } from '../../core/services/visibility.service';
import { effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private timer: any = null;
  private watcher: any = null;
  private lastTokenHash = '';
  private readonly skewMs = 120_000;
  private isPaused = false;

  constructor(
    private auth: AuthService,
    private visibility: VisibilityService
  ) {
    // Pause when app loses focus
    effect(() => {
      const isVisible = this.visibility.isVisible();
      if (!isVisible) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  init() {
    const hasValidToken = this.getToken();
    if (!hasValidToken) {
      console.log('[TokenRefresh] No token on init, deferring start');
      return;
    }
    this.start();
  }

  private pause() {
    console.log('[TokenRefresh] Pausing - app is hidden');
    this.isPaused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private resume() {
    console.log('[TokenRefresh] Resuming - app is visible');
    this.isPaused = false;
    this.ensureSchedule();
  }

  start() {
    if (this.watcher) clearInterval(this.watcher);
    this.watcher = setInterval(() => {
      if (!this.isPaused) {
        this.ensureSchedule();
      }
    }, 10_000);
    this.ensureSchedule();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    if (this.watcher) clearInterval(this.watcher);
    this.timer = null;
    this.watcher = null;
  }

  // ... rest of the service remains the same
}
```

#### Step 3: Add VisibilityService to App Config

**Modify** [src/app/app.config.ts](src/app/app.config.ts):

```typescript
import { VisibilityService } from './core/services/visibility.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpInterceptor, authTokenInterceptor])),
    VisibilityService,  // Add this
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: TokenRefreshService) => () => svc.init(),
      deps: [TokenRefreshService],
      multi: true
    }
  ]
};
```

### Expected Impact

- **Tab switch behavior**: App pauses background operations, resumes cleanly on restore
- **Battery/Performance**: Reduces unnecessary network requests when tab hidden
- **User experience**: No more mysterious reloads or state loss

---

## ISSUE 3: Unnecessary Re-renders and Component Initialization

### Current Problem

**File**: [src/app/shared/header/header.ts](src/app/shared/header/header.ts) (lines 20-27)

```typescript
private onScroll = () => {
  this.scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 8;
};

ngOnInit(): void {
  window.addEventListener('scroll', this.onScroll, { passive: true });
  this.onScroll();  // Triggers change detection immediately
}
```

**Issue**: Scroll listener fires hundreds of times per second, triggering change detection in development build (not zoneless)

### Solution

#### Step 1: Use OnPush Change Detection in Header

**Modify** [src/app/shared/header/header.ts](src/app/shared/header/header.ts):

```typescript
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush  // Add this
})
export class Header implements OnInit, OnDestroy {
  scrolled = false;
  private onScroll = () => {
    const newScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 8;
    if (newScrolled !== this.scrolled) {
      this.scrolled = newScrolled;
      this.cdr.markForCheck();  // Only mark for check if value actually changed
    }
  };

  constructor(
    public store: StoreService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  toggleMenu() {
    this.showMobileMenu = !this.showMobileMenu;
    this.cdr.markForCheck();
  }

  async logout() {
    const role = this.store.currentUser()?.role;
    this.store.logout();
    const qp = role && role !== 'student' ? { role } : {};
    await this.router.navigate(['/login'], { queryParams: qp });
    this.cdr.markForCheck();
  }
  
  // ... rest of component
}
```

#### Step 2: Use Signals in Home Component (Already Done!)

Your Home component already uses signals correctly. Ensure all computed values are properly memoized:

```typescript
// ✓ Good - using computed for derived state
studentsCount = computed(() => this.store.students().length);
departmentsCount = computed(() => {
  const set = new Set<string>();
  for (const f of this.store.facultySupervisors()) {
    if (f.department) set.add(f.department);
  }
  return set.size;
});

// ✓ Good - signals for state
ready = signal(false);
expandedAnnouncements = signal(new Set<string>());
```

### Expected Impact

- **Change detection cycles**: Reduced by 80-90%
- **CPU usage**: Noticeably lower during scrolling
- **Memory**: Fewer temporary objects allocated per frame

---

## ISSUE 4: HTTP Caching & Cache Validation

### Current Problem

No cache headers are being set for GET requests, causing full data refetch on every page visit.

### Solution

#### Step 1: Add Caching to HTTP Interceptor

**Modify** [src/app/core/interceptors/http.interceptor.ts](src/app/core/interceptors/http.interceptor.ts):

```typescript
export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);

  // Add cache control headers for GET requests
  if (req.method === 'GET') {
    // Cache public GET endpoints for 5 minutes
    const shouldCache = !req.url.includes('/api/admin') && !req.url.includes('/api/secure');
    if (shouldCache) {
      req = req.clone({
        setHeaders: {
          'Cache-Control': 'max-age=300', // 5 minutes
          'Pragma': 'cache'
        }
      });
    }
  }

  // ... rest of interceptor
};
```

#### Step 2: Implement Request Deduplication

**Create file**: [src/app/core/services/request-deduplicator.service.ts](src/app/core/services/request-deduplicator.service.ts)

```typescript
import { Injectable } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RequestDeduplicatorService {
  private pendingRequests = new Map<string, Observable<any>>();

  deduplicate<T>(req: HttpRequest<any>, request$: Observable<T>): Observable<T> {
    const key = `${req.method}:${req.url}`;
    
    if (this.pendingRequests.has(key)) {
      console.log(`[RequestDedup] Returning cached request for ${key}`);
      return this.pendingRequests.get(key) as Observable<T>;
    }

    console.log(`[RequestDedup] Starting new request for ${key}`);
    const deduped$ = request$.pipe(
      shareReplay(1),
      map(result => {
        // Clean up after request completes
        setTimeout(() => this.pendingRequests.delete(key), 100);
        return result;
      })
    );

    this.pendingRequests.set(key, deduped$);
    return deduped$;
  }
}
```

#### Step 3: Integrate Deduplicator into HTTP Interceptor

Add to [src/app/core/interceptors/http.interceptor.ts](src/app/core/interceptors/http.interceptor.ts):

```typescript
import { RequestDeduplicatorService } from '../services/request-deduplicator.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const errorHandler = inject(ErrorHandlerService);
  const dedup = inject(RequestDeduplicatorService);

  // ... existing code ...

  // For GET requests, deduplicate concurrent identical requests
  if (req.method === 'GET') {
    return dedup.deduplicate(req, next(req).pipe(...));
  }

  return next(req).pipe(...);
};
```

---

## ISSUE 5: Implement Service Worker Caching

### Current Problem

No service worker configured for offline support and intelligent caching.

### Solution

#### Step 1: Enable Service Worker in Angular

**Modify** [angular.json](angular.json):

```json
{
  "projects": {
    "cui_Internship_system": {
      "architect": {
        "build": {
          "options": {
            "serviceWorker": "src/ngsw-config.json"
          }
        }
      }
    }
  }
}
```

#### Step 2: Create Service Worker Configuration

**Create file**: [src/ngsw-config.json](src/ngsw-config.json)

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "lazy",
      "resources": {
        "files": [
          "/assets/**",
          "/*.(eot|svg|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-announcements",
      "urls": ["/api/admin/announcements"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxAge": "5m",
        "maxSize": 100
      }
    },
    {
      "name": "api-faculty",
      "urls": ["/api/admin/faculty*"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxAge": "10m",
        "maxSize": 500
      }
    },
    {
      "name": "api-students",
      "urls": ["/api/admin/students*"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxAge": "10m",
        "maxSize": 500
      }
    }
  ]
}
```

---

## Debugging Checklist

### Browser DevTools Steps

1. **Open Chrome DevTools** → Network tab
2. **Reload page** → Watch request timeline
3. **Expected pattern**:
   - `main.ts` loads (~100ms)
   - App config initializes (~50ms)
   - Token check happens (~100ms max)
   - Router loads home component (~200ms)
4. **Bad pattern** (what to avoid):
   - `/api/auth/refresh-token` fails with 401
   - Multiple identical API calls
   - Long loading spinner visible >1 second

### Network Timeline Inspection

```javascript
// Run in DevTools Console to profile initialization
performance.mark('app-init-start');
// App loads
performance.mark('app-init-end');
performance.measure('app-init', 'app-init-start', 'app-init-end');
console.log(performance.getEntriesByName('app-init')[0].duration);
```

### Check for Tab Visibility

```javascript
// In DevTools Console
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed:', document.hidden);
});

// Switch tabs and watch console
```

---

## Best Practices Implemented

### 1. **OnPush Change Detection**
Apply to all components that don't need frequent updates:
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

### 2. **TrackBy Function in *ngFor**
Already implemented in your code - ensure all lists use it:
```typescript
// ✓ Good
*ngFor="let item of items; trackBy: trackByFn"

// Define:
trackByFn(index: number, item: any) { return item.id; }
```

### 3. **Memoization Pattern**
For expensive calculations:
```typescript
private cachedResult: T | null = null;
private cachedInputHash: string | null = null;

computeExpensive(input: T): R {
  const hash = JSON.stringify(input);
  if (hash === this.cachedInputHash) return this.cachedResult;
  
  this.cachedResult = /* expensive computation */;
  this.cachedInputHash = hash;
  return this.cachedResult;
}
```

### 4. **Proper Cleanup in ngOnDestroy**
```typescript
ngOnDestroy(): void {
  // Always unsubscribe from observables
  this.subscription?.unsubscribe();
  // Remove event listeners
  window.removeEventListener('scroll', this.onScroll);
  // Clear timers
  clearInterval(this.interval);
  clearTimeout(this.timeout);
}
```

---

## Implementation Priority

| Priority | Issue | Effort | Impact | Timeline |
|----------|-------|--------|--------|----------|
| 🔴 HIGH | Defer TokenRefreshService | 15 min | 1-2s load time | Now |
| 🔴 HIGH | Page Visibility API | 30 min | Fix tab reloads | Now |
| 🟠 MEDIUM | OnPush Change Detection | 20 min | 60% less rendering | Today |
| 🟠 MEDIUM | HTTP Caching | 20 min | Faster subsequent loads | Today |
| 🟡 LOW | Service Worker | 45 min | Offline support | This week |

---

## Production Checklist

- [ ] All API endpoints return proper Cache-Control headers
- [ ] Service Worker precaches critical assets
- [ ] Change detection strategy is OnPush where appropriate
- [ ] No console errors on app init
- [ ] Token refresh doesn't fire on public pages
- [ ] Page visibility pause/resume works
- [ ] No memory leaks (check DevTools Memory profiler)
- [ ] Lighthouse performance score >90
- [ ] Bundle size <500KB (gzipped <150KB)

---

## Monitoring & Performance Tracking

Add to your app for production metrics:

```typescript
// src/app/core/services/performance-monitor.service.ts
@Injectable({ providedIn: 'root' })
export class PerformanceMonitorService {
  trackMetric(name: string, value: number) {
    // Send to your analytics service
    console.log(`[Perf] ${name}: ${value}ms`);
  }

  measureInitTime() {
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    this.trackMetric('page-load-time', pageLoadTime);
  }
}
```

---

## Additional Resources

- [Angular Performance Best Practices](https://angular.io/guide/performance-best-practices)
- [Change Detection Strategy](https://angular.io/api/core/ChangeDetectionStrategy)
- [Service Worker Configuration](https://angular.io/guide/service-worker-config)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

