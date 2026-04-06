/**
 * Loading State Fix - Quick Reference & Utilities
 * 
 * This file provides quick copy-paste solutions for common loading state issues
 */

/**
 * SOLUTION 1: Simple Async/Await Pattern
 * Use this for most cases
 * 
 * @example
 * async submitForm() {
 *   this.isLoading = true;
 *   try {
 *     await this.api.submit(data);
 *     this.toast.success('Success');
 *   } catch (error) {
 *     this.toast.danger('Error: ' + error.message);
 *   } finally {
 *     this.isLoading = false;
 *   }
 * }
 */
export const PATTERN_1_SIMPLE_ASYNC = `
async submitForm() {
  this.isLoading = true;
  try {
    await this.apiService.submit(data);
    this.toast.success('Success');
  } catch (error) {
    this.toast.danger('Error: ' + error.message);
  } finally {
    this.isLoading = false;
  }
}
`;

/**
 * SOLUTION 2: Using AsyncOperationManager
 * Use this for cleaner code or when you have multiple operations
 * 
 * @example
 * async submitForm() {
 *   await this.asyncOp.execute(
 *     () => this.isLoading = true,
 *     () => this.isLoading = false,
 *     () => this.apiService.submit(data)
 *   );
 * }
 */
export const PATTERN_2_ASYNC_MANAGER = `
async submitForm() {
  try {
    await this.asyncOp.execute(
      () => this.isLoading = true,
      () => this.isLoading = false,
      () => this.apiService.submit(data)
    );
    this.toast.success('Success');
  } catch (error) {
    this.toast.danger('Error: ' + error.message);
  }
}
`;

/**
 * SOLUTION 3: Using RequestTracker for Per-Button States
 * Use this when you have multiple independent buttons
 * 
 * @example
 * isSubmittingComplaint = computed(() => this.tracker.isLoading('submit-complaint'));
 * 
 * async submitComplaint() {
 *   try {
 *     await this.tracker.track('submit-complaint', () =>
 *       this.apiService.submitComplaint(data)
 *     );
 *     this.toast.success('Success');
 *   } catch (error) {
 *     this.toast.danger('Error: ' + error.message);
 *   }
 * }
 */
export const PATTERN_3_REQUEST_TRACKER = `
isSubmittingComplaint = computed(() => this.tracker.isLoading('submit-complaint'));

async submitComplaint() {
  try {
    await this.tracker.track('submit-complaint', () =>
      this.apiService.submitComplaint(data)
    );
    this.toast.success('Success');
  } catch (error) {
    this.toast.danger('Error: ' + error.message);
  }
}
`;

/**
 * SOLUTION 4: Fixed Observable Pattern
 * Use this if you must use Observables
 * 
 * @example
 * submitForm() {
 *   this.isLoading = true;
 *   this.apiService.submit(data).pipe(
 *     catchError(error => {
 *       this.toast.danger('Error: ' + error.message);
 *       return throwError(() => error);
 *     }),
 *     finalize(() => {
 *       this.isLoading = false;
 *       this.cdr.markForCheck();
 *     })
 *   ).subscribe(
 *     (result) => this.toast.success('Success')
 *   );
 * }
 */
export const PATTERN_4_OBSERVABLE = `
submitForm() {
  this.isLoading = true;
  this.apiService.submit(data).pipe(
    catchError(error => {
      this.toast.danger('Error: ' + error.message);
      return throwError(() => error);
    }),
    finalize(() => {
      this.isLoading = false;
      this.cdr.markForCheck();
    })
  ).subscribe(
    (result) => this.toast.success('Success')
  );
}
`;

/**
 * SOLUTION 5: Template Binding Pattern
 * Use this in templates with the built-in ButtonLoadingDirective
 */
export const PATTERN_5_TEMPLATE = `
<!-- In template -->
<button 
  (click)="submitForm()" 
  [disabled]="isLoading"
  [appButtonLoading]="isLoading"
  loadingText="Submitting...">
  Submit Form
</button>

<!-- Or with RequestTracker -->
<button 
  (click)="submitComplaint()" 
  [disabled]="isSubmittingComplaint()">
  <span *ngIf="isSubmittingComplaint()" class="spinner-border spinner-border-sm me-2"></span>
  Submit Complaint
</button>
`;

/**
 * COMMON MISTAKES TO AVOID
 */
export const COMMON_MISTAKES = [
  {
    mistake: 'Forgetting to reset loading on error',
    wrong: `
      this.loading = true;
      this.api.submit(data).subscribe(
        result => { this.loading = false; },
        error => { } // WRONG! Never reset loading
      );
    `,
    correct: `
      this.loading = true;
      this.api.submit(data).subscribe(
        result => { this.loading = false; },
        error => { this.loading = false; } // CORRECT!
      );
    `
  },
  {
    mistake: 'Not using finally block',
    wrong: `
      this.loading = true;
      this.apiService.submit(data)
        .then(() => this.loading = false)
        .catch(() => { }); // Never resets on error
    `,
    correct: `
      this.loading = true;
      try {
        await this.apiService.submit(data);
      } finally {
        this.loading = false; // Always resets
      }
    `
  },
  {
    mistake: 'Missing change detection',
    wrong: `
      this.loading = false;
      // UI doesn't update if OnPush change detection is used
    `,
    correct: `
      this.loading = false;
      this.cdr.markForCheck(); // Trigger change detection
    `
  },
  {
    mistake: 'Race condition from multiple clicks',
    wrong: `
      async submitForm() {
        this.isLoading = true;
        await this.api.submit(data);
        this.isLoading = false;
      }
      // User can click multiple times!
    `,
    correct: `
      async submitForm() {
        if (this.isLoading) return; // Guard against re-entry
        this.isLoading = true;
        try {
          await this.api.submit(data);
        } finally {
          this.isLoading = false;
        }
      }
    `
  }
];

/**
 * Quick checklist for fixing loading state issues
 */
export const LOADING_STATE_CHECKLIST = {
  'Code Review': [
    'Does loading flag get set to FALSE on error?',
    'Is there a FINALLY block or equivalent?',
    'Are all code paths covered?',
    'Is change detection triggered after state change?'
  ],
  'Testing': [
    'Test success scenario - does loading reset?',
    'Test error scenario - does loading reset?',
    'Test timeout scenario - does loading reset?',
    'Test network error - does loading reset?'
  ],
  'Performance': [
    'Is change detection being triggered unnecessarily?',
    'Are there memory leaks from unclosed subscriptions?',
    'Is the UI freezing during loading?',
    'Are there console warnings about memory?'
  ]
};

/**
 * Quick Reference for Services
 */
export const SERVICES_REFERENCE = {
  'AsyncOperationManager': {
    usage: 'General async operations with auto cleanup',
    import: "import { AsyncOperationManager } from '@app/core';",
    methods:
      'execute, executeWithRefresh, wrapAsync, createBoundExecutor, executeSequential'
  },
  'RequestTrackerService': {
    usage: 'Per-request loading state tracking',
    import: "import { RequestTrackerService } from '@app/core';",
    methods: 'track, startRequest, completeRequest, failRequest, isLoading'
  },
  'LoadingService': {
    usage: 'Global loading spinner state',
    import: "import { LoadingService } from '@app/core';",
    methods: 'show, hide, forceHide, withLoading'
  }
};
