import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
   showMobileMenu = false;
  scrolled = false;
  constructor(public store: StoreService, private router: Router) {}

  // toggle mobile menu
  toggleMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  // logout and redirect to role-specific login screen
  logout() {
    const role = this.store.currentUser()?.role;
    this.store.logout();
    const qp = role && role !== 'student' ? { role } : {} as any;
    this.router.navigate(['/login'], { queryParams: qp });
  }
 
  // Faculty profile helpers
  myFaculty() {
    const id = this.store.currentUser()?.facultyId;
    if (!id) return undefined;
    return this.store.facultySupervisors().find(f => f.id === id);
  }
  updateFacultyProfile(changes: any) {
    const id = this.store.currentUser()?.facultyId;
    if (!id) return;
    this.store.updateFacultySupervisor(id, changes);
  }
  async onAvatarSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    this.updateFacultyProfile({ avatarBase64: base64 });
    // reset input value to allow re-upload of same file
    input.value = '';
  }

  // Student profile helpers
  myStudent() {
    const id = this.store.currentUser()?.studentId;
    if (!id) return undefined;
    return this.store.students().find(s => s.id === id);
  }
  updateStudentProfile(changes: any) {
    const id = this.store.currentUser()?.studentId;
    if (!id) return;
    this.store.updateStudent(id, changes);
  }
  async onStudentAvatarSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    this.updateStudentProfile({ avatarBase64: base64 });
    input.value = '';
  }
  changeStudentPw = { old: '', next: '', confirm: '' };
  submitStudentPassword() {
    try {
      if (this.changeStudentPw.next !== this.changeStudentPw.confirm) throw new Error('Passwords do not match');
      const id = this.store.currentUser()?.studentId;
      if (!id) return;
      this.store.changeStudentPassword(id, this.changeStudentPw.old, this.changeStudentPw.next);
      this.changeStudentPw = { old: '', next: '', confirm: '' };
    } catch {}
  }

  // Site profile helpers
  mySite() {
    const id = this.store.currentUser()?.siteId;
    if (!id) return undefined;
    return this.store.siteSupervisors().find(s => s.id === id);
  }
  updateSiteProfile(changes: any) {
    const id = this.store.currentUser()?.siteId;
    if (!id) return;
    this.store.updateSiteSupervisor(id, changes);
  }
  async onSiteAvatarSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    this.updateSiteProfile({ avatarBase64: base64 });
    input.value = '';
  }
  changeSitePw = { old: '', next: '', confirm: '' };
  submitSitePassword() {
    try {
      if (this.changeSitePw.next !== this.changeSitePw.confirm) throw new Error('Passwords do not match');
      const id = this.store.currentUser()?.siteId;
      if (!id) return;
      this.store.changeSitePassword(id, this.changeSitePw.old, this.changeSitePw.next);
      this.changeSitePw = { old: '', next: '', confirm: '' };
    } catch {}
  }

  // Admin profile helpers
  myAdmin() { return this.store.adminProfile(); }
  updateAdminProfile(changes: any) { this.store.updateAdminProfile(changes); }
  async onAdminAvatarSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    this.updateAdminProfile({ avatarBase64: base64 });
    input.value = '';
  }
  changeAdminPw = { old: '', next: '', confirm: '' };
  submitAdminPassword() {
    try {
      if (this.changeAdminPw.next !== this.changeAdminPw.confirm) throw new Error('Passwords do not match');
      this.store.changeAdminPassword(this.changeAdminPw.old, this.changeAdminPw.next);
      this.changeAdminPw = { old: '', next: '', confirm: '' };
    } catch {}
  }
}

// small util to convert File->base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


