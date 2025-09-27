import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toasts.html',
  styleUrl: './toasts.css'
})
export class ToastsContainer {
  toastSvc = inject(ToastService);
  items = computed(() => this.toastSvc.toasts());
  remove(id: string) { this.toastSvc.remove(id); }
}
