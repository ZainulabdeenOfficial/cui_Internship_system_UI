import { Injectable, signal } from '@angular/core';

export type ToastItem = { id: string; header?: string; classname?: string; delay?: number; autohide?: boolean; body: string };

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<ToastItem[]>([]);

  show(body: string, opts: Partial<ToastItem> = {}) {
    const t: ToastItem = { id: crypto.randomUUID(), body, autohide: true, delay: 5000, classname: 'bg-primary text-white', ...opts };
    this.toasts.update(a => [t, ...a]);
    if (t.autohide) setTimeout(() => this.remove(t.id), t.delay);
  }
  success(msg: string) { this.show(msg, { classname: 'bg-success text-white' }); }
  info(msg: string) { this.show(msg, { classname: 'bg-info text-dark' }); }
  warning(msg: string) { this.show(msg, { classname: 'bg-warning text-dark' }); }
  danger(msg: string) { this.show(msg, { classname: 'bg-danger text-white' }); }

  remove(id: string) { this.toasts.update(a => a.filter(t => t.id !== id)); }
  clear() { this.toasts.set([]); }
}
