import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonType = 'card' | 'text' | 'image' | 'table-row' | 'list-item' | 'button' | 'badge';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="'skeleton skeleton-' + type" *ngIf="isLoading">
      @switch(type) {
        @case ('card') {
          <div class="skeleton-card">
            <div class="skeleton-image"></div>
            <div class="skeleton-text skeleton-title"></div>
            <div class="skeleton-text skeleton-subtitle"></div>
            <div class="skeleton-text skeleton-description"></div>
          </div>
        }
        @case ('text') {
          <div class="skeleton-text"></div>
        }
        @case ('image') {
          <div class="skeleton-image"></div>
        }
        @case ('table-row') {
          <div class="skeleton-table-row">
            <div class="skeleton-table-cell"></div>
            <div class="skeleton-table-cell"></div>
            <div class="skeleton-table-cell"></div>
            <div class="skeleton-table-cell"></div>
          </div>
        }
        @case ('list-item') {
          <div class="skeleton-list-item">
            <div class="skeleton-list-avatar"></div>
            <div class="skeleton-list-content">
              <div class="skeleton-text skeleton-title"></div>
              <div class="skeleton-text skeleton-subtitle"></div>
            </div>
          </div>
        }
        @case ('button') {
          <div class="skeleton-button"></div>
        }
        @case ('badge') {
          <div class="skeleton-badge"></div>
        }
      }
    </div>

    @if (!isLoading) {
      <ng-content></ng-content>
    }
  `,
  styleUrl: './skeleton.component.scss'
})
export class SkeletonComponent {
  @Input() type: SkeletonType = 'text';
  @Input() isLoading = false;
  @Input() count = 1;
}
