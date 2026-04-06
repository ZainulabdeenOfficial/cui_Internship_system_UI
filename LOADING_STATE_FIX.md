# Loading State Management - Implementation Guide

## Overview
This guide explains the new loading state management system that ensures buttons and UI elements always reset from loading state properly, regardless of API response success or failure.

## Components

### 1. RequestTrackerService
Tracks loading state for individual requests/operations.

**Usage:**
```typescript
import { RequestTrackerService } from '@app/core';

export class MyComponent {
  requestId = 'submit-form';
  
  constructor(private tracker: RequestTrackerService) {}
  
  // Check if request is loading
  isLoading$ = computed(() => this.tracker.isLoading(this.requestId));
  
  async submitForm() {
    // Manual tracking
    this.tracker.startRequest(this.requestId);
    try {
      const result = await this.apiService.submit(this.form.value);
      this.tracker.completeRequest(this.requestId);
      return result;
    } catch (error) {
      this.tracker.failRequest(this.requestId, error);
      throw error;
    }
  }
  
  // Or using the track method
  async submitFormAuto() {
    return this.tracker.track(this.requestId, () => 
      this.apiService.submit(this.form.value)
    );
  }
}
```

### 2. AsyncOperationManager
Provides utilities for executing async operations with proper cleanup.

**Usage:**
```typescript
import { AsyncOperationManager } from '@app/core';

export class MyComponent {
  isLoading = false;
  
  constructor(private asyncOp: AsyncOperationManager) {}
  
  // Method 1: Using execute
  async submitForm() {
    await this.asyncOp.execute(
      () => this.isLoading = true,
      () => this.isLoading = false,
      () => this.apiService.submit(this.form.value)
    );
  }
  
  // Method 2: Create bound executor (reusable)
  private trackLoading = this.asyncOp.createBoundExecutor(
    () => this.isLoading = true,
    () => this.isLoading = false
  );
  
  async submitForm2() {
    await this.trackLoading(() => this.apiService.submit(this.form.value));
  }
  
  // Method 3: With change detection
  async submitForm3() {
    await this.asyncOp.executeWithRefresh(
      () => this.isLoading = true,
      () => this.isLoading = false,
      () => this.apiService.submit(this.form.value),
      () => this.cdr.markForCheck()
    );
  }
  
  // Method 4: Wrap existing function
  submitting = this.asyncOp.wrapAsync(
    this.apiService.submit.bind(this.apiService),
    () => this.isLoading = true,
    () => this.isLoading = false
  );
  
  async submitForm4() {
    await this.submitting(this.form.value);
  }
}
```

### 3. LoadingService (Enhanced)
Global loading spinner state manager. Automatically shows/hides spinner during API calls.

**Usage:**
```typescript
import { LoadingService } from '@app/core';

export class MyComponent {
  isLoading = inject(LoadingService).isLoading;
  
  // Use in template
  // <app-loading-spinner *ngIf="isLoading()"></app-loading-spinner>
}
```

### 4. HTTP Interceptor (Enhanced)
Automatically manages loading states for all HTTP requests. Now includes:
- Timeout handling (2 minutes default)
- Proper error cleanup
- finalize() ensures cleanup even on network errors
- Context tokens for per-request control

**Usage in interceptor is automatic - no code needed!**

## Updated Patterns

### Pattern 1: Local Loading Flag with AsyncOperationManager
```typescript
export class StudentComponent {
  submittingForm = false;
  
  constructor(private asyncOp: AsyncOperationManager, private api: StudentService) {}
  
  async submitAppExA(data: any) {
    try {
      await this.asyncOp.execute(
        () => this.submittingForm = true,
        () => this.submittingForm = false,
        () => this.api.submitAppExA(data)
      );
      this.toast.success('Submitted successfully');
    } catch (error) {
      this.toast.danger('Submission failed');
    }
  }
}
```

