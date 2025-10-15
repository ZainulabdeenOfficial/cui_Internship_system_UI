import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-student-guide',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="container py-4">
    <h2 class="mb-3">Student Internship Guide</h2>
    <p class="text-muted">A concise walkthrough of what you must do to successfully complete your internship.</p>

    <h5>1. Before You Start</h5>
    <ul>
      <li>Ensure you meet eligibility: Completed 4 semesters, CGPA ≥ 2.0.</li>
      <li>Decide internship mode: On-site, Virtual, Fiverr, or Upwork (technical only).</li>
      <li>Prepare a professional email signature and update your CV.</li>
    </ul>

    <h5>2. Registration & Approval</h5>
    <ul>
      <li>Submit Approval Form (company/site or freelancing evidence).</li>
      <li>Wait for Internship Office + supervisory approvals.</li>
      <li>Track status in the portal under Applications.</li>
    </ul>

    <h5>3. Agreement & Setup</h5>
    <ul>
      <li>Complete the Internship Agreement after approval.</li>
      <li>For freelancing: prepare platform profile screenshots & contract/chat summaries.</li>
      <li>Clarify working hours, deliverables, and supervision expectations.</li>
    </ul>

    <h5>4. Weekly Logs</h5>
    <ul>
      <li>Submit a log every week (brief but specific: tasks, tools, outcomes).</li>
      <li>Missing current-week logs harms compliance status.</li>
    </ul>

    <h5>5. Reports & Documents</h5>
    <ul>
      <li>Design Statement (Week 1) – objectives, placement context, technologies.</li>
      <li>Mid Report – progress, challenges, learning.</li>
      <li>Final Report – full technical narrative, outcomes, reflection.</li>
      <li>Freelancing: attach evidence of gigs / contracts / earnings / ratings.</li>
    </ul>

    <h5>6. Evaluation Scheme (Summary)</h5>
    <ul>
      <li>On-site / Virtual: Site (40) + Faculty (40) + Office (20: Proposal 5, Logs 5, Final 10)</li>
      <li>Freelancing: Supervisor (60) + Office (40) with same sub-breakdown.</li>
    </ul>

    <h5>7. Professional Conduct</h5>
    <ul>
      <li>Maintain confidentiality; do not share proprietary code.</li>
      <li>Communicate blockers early to supervisors.</li>
      <li>Use version control (Git) and task tracking where possible.</li>
    </ul>

    <h5>8. Completion Checklist</h5>
    <ul>
      <li>All weekly logs submitted.</li>
      <li>Mid & Final reports uploaded.</li>
      <li>Agreement fully signed (student, faculty, office).</li>
      <li>All marks visible in portal.</li>
    </ul>

    <div class="alert alert-info mt-4 small">Need help? Use the Complaints/Grievances tab or contact the Internship Office.</div>
    <a routerLink="/" class="btn btn-outline-primary mt-2">Back to Home</a>
  </div>
  `
})
export class StudentGuide {}
