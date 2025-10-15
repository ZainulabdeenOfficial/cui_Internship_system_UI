import { Component, computed } from '@angular/core';
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
  constructor(public toastSvc: ToastService) {}
  items = computed(() => this.toastSvc.toasts());
  remove(id: string) { this.toastSvc.remove(id); }
}
