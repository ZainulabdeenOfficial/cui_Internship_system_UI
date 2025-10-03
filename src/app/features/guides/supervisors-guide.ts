import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-supervisors-guide',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="container py-4">
    <h2 class="mb-3">Supervisory Framework & Guidelines</h2>
    <p class="text-muted">Framework for Faculty Supervisors and Site (Host) Supervisors overseeing internships.</p>

    <h4 class="mt-4">1. Dual-Supervision Model</h4>
    <p>Each intern is supported by two supervisors to ensure balanced academic rigor and professional development:</p>
    <ul>
      <li><strong>Faculty Supervisor:</strong> Academic guidance, report oversight, institutional liaison.</li>
      <li><strong>Site Supervisor:</strong> Daily task allocation, performance feedback, workplace integration.</li>
    </ul>

    <h4 class="mt-4">2. Faculty Supervisor Responsibilities</h4>
    <ul>
      <li>Assigned by the Internship Office with balanced workload distribution.</li>
      <li>Guide the student academically and monitor overall progress.</li>
      <li>Review internship documents (approval form, logs, mid/final reports).</li>
      <li>Provide timely feedback and escalate issues where necessary.</li>
      <li>Act as liaison between host organization and university.</li>
    </ul>

    <h4 class="mt-4">3. Site Supervisor Responsibilities</h4>
    <ul>
      <li>Introduce intern to organizational culture and project requirements.</li>
      <li>Assign meaningful, progressively challenging tasks.</li>
      <li>Mentor on tools, standards, security, and workflow practices.</li>
      <li>Monitor attendance, engagement, and professionalism.</li>
      <li>Submit two formal performance evaluations: mid-point and final.</li>
    </ul>

    <h4 class="mt-4">4. Evaluation Touchpoints</h4>
    <ol>
      <li><strong>Proposal / Approval Form:</strong> Validates placement relevance.</li>
      <li><strong>Mid Evaluation (Site + Faculty):</strong> Progress, learning pace, adaptation.</li>
      <li><strong>Weekly Logs Review:</strong> Consistency and task authenticity.</li>
      <li><strong>Final Evaluation:</strong> Deliverables quality, professionalism, impact.</li>
      <li><strong>Office Committee Weight (20%):</strong> Report + log compliance + technical contribution.</li>
    </ol>

    <h4 class="mt-4">5. Good Practice Guidelines</h4>
    <ul>
      <li>Encourage version control usage (Git) and issue tracking (Jira/Trello).</li>
      <li>Provide actionable feedback instead of vague remarks.</li>
      <li>Align tasks with student learning objectives.</li>
      <li>Avoid assigning only routine/non-growth clerical work.</li>
      <li>Promote ethical conduct and confidentiality adherence.</li>
    </ul>

    <h4 class="mt-4">6. Issue Escalation Flow</h4>
    <ol>
      <li>Student informs Site Supervisor (if workplace related).</li>
      <li>Faculty Supervisor reviews academic or scope issues.</li>
      <li>Internship Office mediates unresolved conflicts.</li>
      <li>HoD involvement for policy or serious conduct matters.</li>
    </ol>

    <h4 class="mt-4">7. Minimum Engagement Expectations</h4>
    <ul>
      <li>Faculty: Provide at least 2 structured feedback points (mid & final) plus ad-hoc as needed.</li>
      <li>Site: Weekly oversight + timely mid/final performance submission.</li>
      <li>Both: Encourage reflective learning (what was done, why it mattered, what improved).</li>
    </ul>

    <h4 class="mt-4">8. Evaluation Integrity</h4>
    <ul>
      <li>Validate originality of deliverables.</li>
      <li>Reject unverifiable freelancing claims.</li>
      <li>Query gaps in weekly logs early.</li>
      <li>Document escalations and resolutions.</li>
    </ul>

    <div class="alert alert-info small mt-4">These guidelines complement institutional SOPs and may be updated periodically.</div>
    <a routerLink="/" class="btn btn-outline-primary mt-2">Back to Home</a>
  </div>
  `
})
export class SupervisorsGuide {}
