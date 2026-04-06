# Skeleton Loading System Documentation

## Overview
Skeleton loading provides a smooth user experience by showing placeholder content while API data loads. This system is scalable, reusable, and integrates cleanly with existing Angular code.

## Components

### 1. SkeletonComponent
Single skeleton placeholder with multiple types.

**Types Available:**
- `text` - Simple text line
- `card` - Card with image and text
- `image` - Image placeholder
- `table-row` - Table row with cells
- `list-item` - List item with avatar and content
- `button` - Button placeholder
- `badge` - Badge/tag placeholder

**Usage:**
```html
<!-- Show skeleton while loading, show content when loaded -->
<app-skeleton [type]="'card'" [isLoading]="loading">
  <div>Your actual content here</div>
</app-skeleton>
```

### 2. SkeletonListComponent
Display multiple skeleton items (useful for lists/tables).

**Usage:**
```html
<!-- Show 5 skeleton list items while loading -->
<app-skeleton-list 
  [isLoading]="loading" 
  [count]="5" 
  [type]="'table-row'">
</app-skeleton-list>

<!-- Show actual table rows when loaded -->
@if (!loading) {
  @for (item of items; track item.id) {
    <tr>{{ item.name }}</tr>
  }
}
```

### 3. SkeletonLoaderService
Centralized state management for loading states.

**Usage:**
```typescript
import { SkeletonLoaderService } from '@core/services/skeleton-loader.service';

export class ComplaintsComponent {
  constructor(private skeletonLoader: SkeletonLoaderService) {}

  // Method 1: Manual state management
  async loadComplaints() {
    this.skeletonLoader.setLoading('complaints', true);
    try {
      await this.api.getComplaints();
    } finally {
      this.skeletonLoader.setLoading('complaints', false);
    }
  }

  // Method 2: Using convenience wrapper
  async loadComplaints() {
    await this.skeletonLoader.withLoading('complaints', async () => {
      await this.api.getComplaints();
    });
  }

  // In template
  isLoading = () => this.skeletonLoader.isLoading('complaints');
}
```

**In Template:**
```html
<app-skeleton-list [isLoading]="isLoading()" [count]="10" [type]="'table-row'"></app-skeleton-list>

@if (!isLoading()) {
  <!-- Your actual content here -->
  @for (item of items; track item.id) {
    <div>{{ item.name }}</div>
  }
}
```

## Integration Patterns

### Pattern 1: API Call with Skeleton
```typescript
// Component
export class DataListComponent implements OnInit {
  items$ = signal<Item[]>([]);
  loading$ = this.skeletonLoader.isLoading('data-list');

  constructor(
    private api: ApiService,
    private skeletonLoader: SkeletonLoaderService
  ) {}

  ngOnInit() {
    this.loadItems();
  }

  async loadItems() {
    await this.skeletonLoader.withLoading('data-list', async () => {
      const response = await this.api.getItems();
      this.items$.set(response.items || []);
    });
  }
}

// Template
<app-skeleton-list [isLoading]="loading$()" [count]="5" [type]="'list-item'"></app-skeleton-list>

@if (!loading$()) {
  @for (item of items$(); track item.id) {
    <div class="list-item">
      <h5>{{ item.name }}</h5>
      <p>{{ item.description }}</p>
    </div>
  }
}
```

