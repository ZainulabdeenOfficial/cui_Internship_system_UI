import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Reusable Search Input Component with Debouncing
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-input-wrapper">
      <div class="input-group">
        @if (icon) {
          <span class="input-group-text">
            <i class="bi bi-{{ icon }}"></i>
          </span>
        }
        <input 
          type="text"
          class="form-control {{ size ? 'form-control-' + size : '' }}"
          [placeholder]="placeholder"
          [(ngModel)]="searchValue"
          (ngModelChange)="onSearchChange($event)"
          [attr.aria-label]="placeholder" />
        @if (searchValue && clearable) {
          <button 
            class="btn btn-outline-secondary" 
            type="button"
            (click)="clearSearch()"
            aria-label="Clear search">
            <i class="bi bi-x"></i>
          </button>
        }
      </div>
      @if (showCount && totalResults !== null) {
        <small class="text-muted mt-1 d-block">
          {{ totalResults }} result{{ totalResults !== 1 ? 's' : '' }} found
        </small>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .search-input-wrapper {
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchInputComponent implements OnInit {
  @Input() placeholder = 'Search...';
  @Input() debounceTime = 300;
  @Input() icon = 'search';
  @Input() size: 'sm' | 'lg' | null = null;
  @Input() clearable = true;
  @Input() showCount = false;
  @Input() totalResults: number | null = null;
  @Input() initialValue = '';
  
  @Output() search = new EventEmitter<string>();
  
  searchValue = '';
  private debounceTimeout: any;

  ngOnInit(): void {
    this.searchValue = this.initialValue;
  }

  onSearchChange(value: string): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    this.debounceTimeout = setTimeout(() => {
      this.search.emit(value);
    }, this.debounceTime);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.search.emit('');
  }
}
