import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreService } from '../../shared/services/store.service';

/**
 * MODERN ANGULAR 20 HOME COMPONENT
 * 
 * This is a fully modernized version using:
 * - inject() instead of constructor injection
 * - Signals for reactive state
 * - computed() for derived values (replaces getters)
 * - effect() instead of lifecycle hooks
 * - No ChangeDetectorRef needed
 * 
 * Key improvements:
 * ✅ Cleaner code (no constructor boilerplate)
 * ✅ Reactive by default (signals auto-update UI)
 * ✅ Better performance (computed() memoizes values)
 * ✅ Safer (no manual change detection bugs)
 */

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeModernized {
  // ============================================
  // DEPENDENCY INJECTION (Modern Pattern)
  // ============================================
  // Use inject() instead of constructor - much cleaner!
  store = inject(StoreService);

  // ============================================
  // STATE (Signals)
  // ============================================
  // Track expanded announcements with signal
  expandedAnnouncements = signal(new Set<string>());
  
  // Current page for pagination
  currentAnnouncementsPage = signal(1);
  
  // Ready flag for animations
  ready = signal(false);

  // ============================================
  // CONSTANTS
  // ============================================
  readonly announcementsPerPage = 5;
  readonly messageCharLimit = 150;
  readonly archivedAfterDays = 30;

  // Carousel slides
  readonly slides = [
    {
      img: '/assets/1.jpg',
      alt: 'CUI campus view 1',
      align: 'text-start',
      title: 'CUI Internship System',
      desc: 'Unified portal for Students, Faculty, Site Supervisors and the Internship Office.',
      showCtas: true
    },
    {
      img: '/assets/2.jpg',
      alt: 'CUI campus view 2',
      align: 'text-center',
      title: 'Streamlined Workflow',
      desc: 'Approvals, agreements, weekly logs, and final reports in one place.',
      showCtas: true
    },
    {
      img: '/assets/3.jpg',
      alt: 'CUI campus view 3',
      align: 'text-end',
      title: 'Faculty & Site Evaluation',
      desc: 'Per-report scoring, approvals, and batch marking for supervisors.',
      showCtas: true
    }
  ];

  readonly heroHeight = 600;

  // ============================================
  // COMPUTED VALUES (replaces getters)
  // ============================================
  // These automatically recalculate when dependencies change
  // and cache results for performance!

  // Count of students
  studentsCount = computed(() => this.store.students().length);

  // Count of supervisors (faculty + site)
  supervisorsCount = computed(() => 
    this.store.facultySupervisors().length + this.store.siteSupervisors().length
  );

  // Count of companies
  companiesCount = computed(() => this.store.companies().length);

  // Count of unique departments
  departmentsCount = computed(() => {
    const departments = new Set<string>();
    for (const faculty of this.store.facultySupervisors()) {
      if (faculty.department) {
        departments.add(faculty.department);
      }
    }
    return departments.size;
  });

  // Sorted and filtered announcements (pinned first, then by date)
  sortedAndFilteredAnnouncements = computed(() => {
    const now = new Date();
    const allAnnouncements = this.store.announcements() ?? [];

    // Filter: remove archived announcements (older than 30 days)
    const filtered = allAnnouncements.filter(announcement => {
      const announcementDate = new Date(announcement.createdAt);
      const daysOld = Math.floor(
        (now.getTime() - announcementDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysOld <= this.archivedAfterDays;
    });

    // Sort: pinned first, then by date descending
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  // ============================================
  // LIFECYCLE (use effect() instead of hooks)
  // ============================================
  constructor() {
    // Runs once after component initializes
    // Automatically cleans up when component destroys
    effect(() => {
      // Simulate AfterViewInit behavior
      // This could be: set ready flag, init animations, etc.
      const count = this.studentsCount();
      console.log('Home component ready with', count, 'students');
      
      // Set ready after a tick (simulate AfterViewInit)
      setTimeout(() => {
        this.ready.set(true);
      }, 0);
    });

    // Add more effects as needed - they auto-cleanup!
    // effect(() => {
    //   console.log('Page changed to:', this.currentAnnouncementsPage());
    // });
  }

  // ============================================
  // METHODS (for template interaction)
  // ============================================

  /**
   * Toggle announcement expansion
   */
  toggleExpandAnnouncement(announcementId: string): void {
    this.expandedAnnouncements.update(set => {
      const newSet = new Set(set);
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId);
      } else {
        newSet.add(announcementId);
      }
      return newSet;
    });
  }

  /**
   * Check if announcement is expanded
   */
  isAnnouncementExpanded(announcementId: string): boolean {
    return this.expandedAnnouncements().has(announcementId);
  }

  /**
   * Change current page for announcements
   */
  setCurrentPage(page: number): void {
    this.currentAnnouncementsPage.set(page);
  }

  /**
   * Get paginated announcements
   */
  getPaginatedAnnouncements() {
    const announcements = this.sortedAndFilteredAnnouncements();
    const page = this.currentAnnouncementsPage();
    const start = (page - 1) * this.announcementsPerPage;
    const end = start + this.announcementsPerPage;
    return announcements.slice(start, end);
  }

  /**
   * Get total pages for announcements
   */
  getTotalAnnouncementPages = computed(() => {
    const total = this.sortedAndFilteredAnnouncements().length;
    return Math.ceil(total / this.announcementsPerPage);
  });
}

// ============================================
// USAGE IN TEMPLATE
// ============================================
/*
Example template usage (no changes needed!)

<!-- Display stats -->
<div class="stats">
  <div>Students: {{ studentsCount() }}</div>
  <div>Supervisors: {{ supervisorsCount() }}</div>
  <div>Companies: {{ companiesCount() }}</div>
</div>

<!-- Show content when ready -->
@if (ready()) {
  <div class="announcements">
    @for (ann of getPaginatedAnnouncements(); track ann.id) {
      <div class="announcement">
        <h4>{{ ann.title }}</h4>
        
        @if (isAnnouncementExpanded(ann.id)) {
          <p>{{ ann.message }}</p>
        } @else {
          <p>{{ ann.message | slice:0:messageCharLimit }}...</p>
        }
        
        <button (click)="toggleExpandAnnouncement(ann.id)">
          {{ isAnnouncementExpanded(ann.id) ? 'Show Less' : 'Show More' }}
        </button>
      </div>
    }
  </div>
}
*/
