import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';
import { DataCacheService } from '../../core/services/data-cache.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  store = inject(StoreService);
  private cache = inject(DataCacheService);

  // Carousel slides (uses your assets/1.jpg, 2.jpg, 3.jpg)
  readonly slides = [
    { img: '/assets/1.jpg', alt: 'CUI campus view 1', align: 'text-start', title: 'CUI Internship System', desc: 'Unified portal for Students, Faculty, Site Supervisors and the Internship Office.', showCtas: true },
    { img: '/assets/2.jpg', alt: 'CUI campus view 2', align: 'text-center', title: 'Streamlined Workflow', desc: 'Approvals, agreements, weekly logs, and final reports in one place.', showCtas: true },
    { img: '/assets/3.jpg', alt: 'CUI campus view 3', align: 'text-end', title: 'Faculty & Site Evaluation', desc: 'Per-report scoring, approvals, and batch marking for supervisors.', showCtas: true }
  ];
  readonly heroHeight = 600;

  // ✅ Replace plain properties with signals
  ready = signal(false); // triggers staged animations once view initialized

  // Announcements enhancements
  readonly announcementsPerPage = 5;
  currentAnnouncementsPage = signal(1);
  expandedAnnouncements = signal(new Set<string>());
  readonly messageCharLimit = 150;
  readonly archivedAfterDays = 30;

  // ✅ Replace getters with computed()
  studentsCount = computed(() => this.store.students().length);
  supervisorsCount = computed(() => this.store.facultySupervisors().length + this.store.siteSupervisors().length);
  companiesCount = computed(() => this.store.companies().length);
  departmentsCount = computed(() => {
    const set = new Set<string>();
    for (const f of this.store.facultySupervisors()) {
      if (f.department) set.add(f.department);
    }
    return set.size;
  });

  sortedAndFilteredAnnouncements = computed(() => {
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
  });

  paginatedAnnouncements = computed(() => {
    const start = (this.currentAnnouncementsPage() - 1) * this.announcementsPerPage;
    const end = start + this.announcementsPerPage;
    return this.sortedAndFilteredAnnouncements().slice(start, end);
  });

  totalAnnouncementsPages = computed(() => {
    return Math.ceil(this.sortedAndFilteredAnnouncements().length / this.announcementsPerPage);
  });

  hasMoreAnnouncements = computed(() => {
    return this.currentAnnouncementsPage() < this.totalAnnouncementsPages();
  });

  getMessagePreview(message: string): string {
    if (this.expandedAnnouncements().has(message)) return message;
    return message.length > this.messageCharLimit ? message.substring(0, this.messageCharLimit) + '...' : message;
  }

  isMessageTruncated(message: string): boolean {
    return message.length > this.messageCharLimit;
  }

  toggleExpandMessage(message: string): void {
    // ✅ Use signal.update() instead of direct mutation
    this.expandedAnnouncements.update(set => {
      set.has(message) ? set.delete(message) : set.add(message);
      return set;
    });
  }

  isMessageExpanded(message: string): boolean {
    return this.expandedAnnouncements().has(message);
  }

  loadMoreAnnouncements(): void {
    if (this.hasMoreAnnouncements()) {
      this.currentAnnouncementsPage.update(page => page + 1);
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

  constructor() {}

  ngOnInit(): void {
    // Always fetch fresh from the public API on load.
    // The public endpoint is no-auth and fast; stale localStorage data should not block.
    this.loadAnnouncements();

    queueMicrotask(() => {
      this.ready.set(true);
      document.body.classList.add('home-solid');
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('home-solid');
  }

  private async loadAnnouncements(): Promise<void> {
    try {
      // Always fetch from the public API — clears stale localStorage data first
      // so old/archived items don't show while the fetch is in-flight.
      await this.store.loadAnnouncements();
      this.cache.mark('announcements');
      this.currentAnnouncementsPage.set(1);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    }
  }
}