### Pattern 2: Detail Page with Multiple Sections
```typescript
export class DetailComponent implements OnInit {
  data$ = signal<DataDetail | null>(null);
  headerLoading = this.skeletonLoader.isLoading('detail-header');
  contentLoading = this.skeletonLoader.isLoading('detail-content');
  metaLoading = this.skeletonLoader.isLoading('detail-meta');

  constructor(
    private api: ApiService,
    private skeletonLoader: SkeletonLoaderService
  ) {}

  ngOnInit() {
    this.loadDetails();
  }

  async loadDetails() {
    await Promise.all([
      this.loadHeader(),
      this.loadContent(),
      this.loadMetadata()
    ]);
  }

  private async loadHeader() {
    await this.skeletonLoader.withLoading('detail-header', async () => {
      const response = await this.api.getDetailHeader();
      this.data$.update(v => ({ ...v, ...response }));
    });
  }

  private async loadContent() {
    await this.skeletonLoader.withLoading('detail-content', async () => {
      const response = await this.api.getDetailContent();
      this.data$.update(v => ({ ...v, ...response }));
    });
  }

  private async loadMetadata() {
    await this.skeletonLoader.withLoading('detail-meta', async () => {
      const response = await this.api.getDetailMeta();
      this.data$.update(v => ({ ...v, ...response }));
    });
  }
}

// Template
<!-- Header Section -->
<app-skeleton [type]="'image'" [isLoading]="headerLoading()"></app-skeleton>
@if (!headerLoading() && data$()) {
  <img [src]="data$()!.image" />
}

<!-- Content Section -->
<app-skeleton-list [isLoading]="contentLoading()" [count]="3" [type]="'text'"></app-skeleton-list>
@if (!contentLoading() && data$()) {
  <div>{{ data$()!.content }}</div>
}

<!-- Metadata Section -->
<app-skeleton [type]="'badge'" [isLoading]="metaLoading()"></app-skeleton>
@if (!metaLoading() && data$()) {
  <span class="badge">{{ data$()!.status }}</span>
}
```

### Pattern 3: Table Loading
```typescript
export class ComplaintsComponent {
  complaints$ = signal<Complaint[]>([]);
  loading$ = this.skeletonLoader.isLoading('complaints-table');

  constructor(
    private api: AdminService,
    private skeletonLoader: SkeletonLoaderService
  ) {}

  async loadComplaints() {
    await this.skeletonLoader.withLoading('complaints-table', async () => {
      const response = await this.api.getAdminComplaints();
      this.complaints$.set(response.complaints || []);
    });
  }
}

// Template
<div class="table-responsive">
  <table class="table">
    <tbody>
      <!-- Skeleton rows -->
      <app-skeleton-list 
        [isLoading]="loading$()" 
        [count]="5" 
        [type]="'table-row'">
      </app-skeleton-list>

      <!-- Real rows -->
      @if (!loading$()) {
        @for (complaint of complaints$(); track complaint.id) {
          <tr>
            <td>{{ complaint.subject }}</td>
            <td>{{ complaint.status }}</td>
            <td>{{ complaint.createdAt | date }}</td>
          </tr>
        }
      }
    </tbody>
  </table>
</div>
```

## Best Practices

✅ **DO:**
- Use skeleton for API calls that load lists or detailed content
- Show skeleton immediately when request starts
- Hide skeleton as soon as response arrives (success or error)
- Keep skeleton count similar to displayed items
- Use appropriate skeleton type for content
- Test with slow networks

❌ **DON'T:**
- Use skeleton for button actions
- Use skeleton for form submissions
- Show skeleton and spinner simultaneously
- Use skeleton for small inline updates
- Forget to reset loading state on error
- Create new loading keys for every component

## Styling Guide

The skeleton component comes with:
- Shimmer animation (2s continuous)
- Responsive design
- No borders (clean look)
- Gray gradient background
- Customizable via parent component styling

To customize, override these CSS variables in your global styles:
```scss
// Light gray shimmer
$skeleton-color: #e0e0e0;
$skeleton-animation-duration: 2s;
```

## Integration with Existing Code

### Before (no skeleton):
```html
@if (loading) {
  <div class="spinner"></div>
}
@if (!loading && items.length > 0) {
  @for (item of items; track item.id) {
    <div>{{ item.name }}</div>
  }
}
```

### After (with skeleton):
```html
<app-skeleton-list [isLoading]="loading" [count]="5" [type]="'list-item'"></app-skeleton-list>

@if (!loading && items.length > 0) {
  @for (item of items; track item.id) {
    <div>{{ item.name }}</div>
  }
}
```

## Common Scenarios

### Scenario 1: Initial Page Load
- Show full page skeleton on first load
- Replace with real content when ready

### Scenario 2: Pagination
- Keep header visible, show skeleton only for new rows
- User sees progress while new page loads

### Scenario 3: Infinite Scroll
- Show skeleton items appended to bottom
- Real items appear below loading skeleton

### Scenario 4: Search/Filter
- Show skeleton for filtered results
- Replaces old results smoothly

## Performance Considerations

- Skeleton CSS is minimal (< 2KB gzipped)
- Animation uses CSS (GPU-accelerated)
- No JavaScript during animation
- Memory efficient (no DOM cloning)
- Minimal repaints/reflows
