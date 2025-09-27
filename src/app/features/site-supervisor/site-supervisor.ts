import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../shared/services/store.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-site-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-supervisor.html',
  styleUrl: './site-supervisor.css'
})
export class SiteSupervisor {
  private store = inject(StoreService);
  private toast = inject(ToastService);
  students = this.store.students;
  selectedId: string | null = null;
  selectedStudent = computed(() => this.selectedId ? this.students().find(s => s.id === this.selectedId!) : undefined);
  logs() { return this.selectedId ? (this.store.logs()[this.selectedId] ?? []) : []; }
  reports() { return this.selectedId ? (this.store.reports()[this.selectedId] ?? []) : []; }
  mySiteId = computed(() => this.store.currentUser()?.siteId);
  myStudents = computed(() => {
    const sid = this.mySiteId();
    return sid ? this.students().filter(s => s.siteId === sid) : this.students();
  });
  mid = { title: '', content: '' };
  fin = { title: '', content: '' };
  setSiteMarks(v: number) { if (this.selectedId) { this.store.setSiteMarks(this.selectedId, v); this.toast.success('Site marks updated'); } }
  submitMid() { if (this.selectedId && this.mid.title) { this.store.submitReport(this.selectedId, { type: 'mid', title: this.mid.title, content: this.mid.content }); this.mid = { title: '', content: '' }; this.toast.success('Mid report submitted'); } }
  submitFinal() { if (this.selectedId && this.fin.title) { this.store.submitReport(this.selectedId, { type: 'site-final', title: this.fin.title, content: this.fin.content }); this.fin = { title: '', content: '' }; this.toast.success('Final report submitted'); } }
  // Change password for logged-in site supervisor
  pw = { old: '', next: '', confirm: '' };
  changePassword() {
  const id = this.mySiteId();
    if (!id) return;
    if (!this.pw.old || !this.pw.next || !this.pw.confirm) return this.toast.warning('Fill all password fields');
    if (this.pw.next !== this.pw.confirm) return this.toast.warning('Passwords do not match');
    try {
      this.store.changeSitePassword(id, this.pw.old, this.pw.next);
      this.toast.success('Password updated');
      this.pw = { old: '', next: '', confirm: '' };
    } catch (e: any) {
      this.toast.danger(e?.message || 'Unable to change password');
    }
  }
}
