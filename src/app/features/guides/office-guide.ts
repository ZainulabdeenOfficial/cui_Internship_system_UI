import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-office-guide',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="container py-4">
    <h2 class="mb-3">Internship Office Guide</h2>
    <p class="text-muted">Responsibilities, evaluation framework, and freelancing validation criteria.</p>

    <h4 class="mt-4">1. Core Responsibilities</h4>
    <p>The Internship Office bridges students and industry, ensuring quality assurance, policy alignment, and smooth execution of internships. It coordinates with students, faculty, site supervisors, and host organizations.</p>
    <ul>
      <li>Identify potential host organizations and formalize collaborations (MoUs).</li>
      <li>Arrange internships based on availability and suitability.</li>
      <li>Maintain a complete database of student internship records (status, evaluations, reports).</li>
      <li>Assign supervision: a faculty supervisor (academic) and a site/host supervisor (on-ground).</li>
      <li>Organize internship expos and employer meetups (with Industry Liaison Cell).</li>
      <li>Process and respond to feedback and complaints (students, faculty, site supervisors).</li>
      <li>Support technical project management adoption (Git/GitHub, Jira, Trello).</li>
      <li>Collaborate with Alumni Office for referrals, mentorship, and networking.</li>
    </ul>

    <h4 class="mt-4">2. Internship Evaluation Committee (20% Weight)</h4>
    <p><strong>Composition:</strong> Notified by HoD under convenorship of In-charge Internship Office (plus members as needed).</p>
    <p><strong>Role:</strong> Evaluate internship report, weekly logs, and student technical contribution.</p>
    <p><strong>Grading:</strong> 20% = Report 15% + Weekly Log 5% (forward results to Internship Office).</p>

    <h4 class="mt-4">3. Suitable Host Organizations</h4>
    <p>Encourage placements offering technical relevance, supervision, and meaningful project exposure (software, digital transformation, infrastructure).</p>
    <ul>
      <li>Software houses / IT consulting</li>
      <li>Bank / telecom IT divisions</li>
      <li>Startups / incubators</li>
      <li>Government IT departments</li>
      <li>Academic / research centers</li>
      <li>Digital/tech-focused NGOs</li>
    </ul>

    <h4 class="mt-4">4. Freelancing Models (Fiverr / Upwork)</h4>
    <p>Only technical gigs qualify. Non-technical work (content writing, data entry, design, support, transcription, translation, clerical tasks) is disallowed.</p>
    <p><strong>Allowed Technical Areas:</strong> Software/Web/Mobile Development, Data Science & AI/ML, API Integration & Automation, DevOps & Cloud, Cybersecurity, Database Design, Testing, UI Implementation.</p>

    <h5 class="mt-3">4.1 Fiverr Requirements</h5>
    <ul>
      <li>Authentic profile (real name & verified bank info).</li>
      <li>Student acts as service provider with predefined technical gigs.</li>
      <li>Minimum: 2 gigs completed OR $500 earned.</li>
      <li>Average client rating ≥ 4.0/5.0.</li>
      <li>Formal client feedback for at least one project.</li>
    </ul>
    <p><strong>Validation Evidence:</strong> Hiring/approval message (≥$500 hybrid), contract/chat logs, submitted work artifacts (code, designs, docs) where permitted.</p>

    <h5 class="mt-3">4.2 Upwork Requirements</h5>
    <ul>
      <li>Authentic personalized profile (name & verified data).</li>
      <li>≥10 technical proposals applied.</li>
      <li>≥2 completed projects OR $500 earned.</li>
      <li>Average client rating ≥ 4.0/5.0.</li>
      <li>Formal client feedback for ≥1 project.</li>
    </ul>
    <p><strong>Validation Evidence:</strong> Hiring/approval message (≥$500 hybrid), contract/chat logs, delivered work (code/design/docs).</p>

    <h4 class="mt-4">5. Office Workflow Checklist</h4>
    <ol>
      <li>Review & approve internship proposals (or request clarifications).</li>
      <li>Ensure agreements are signed early (student → faculty → office).</li>
      <li>Monitor weekly log compliance (flag gaps quickly).</li>
      <li>Track report submissions (mid/progress/final).</li>
      <li>Validate freelancing evidence before awarding marks.</li>
      <li>Coordinate evaluation committee grading inputs (20%).</li>
      <li>Address complaints promptly and document resolutions.</li>
      <li>Update announcements for deadlines / policy changes.</li>
    </ol>

    <h4 class="mt-4">6. Risk & Quality Controls</h4>
    <ul>
      <li>Reject unverifiable freelancing claims (require proof).</li>
      <li>Watch for repeated missing logs → early intervention.</li>
      <li>Detect plagiarism in reports (manual sampling / tools).</li>
      <li>Maintain audit trail of approvals & status changes.</li>
    </ul>

    <h4 class="mt-4">7. Communication Standards</h4>
    <ul>
      <li>Use concise, action-focused announcement language.</li>
      <li>Respond to complaints within 3 working days.</li>
      <li>Escalate unresolved academic issues to HoD.</li>
    </ul>

    <div class="alert alert-secondary small mt-4">This guide complements internal SOPs and may be updated as policies evolve.</div>
    <a routerLink="/" class="btn btn-outline-primary mt-2">Back to Home</a>
  </div>
  `
})
export class OfficeGuide {}
