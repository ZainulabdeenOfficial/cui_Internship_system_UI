import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'paginate',
  standalone: true
})
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined, page: number = 1, pageSize: number = 10): T[] {
    if (!Array.isArray(items) || !items.length) return [];
    const p = Math.max(1, Math.floor(page || 1));
    const ps = Math.max(1, Math.floor(pageSize || 10));
    const start = (p - 1) * ps;
    return items.slice(start, start + ps);
  }
}
