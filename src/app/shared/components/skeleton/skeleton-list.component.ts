import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent, SkeletonType } from './skeleton.component';

/**
 * Multi-Skeleton Component
 * Displays multiple skeleton items for loading lists/tables
 * Usage:
 *   <app-skeleton-list [isLoading]="loading" [count]="5" [type]="'table-row'"></app-skeleton-list>
 */
@Component({
  selector: 'app-skeleton-list',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    @if (isLoading) {
      <div class="skeleton-list">
        @for (item of items; track $index) {
          <app-skeleton [type]="type" [isLoading]="true"></app-skeleton>
        }
      </div>
    }
  `,
  styles: `
    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `
})
export class SkeletonListComponent {
  @Input() isLoading = false;
  @Input() count = 5;
  @Input() type: SkeletonType = 'list-item';

  get items() {
    return Array(this.count).fill(0);
  }
}
