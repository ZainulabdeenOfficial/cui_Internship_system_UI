import { Component } from '@angular/core';
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
export class Home {
  constructor(public store: StoreService) {}
  // Carousel slides (uses your assets/1.jpg, 2.jpg, 3.jpg)
  slides = [
    { img: '/assets/1.jpg', alt: 'CUI campus view 1', align: 'text-start', title: 'CUI Internship System', desc: 'Unified portal for Students, Faculty, Site Supervisors and the Internship Office.', showCtas: true },
    { img: '/assets/2.jpg', alt: 'CUI campus view 2', align: 'text-center', title: 'Streamlined Workflow', desc: 'Approvals, agreements, weekly logs, and final reports in one place.' },
    { img: '/assets/3.jpg', alt: 'CUI campus view 3', align: 'text-end', title: 'Faculty & Site Evaluation', desc: 'Per-report scoring, approvals, and batch marking for supervisors.' }
  ];
  heroHeight = 600;
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
}