### Pattern 2: RequestTracker with Per-Button States
```typescript
export class ComplaintsComponent {
  constructor(private tracker: RequestTrackerService) {}
  
  isSubmittingComplaint = computed(() => this.tracker.isLoading('submit-complaint'));
  
  async submitComplaint(data: any) {
    try {
      await this.tracker.track('submit-complaint', () =>
        this.api.submitComplaint(data)
      );
      this.toast.success('Complaint submitted');
    } catch (error) {
      this.toast.danger('Failed to submit complaint');
    }
  }
}

// In template:
// <button [disabled]="isSubmittingComplaint()">
//   <span *ngIf="isSubmittingComplaint()" class="spinner-border spinner-border-sm me-2"></span>
//   Submit Complaint
// </button>
```

### Pattern 3: Using Existing try/catch/finally (Already Working!)
```typescript
export class MyComponent {
  submittingCompanyRequest = false;
  
  async submitCompanyRequest() {
    this.submittingCompanyRequest = true;
    try {
      await this.apiService.submit(data);
      this.toast.success('Success');
    } catch (error) {
      this.toast.danger('Error: ' + error.message);
    } finally {
      this.submittingCompanyRequest = false;
      this.cdr.markForCheck();
    }
  }
}
```

## Best Practices

### ✅ DO
- Always use try/catch/finally for async operations
- Use `finalize()` with Observables
- Set loading flag in try block, reset in finally
- Test both success and error paths
- Use RequestTrackerService for multiple operations
- Use AsyncOperationManager for complex flows

### ❌ DON'T
- Set loading flag true but forget to set it to false on error
- Forget error handling that causes silent failures
- Subscribe without unsubscribing (use takeUntil or OnDestroy)
- Chain promises without error handling
- Forget to handle timeout scenarios

## Troubleshooting

### Button stuck in loading state?
1. Check if error is being thrown without catch block
2. Verify finally block is resetting the loading flag
3. Check console for unhandled promise rejections
4. Ensure component change detection is triggered

### Multiple loading states not working?
1. Use RequestTrackerService with different requestId for each operation
2. Verify requestId is consistent between start and end
3. Check for race conditions (use async/await, not separate subscriptions)

### Global spinner not showing?
1. Verify LoadingService.show() is being called (interceptor does this)
2. Check if SKIP_GLOBAL_LOADING token is set on request
3. Verify LoadingSpinnerComponent is in root layout
4. Check browser console for errors

## Migration Checklist

For existing code:
- [ ] Review all subscribe() calls and add proper error handling
- [ ] Convert to async/await where possible
- [ ] Add try/catch/finally to all async operations
- [ ] Ensure finally blocks reset loading flags
- [ ] Test error scenarios
- [ ] Verify UI state resets properly
- [ ] Check for unhandled promise rejections

## Examples

### Complete Component Migration
```typescript
// BEFORE (Problematic)
export class UserComponent {
  submitting = false;
  
  submit() {
    this.submitting = true;
    this.userService.update(this.data).subscribe(
      (result) => {
        this.toast.success('Updated');
        this.submitting = false; // Only set on success!
      },
      (error) => {
        this.toast.danger('Error');
        // submitting never set back to false on error!
      }
    );
  }
}

// AFTER (Fixed)
export class UserComponent {
  submitting = false;
  
  async submit() {
    this.submitting = true;
    try {
      const result = await this.userService.update(this.data);
      this.toast.success('Updated');
    } catch (error) {
      this.toast.danger('Error');
    } finally {
      this.submitting = false; // Always reset
    }
  }
}
```

## Testing

```typescript
it('should reset loading state on success', async () => {
  component.submitting = false;
  await component.submit();
  expect(component.submitting).toBe(false);
});

it('should reset loading state on error', async () => {
  // Mock error
  spyOn(service, 'submit').and.rejectWith(new Error('Test error'));
  
  component.submitting = false;
  try {
    await component.submit();
  } catch {}
  
  expect(component.submitting).toBe(false);
});
```

## Questions?

For more information, refer to:
- RequestTrackerService: src/app/core/services/request-tracker.service.ts
- AsyncOperationManager: src/app/core/services/async-operation.service.ts
- HTTP Interceptor: src/app/core/interceptors/http.interceptor.ts
- LoadingService: src/app/core/services/loading.service.ts
