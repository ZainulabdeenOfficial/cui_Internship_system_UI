import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  constructor(public store: StoreService) {}
  // Carousel slides (uses your assets/1.jpg, 2.jpg, 3.jpg)
  slides = [
    { img: '/assets/1.jpg', alt: 'CUI campus view 1', align: 'text-start', title: 'CUI Internship System', desc: 'Unified portal for Students, Faculty, Site Supervisors and the Internship Office.', showCtas: true },
    { img: '/assets/2.jpg', alt: 'CUI campus view 2', align: 'text-center', title: 'Streamlined Workflow', desc: 'Approvals, agreements, weekly logs, and final reports in one place.', showCtas: true },
    { img: '/assets/3.jpg', alt: 'CUI campus view 3', align: 'text-end', title: 'Faculty & Site Evaluation', desc: 'Per-report scoring, approvals, and batch marking for supervisors.', showCtas: true }
  ];
  heroHeight = 600;
  ready = false; // triggers staged animations once view initialized

  // Announcements enhancements
  announcementsPerPage = 5;
  currentAnnouncementsPage = 1;
  expandedAnnouncements = new Set<string>();
  messageCharLimit = 150;
  archivedAfterDays = 30;

  get studentsCount() { return this.store.students().length; }
  get supervisorsCount() { return this.store.facultySupervisors().length + this.store.siteSupervisors().length; }
  get companiesCount() { return this.store.companies().length; }
  get departmentsCount() {
    const set = new Set<string>();
    for (const f of this.store.facultySupervisors()) {
      if (f.department) set.add(f.department);
    }
    return set.size;
  }

  get sortedAndFilteredAnnouncements() {
    const now = new Date();
    const allAnns = this.store.announcements() || [];
    
    // Filter out archived announcements (older than 30 days)
    const filtered = allAnns.filter(a => {
      const annDate = new Date(a.createdAt);
      const daysOld = Math.floor((now.getTime() - annDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysOld <= this.archivedAfterDays;
    });

    // Sort: pinned first, then by date descending
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  get paginatedAnnouncements() {
    const start = (this.currentAnnouncementsPage - 1) * this.announcementsPerPage;
    const end = start + this.announcementsPerPage;
    return this.sortedAndFilteredAnnouncements.slice(start, end);
  }

  get totalAnnouncementsPages() {
    return Math.ceil(this.sortedAndFilteredAnnouncements.length / this.announcementsPerPage);
  }

  get hasMoreAnnouncements() {
    return this.currentAnnouncementsPage < this.totalAnnouncementsPages;
  }

  getMessagePreview(message: string): string {
    if (this.expandedAnnouncements.has(message)) return message;
    return message.length > this.messageCharLimit ? message.substring(0, this.messageCharLimit) + '...' : message;
  }

  isMessageTruncated(message: string): boolean {
    return message.length > this.messageCharLimit;
  }

  toggleExpandMessage(message: string): void {
    if (this.expandedAnnouncements.has(message)) {
      this.expandedAnnouncements.delete(message);
    } else {
      this.expandedAnnouncements.add(message);
    }
  }

  isMessageExpanded(message: string): boolean {
    return this.expandedAnnouncements.has(message);
  }

  loadMoreAnnouncements(): void {
    if (this.hasMoreAnnouncements) {
      this.currentAnnouncementsPage++;
    }
  }

  shareAnnouncement(announcement: any): void {
    const text = `${announcement.title ? announcement.title + ': ' : ''}${announcement.message}`;
    const shareUrl = announcement.link || window.location.href;
    
    if (navigator.share) {
      // Use native share API if available
      navigator.share({
        title: 'CUI Internship System Announcement',
        text: text,
        url: shareUrl
      }).catch(err => console.log('Share cancelled:', err));
    } else {
      // Fallback: copy to clipboard
      const fullShare = `${text}\n\n${shareUrl}`;
      navigator.clipboard.writeText(fullShare).then(() => {
        alert('Announcement copied to clipboard!');
      }).catch(() => {
        alert('Unable to share. Please copy manually:\n\n' + fullShare);
      });
    }
  }

  getDaysOld(createdAt: string): number {
    const now = new Date();
    const annDate = new Date(createdAt);
    return Math.floor((now.getTime() - annDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  isArchived(createdAt: string): boolean {
    return this.getDaysOld(createdAt) > this.archivedAfterDays;
  }

  ngOnInit(): void {
    // Remove any auth background classes if present and set a plain body background
    document.body.classList.add('home-solid');
    
    // Load announcements from API
    this.loadAnnouncements();
  }

  private async loadAnnouncements(): Promise<void> {
    try {
      await this.store.loadAnnouncements();
      // Reset pagination when reloading
      this.currentAnnouncementsPage = 1;
    } catch (error) {
      console.error('Failed to load announcements:', error);
    }
  }

  ngAfterViewInit(): void {
    // Defer setting ready to next microtask to ensure DOM painted
    queueMicrotask(() => { this.ready = true });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('home-solid');
  }
}
