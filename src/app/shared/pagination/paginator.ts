import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule],
  template: `
  <nav *ngIf="total > pageSize" aria-label="Pagination" class="d-flex align-items-center justify-content-between mt-2">
    <div class="small text-muted">Showing {{ startIndex + 1 }}–{{ endIndex }} of {{ total }}</div>
    <ul class="pagination mb-0">
      <li class="page-item" [class.disabled]="page <= 1">
        <button class="page-link" (click)="goTo(page-1)" [disabled]="page <= 1">&laquo;</button>
      </li>
      <li class="page-item" *ngFor="let p of pages" [class.active]="p === page">
        <button class="page-link" (click)="goTo(p)">{{ p }}</button>
      </li>
      <li class="page-item" [class.disabled]="page >= totalPages">
        <button class="page-link" (click)="goTo(page+1)" [disabled]="page >= totalPages">&raquo;</button>
      </li>
    </ul>
  </nav>
  `
})
export class PaginatorComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() maxPages = 5;
  @Output() pageChange = new EventEmitter<number>();

  get totalPages() { return Math.max(1, Math.ceil(this.total / Math.max(1, this.pageSize))); }
  get startIndex() { return Math.min(this.total, (Math.max(1, this.page) - 1) * Math.max(1, this.pageSize)); }
  get endIndex() { return Math.min(this.total, this.startIndex + Math.max(1, this.pageSize)); }
  get pages(): number[] {
    const total = this.totalPages;
    const half = Math.floor(this.maxPages / 2);
    let start = Math.max(1, this.page - half);
    let end = Math.min(total, start + this.maxPages - 1);
    start = Math.max(1, end - this.maxPages + 1);
    const arr: number[] = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }
  goTo(p: number) {
    const np = Math.max(1, Math.min(this.totalPages, p));
    if (np !== this.page) this.pageChange.emit(np);
  }
}
