import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  template?: TemplateRef<any>;
}

export interface TableAction<T = any> {
  label: string;
  icon?: string;
  class?: string;
  handler: (item: T) => void;
  disabled?: (item: T) => boolean;
  visible?: (item: T) => boolean;
}

/**
 * Reusable Data Table Component
 * Features: sorting, actions, custom templates, responsive
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-responsive">
      <table class="table table-striped table-hover table-sm align-middle">
        @if (showHeader) {
          <thead class="table-light">
            <tr>
              @for (column of columns; track column.key) {
                <th [style.width]="column.width">
                  @if (column.sortable) {
                    <button 
                      type="button" 
                      class="btn btn-link btn-sm p-0 text-decoration-none text-dark"
                      (click)="onSort(column.key)">
                      {{ column.label }}
                      @if (sortKey === column.key) {
                        <i class="bi" [class.bi-sort-up]="sortDirection === 'asc'" [class.bi-sort-down]="sortDirection === 'desc'"></i>
                      }
                    </button>
                  } @else {
                    {{ column.label }}
                  }
                </th>
              }
              @if (actions.length > 0) {
                <th style="width: 150px;">Actions</th>
              }
            </tr>
          </thead>
        }
        <tbody>
          @if (loading) {
            <tr>
              <td [attr.colspan]="columns.length + (actions.length > 0 ? 1 : 0)" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <span class="ms-2">Loading...</span>
              </td>
            </tr>
          } @else if (data.length === 0) {
            <tr>
              <td [attr.colspan]="columns.length + (actions.length > 0 ? 1 : 0)" class="text-center py-4 text-muted">
                {{ emptyMessage }}
              </td>
            </tr>
          } @else {
            @for (item of data; track trackByFn($index, item)) {
              <tr>
                @for (column of columns; track column.key) {
                  <td>
                    @if (column.template) {
                      <ng-container *ngTemplateOutlet="column.template; context: { $implicit: item, column: column }"></ng-container>
                    } @else {
                      {{ getColumnValue(item, column.key) }}
                    }
                  </td>
                }
                @if (actions.length > 0) {
                  <td>
                    <div class="btn-group btn-group-sm">
                      @for (action of getVisibleActions(item); track action.label) {
                        <button 
                          type="button"
                          class="btn {{ action.class || 'btn-outline-primary' }}"
                          (click)="action.handler(item)"
                          [disabled]="action.disabled ? action.disabled(item) : false">
                          @if (action.icon) {
                            <i class="bi {{ action.icon }}"></i>
                          }
                          {{ action.label }}
                        </button>
                      }
                    </div>
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .btn-group-sm .btn {
      font-size: 0.875rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T = any> {
  @Input() data: T[] = [];
  @Input() columns: TableColumn<T>[] = [];
  @Input() actions: TableAction<T>[] = [];
  @Input() loading = false;
  @Input() showHeader = true;
  @Input() emptyMessage = 'No data available';
  @Input() trackByFn: (index: number, item: T) => any = (index) => index;
  
  @Output() sort = new EventEmitter<{ key: string; direction: 'asc' | 'desc' }>();
  
  sortKey: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  onSort(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    
    this.sort.emit({ key, direction: this.sortDirection });
  }

  getColumnValue(item: T, key: string): any {
    const keys = key.split('.');
    let value: any = item;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) break;
    }
    
    return value ?? '-';
  }

  getVisibleActions(item: T): TableAction<T>[] {
    return this.actions.filter(action => 
      !action.visible || action.visible(item)
    );
  }
}
