# Quick Start Guide - Using the New Architecture

## 🚀 Immediate Benefits You Can Use Right Now

### 1. Button Loading States (FIXES YOUR BUTTON ISSUE)

**Problem**: Buttons don't properly reset after API calls  
**Solution**: Use `ButtonLoadingDirective`

```typescript
// Component
import { ButtonLoadingDirective } from './core/directives/button-loading.directive';

@Component({
  imports: [ButtonLoadingDirective],
  // ...
})
export class MyComponent {
  isSubmitting = signal(false);
  
  async submit(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      await this.api.saveData(this.form);
      this.toast.success('Saved!');
    } catch (error) {
      // Error automatically handled by ErrorHandlerService
    } finally {
      this.isSubmitting.set(false); // ← Always resets!
    }
  }
}
```

```html
<!-- Template -->
<button [appButtonLoading]="isSubmitting()">
  Save Changes
</button>
<!-- Button auto-shows spinner, disables, and resets! -->
```

### 2. Global Loading Spinner

Already added to your app! Works automatically with all HTTP requests.

To manually control:
```typescript
import { inject } from '@angular/core';
import { LoadingService } from './core/services/loading.service';

export class MyComponent {
  private loading = inject(LoadingService);
  
  async doSomething(): Promise<void> {
    // Option 1: Manual control
    this.loading.show();
    await this.performTask();
    this.loading.hide();
    
    // Option 2: Auto-managed
    await this.loading.withLoading(() => this.performTask());
  }
}
```

### 3. API Caching (FIXES SLOW API RESPONSES)

**Problem**: API calls take too long, same data fetched repeatedly  
**Solution**: Use `AdminApiService`

```typescript
import { inject } from '@angular/core';
import { AdminApiService } from './shared/services/admin-api.service';

export class MyComponent {
  private api = inject(AdminApiService);
  
  async loadCompanies(): Promise<void> {
    // First call: fetches from server
    // Subsequent calls within 5min: instant from cache!
    const companies = await this.api.getCompanies();
    
    // Force refresh:
    const freshData = await this.api.getCompanies(true);
  }
  
  async searchFaculty(query: string): Promise<void> {
    // Auto-debounced and cached!
    const results = await this.api.searchFaculty(query);
  }
}
```

### 4. Search Input with Debouncing

**Problem**: Search triggers too many API calls  
**Solution**: Use `SearchInputComponent`

```typescript
import { SearchInputComponent } from './shared/components/search-input/search-input.component';

@Component({
  imports: [SearchInputComponent],
  template: `
    <app-search-input
      placeholder="Search students..."
      [debounceTime]="300"
      (search)="onSearch($event)">
    </app-search-input>
  `
})
export class MyComponent {
  onSearch(query: string): void {
    // Only called after user stops typing for 300ms!
    this.searchQuery.set(query);
  }
}
```

### 5. Angular Signals for State

**Before (Old way):**
```typescript
export class OldComponent {
  students: Student[] = [];
  loading = false;
  
  // Must manually trigger change detection
  async load(): Promise<void> {
    this.loading = true;
    this.students = await this.api.getStudents();
    this.loading = false;
    this.cdr.markForCheck(); // ← Need to remember this!
  }
}
```

**After (New way):**
```typescript
export class NewComponent {
  students = signal<Student[]>([]);
  loading = signal(false);
  
  // Auto-tracked, auto-updates UI!
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.api.getStudents();
      this.students.set(data);
    } finally {
      this.loading.set(false);
    }
  }
  
  // Computed values auto-update
  approvedStudents = computed(() => {
    return this.students().filter(s => s.approved);
  });
}
```

```html
<!-- Template automatically updates -->
@if (loading()) {
  <div>Loading...</div>
} @else {
  @for (student of students(); track student.id) {
    <div>{{ student.name }}</div>
  }
}

<p>Approved: {{ approvedStudents().length }}</p>
```

### 6. TrackBy for Performance

**Problem**: ngFor re-renders everything on small changes  
**Solution**: Always use trackBy

```typescript
import { trackById } from './core/utils/track-by.utils';

export class MyComponent {
  items = signal<Item[]>([]);
  trackByItemId = trackById; // ← Reusable utility
}
```

