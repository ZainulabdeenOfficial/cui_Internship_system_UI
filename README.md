
![CUI Internship Banner](public/Banner.png)

# CUI Internship Management System
## Project Overview

The **CUI Internship Management System** is designed to digitize and streamline the internship process defined by the **Internship Handbook**. It provides a web-based platform for students, supervisors, and the Internship Office to manage internships, reports, evaluations, and results efficiently.

This system ensures alignment with university academic policies, supports freelancing-based internships (Fiverr/Upwork), and automates reporting, approval, and grading.

---

## Key Features

- **Student Portal**
  - Internship registration (on-site, virtual, freelancing)
  - Internship proposal/design submission
  - Weekly activity log submissions
  - Upload of internship reports, certificates, and reflective summaries

- **Faculty Supervisor Dashboard**
  - Monitor assigned students
  - Review reports & logs
  - Submit evaluations (Faculty Supervisor Evaluation Form)

- **Internship Office Module**
  - Approve placements & track timelines
  - Maintain database of organizations and MoUs
  - Evaluate reports/logs and finalize results

- **Site Supervisor Integration**
  - Submit student performance evaluations online
  - Provide mid-term and final feedback

- **Freelancing Internship Support**
  - Validate Fiverr/Upwork accounts & contracts
  - Upload client reviews, chat logs, contracts, and earnings evidence

---

## Workflow Diagram

```mermaid
flowchart TD
    A[Student Registers Internship] --> B[Internship Office Approval]
    B --> C[Internship Starts]
    C --> D[Weekly Logs Submitted]
    C --> E[Supervisor Monitoring]
    C --> F[Site Supervisor Evaluation]
    D --> G[Final Internship Report]
    E --> H[Faculty Evaluation]
    F --> H
    G --> H
    H --> I[Internship Office Review]
    I --> J[Final Result: Pass/Fail]
````

---

## Data Model (ER Diagram)

```mermaid
erDiagram
  STUDENT {
    Int id PK
    String name
    String email
    String roll_no
  }
  INTERNSHIP {
    Int id PK
    String type
    String organization
    String start_date
    String end_date
  }
  WEEKLY_LOG {
    Int id PK
    Int studentId FK
    String description
    DateTime submittedAt
  }
  REPORT {
    Int id PK
    Int studentId FK
    String file_path
    String type
  }
  SUPERVISOR {
    Int id PK
    String name
    String role
  }
  EVALUATION {
    Int id PK
    Int studentId FK
    Int supervisorId FK
    Int score
    String comments
  }

  STUDENT ||--o{ INTERNSHIP : "enrolls"
  STUDENT ||--o{ WEEKLY_LOG : "submits"
  STUDENT ||--o{ REPORT : "writes"
  SUPERVISOR ||--o{ EVALUATION : "performs"
  STUDENT ||--o{ EVALUATION : "receives"
```

---

## Internship Program Rules (From Handbook)

* **Eligibility:** Minimum 4 semesters completed, CGPA ≥ 2.0
* **Duration:** 6–8 continuous weeks (3 credit hours)
* **Types:** On-site, Virtual, Freelancing (Fiverr/Upwork)
* **Reports Required:**

  * Internship Proposal/Design Statement
  * Weekly Logs
  * Internship Report (~3,500 words)
  * Reflective Summary (1 page)
  * Supervisor Evaluations

---

## Evaluation & Assessment

* **On-Site / Virtual Internship**

  * Site Supervisor: 40%
  * Faculty Supervisor: 40%
  * Internship Office (Design, Logs, Report): 20%

* **Freelancing Internship (Fiverr/Upwork)**

  * Faculty Supervisor: 60%
  * Internship Office: 40%

**Passing Criteria:** Minimum 60/100

---

## Environment Setup

1. Clone repository:

   ```bash
   git clone https://github.com/talha24603/cui-internship_management_system.git
   cd cui-internship_management_system
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure `.env`:

   ```ini
   DATABASE_URL="postgresql://user:password@localhost:5432/internship_db"
   JWT_SECRET="your_secret"
   ```

4. Run migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Start dev server:

   ```bash
   npm run dev
   ```

---

## Deployment

* Recommended: **Vercel** for frontend + backend API routes.
* Add environment variables in Vercel project settings.
* Auto-deploy on `main` branch push.

---

## Contribution Guidelines

* Fork → Create branch → Commit → Push → Pull Request.
* Follow project coding standards and naming conventions.
* Ensure reports, logs, and supervisor forms align with Handbook requirements.

---

## License

MIT License (update if restricted).

---

## Acknowledgements

* Department of Computer Science, CUI Islamabad
* Internship Office & Supervisors
* Students contributing to digital automation of internship workflows