```html
@for (item of items(); track trackByItemId($index, item)) {
  <div>{{ item.name }}</div>
}
```

### 7. OnPush Change Detection

**Add to EVERY component for better performance:**

```typescript
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-my-component',
  changeDetection: ChangeDetectionStrategy.OnPush, // ← Add this!
  // ...
})
export class MyComponent {
  // When using OnPush, MUST use Signals or Observables
  // for automatic change detection
}
```

## 📋 Converting Existing Admin Component

### Step 1: Create New Sub-Component

Use the APEX A component as a template. File structure:
```
features/admin/
└── my-feature/
    ├── my-feature.component.ts
    ├── my-feature.component.html
    └── my-feature.component.css
```

**Template** (copy this):
```typescript
import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonLoadingDirective } from '../../../core/directives/button-loading.directive';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { PaginatorComponent } from '../../../shared/pagination/paginator';
import { trackById } from '../../../core/utils/track-by.utils';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-my-feature',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonLoadingDirective,
    SearchInputComponent,
    PaginatorComponent
  ],
  templateUrl: './my-feature.component.html',
  styleUrls: ['./my-feature.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyFeatureComponent {
  private toast = inject(ToastService);
  
  // State
  items = signal<MyItem[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  
  // Computed
  filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.items().filter(item => 
      item.name.toLowerCase().includes(query)
    );
  });
  
  // Utils
  trackByItemId = trackById;
  
  async loadItems(): Promise<void> {
    this.loading.set(true);
    try {
      // Your API call here
      const data = await this.api.getItems();
      this.items.set(data);
    } finally {
      this.loading.set(false);
    }
  }
}
```

### Step 2: Update Parent Admin Component

```typescript
// admin.ts
import { MyFeatureComponent } from './my-feature/my-feature.component';

@Component({
  imports: [/* ... */, MyFeatureComponent],
  template: `
    @switch (currentTab) {
      @case ('myFeature') {
        <app-my-feature />
      }
    }
  `
})
```

## ⚡ Performance Checklist

For every component you create or refactor:

- ✅ Use `ChangeDetectionStrategy.OnPush`
- ✅ Use `signal()` for all state
- ✅ Use `computed()` for derived values
- ✅ Add `trackBy` to all `@for` loops
- ✅ Use `ButtonLoadingDirective` for submit buttons
- ✅ Inject services with `inject()` instead of constructor
- ✅ Use `AdminApiService` for cached API calls
- ✅ Keep components < 300 lines (break into smaller ones)
- ✅ Make components standalone
- ✅ Use proper TypeScript types

## 🔍 Debugging Tips

### Check if signals are working:
```typescript
// In component
ngAfterViewInit(): void {
  // Should see updates in console
  effect(() => {
    console.log('Students changed:', this.students());
  });
}
```

### Check if caching is working:
```typescript
// In browser console
// First call: shows "Loading from server"
// Second call: instant (from cache)
await this.api.getCompanies();
```

### Check loading state:
```typescript
// In browser DevTools, watch the global spinner
// Should show/hide automatically with HTTP calls
```

## 📊 Migration Priority

Migrate in this order for maximum impact:

1. **Forms with submit buttons** → Use `ButtonLoadingDirective` ✅
2. **Search features** → Use `SearchInputComponent` + API caching ✅
3. **Large data lists** → Use `trackBy` + `OnPush` ✅
4. **Frequently called APIs** → Use `AdminApiService` caching ✅

## 🎯 Quick Wins

Do these NOW for immediate improvements:

1. Add `[appButtonLoading]` to all submit buttons
2. Replace search inputs with `<app-search-input>`
3. Use `AdminApiService` for company/faculty/site APIs
4. Add `trackBy` to all @for loops in admin component
5. Add `ChangeDetectionStrategy.OnPush` to all components

## 📞 Need Help?

- Check `REFACTORING_GUIDE.md` for detailed patterns
- Look at `apex-a-management.component.ts` for complete example
- Check core services in `core/services/` for API documentation

---

**Remember**: You don't have to refactor everything at once!  
Start with high-impact, small changes (button loading states, caching) and gradually migrate to the new architecture.
