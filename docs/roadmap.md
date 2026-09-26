# Roadmap

Everything planned for Classéo, in one list: `- [x]` is built and in the
code, `- [ ]` is still to do. Items are grouped by theme; within a theme,
built items come first. An item is ticked only when the code holds it; a
partial item stays open and says what is missing.

## Foundations and security

- [x] Data model for every wave (PostgreSQL, Prisma), so later features add
  screens without conflicting migrations.
- [x] Sessions stored in the database, revocable, signed httpOnly cookies;
  argon2id password hashes.
- [x] Sign in with the identifier built from the names (e-mail optional),
  rate limited per address and per account, with a lockout.
- [x] Forced password change after a temporary password; password reset by
  e-mail; password help requests routed up the hierarchy.
- [x] Permissions `resource:action` checked on the server for every page and
  action, with the territorial scope of each account.
- [x] Rights matrix, custom and delegated roles per level.
- [x] Activity log of sensitive actions.
- [x] Security headers with a strict CSP and no third party script; real 403
  and 404 statuses.
- [x] Feature flags stored in the database (`FeatureFlag`).
- [x] Tag based caching of reference data and statistics.
- [x] Demo accounts for every role, on a development machine or at a secret
  sign in page protected by `DEMO_ACCESS_TOKEN`; demo password from
  `DEMO_PASSWORD`, settable without reseeding.
- [x] Docker image, docker compose for local services, CI (typecheck, lint,
  unit tests, build, audit, end to end suite).
- [ ] Background jobs for mass notifications and scheduled statistics
  snapshots.

## Administration and territory

- [x] Real territory: 12 departments and 77 communes.
- [x] Two administrative chains, MEMP (DDEMP and circonscriptions, nursery
  and primary) and MESTFP (DDESTFP, secondary); accounts narrowed to the
  school cycles of their chain.
- [x] School register: sector, faith of confessional schools, bilingual
  programme, opening authorisation, promoter.
- [x] Suspension, closure and reactivation of a school by its ministry chain,
  with a reason.
- [x] Requests from schools to the administration (year extension, new
  subject, staffing, infrastructure) with a status.
- [x] Documents requested by the administration from schools
  ("Pièces demandées").
- [x] National subject catalogue governed by the ministry; school calendar.
- [x] User accounts per level.
- [ ] Circonscriptions scolaires as their own entity (118, several per
  commune) and the 344 pedagogical zones, with the conseiller pédagogique
  role; today a circonscription is held at the level of its commune.
- [ ] Censeur, surveillant général and professeur principal as model roles
  of secondary schools.
- [ ] School equipment fields (water, electricity, internet, latrines,
  rooms) and the list of schools without an essential service.
- [ ] Canteen indicator per school (canteen present, pupils served), summed
  by commune.

## School life

### Classes and students

- [x] Classes, students, enrolments per year, parents and guardians.
- [x] Student history across schools, opened to a receiving school.
- [x] Disability type per student.
- [ ] Series (A1, A2, B, C, D) as a field of second cycle classes.
- [ ] Nursery levels (petite and grande section) without marks; technical
  streams and levels.
- [ ] Accommodations granted to a student (extra time, adapted support).

### Grades and report cards

- [x] Grade entry per class and subject, with the official 2024 formula
  (MESTFP order n° 029, annex 3) by default and school formulas as options.
- [x] "Interrogation écrite" and "Devoir surveillé" labels; composition only
  with a school formula.
- [x] Official coefficients in the demo data (annex 2).
- [x] Annual average by periodicity: (S1 + 2 × S2) / 3 for semesters, the
  mean of three terms otherwise.
- [x] Ranking with shared places.
- [x] Report cards as PDF with a QR code.
- [x] End of year class council decisions (promoted, repeat, excluded),
  proposed by the rules and decided by the school.
- [ ] National table of coefficients by level and series, managed by the
  ministry and applied to classes; catalogue completed (Philosophie, Allemand,
  Espagnol, Économie, Français lecture and communication écrite).
- [ ] Primary evaluation model: formative evaluations, three summative
  evaluations, minimum mastery per discipline (MEMP order n° 0279 of 2016).
- [ ] Class council sessions per period with an entered appreciation.
- [ ] Invalidation after 60 days of abandonment (article 63).
- [ ] Honour roll, congratulations and encouragements configurable by school;
  register of the disciplinary council's sanctions.
- [ ] Students in difficulty flagged by explicit rules (falling average, a
  subject below 8/20 two periods in a row), shown to the teacher.

### Attendance

- [x] Attendance of students per half day, and of teachers.
- [x] Absences justified by the family with a piece, validated by the school.
- [ ] Dropout alert: repeated absences, approach of the 60 days, a student not
  re enrolled at the start of the year; list per school and circonscription.
- [ ] Attendance certificate verifiable by QR code.

### Timetable

- [x] Weekly timetable with class and teacher conflict detection.
- [x] Weekly hours per course.
- [ ] Hourly quotas of annex 1 as defaults, with an alert when a course
  exceeds them.

## Beninese rules

- [x] Evaluation periodicity per school: semesters in public secondary
  schools, terms elsewhere by default.
- [x] Free schooling: no tuition in public nursery and primary schools, girls
  exempted from the contribution in public secondary schools.
- [x] School calendar of the national order (no Toussaint holidays).
- [x] Teacher statuses APE, ACE, AME, vacataire and private, with the payer.
- [x] "Certificat de radiation (exeat)" on departure, with "Aucun frais ne
  peut être exigé".
- [ ] Exemptions modelled beyond the girls of public colleges, and the
  compensation statement the State pays schools for them.
- [ ] Payment of the public contribution scolaire through the Treasury
  (eQuittance, BjPay) once the DGTCP opens an integration.

## Fees and payments

- [x] Fee types, payment plans with installments, invoices, receipts.
- [x] Payments spread over installments in order; payment cancellation with
  redistribution, written to the activity log.
- [x] Payment declarations by parents (Mobile Money, bank transfer) confirmed
  by the accountant.
- [x] Online payment through FedaPay: adapter, signed webhook, invoice
  reconciliation, payment account per school.
- [ ] Invoice cancellation screen and a payment status field, so a cancelled
  payment stays visible instead of living only in the activity log.
- [ ] Budgets per category and year, expenses, and a financial report
  comparing budget, fee income and spending (tables exist, no screens).
- [ ] Adapter for the Treasury's payment platform for public schools.

## Documents and verification

- [x] Issued documents registered with a QR code and a public check page
  (`/verifier`), including the comparison of a downloaded file.
- [x] Electronic signature of documents.
- [x] School certificates and departure certificates as PDF.
- [ ] School certificate requested online by the parent, issued with a QR
  code.

## Communication

- [x] Targeted announcements and resources by audience and territory, with a
  ticker for important announcements.
- [x] Messaging between the school, teachers and families, and between
  institutions through shared mailboxes.
- [x] Group messages, rate limited.
- [x] Voice notes in messages.
- [x] In app notifications and web push.
- [ ] SMS and voice call notifications for parents without a smartphone,
  using the preferred channel already stored on each guardian.
- [ ] USSD menu to check a child's last average and absences on a basic
  phone.
- [ ] Publication notifications to readers of commune, department and
  national targets (needs the background jobs).
- [ ] Pre recorded messages for the most frequent notifications.

## Families

- [x] Audio first family space for parents and students.
- [x] Pieces requested by the school (enrolment), sent by families as photo
  or PDF, pending until the school accepts or rejects them.
- [x] Absence justifications and medical certificates; health pieces deleted
  once the school has decided.
- [x] Transfers of a student with the consent of the guardian.

## Offline and PWA

- [x] Installable application, service worker, offline page.
- [x] Private pages of the signed in account kept for offline reading.
- [x] Offline entry of grades, attendance and messages, replayed with
  conflict detection.
- [ ] Read the `offline.entry` feature flag, so offline entry can be switched
  off.

## Accessibility and voice

- [x] Read aloud in French with the Siwis voice, and the browser's own voice
  as a fallback.
- [x] Accessibility panel (contrast and display preferences), keyboard use,
  screen reader announcements.
- [ ] Sign language videos for national announcements, next to the text
  transcript already required.

## Local languages

- [x] Translation of the interface and contents into six local languages
  (Fongbe, Yoruba, Bariba, Adja, Ewe, Hausa), cached in the database.
- [x] Voices in Fongbe, Yoruba and Hausa.
- [x] Public pages (home, sign in, password help, credits) in French, Fongbe
  and Yoruba, with a separate voice language.
- [x] Scripts to pretranslate, export and load translations.
- [ ] Voices in Dendi and Bariba.

## Statistics

- [x] Indicators at every level (school, commune, department, nation) with
  drill down.
- [x] Year on year comparison.
- [x] Girls and students with a disability in the indicators.
- [ ] Teacher statistics by status.
- [ ] Open data export of aggregated indicators, with no personal data.
- [ ] Half yearly export of education indicators per commune.
- [ ] Examination results (CEP, BEPC, BAC) imported and compared with
  continuous assessment.

## Teachers and pay

- [x] Registry of State teachers found by NPI, phone or names before
  creation, appointed by schools and never created by them.
- [x] Appointment history.
- [x] School payslips with the draft, approved and paid workflow, and
  "Ma paie" for the teacher (link to the State payslip service for State
  agents).
- [ ] Salary grids, several months at once, CNSS statements for private
  schools; payer of public school vacataires to confirm.
- [ ] Vacant posts per circonscription.
- [ ] Training links for teachers with "seen" or "followed" tracking.

## Mock exams

- [x] Mock exams organised by a school, commune, department or the nation,
  with approval, invited and imposed schools, and results.
- [ ] Coefficients of the exam (BEPC grid of 4e and 3e) in the results.

## Transfers

- [x] Class changes and school changes, with guardian consent and acceptance
  by the receiving school.
- [x] Record access granted to the receiving school.
- [ ] Export of transfers to EducMaster.

## Documentation

- [x] README for engineers, architecture, main flows, HTTP API (OpenAPI 3.1)
  and server actions, deployment runbook, payment providers.
- [x] Security notes kept outside the repository.
- [x] This roadmap.

## Code quality

- [x] `npx tsc --noEmit` and `npx eslint src e2e prisma scripts` report
  nothing; no `console.log`, TODO or FIXME in `src`.
- [x] Unused `Combobox` and `PermissionGate` kit composites removed.
- [x] Unit tests (Vitest, 75 files, 1374 tests) and end to end journeys
  (Playwright, 130 tests).
- [ ] One `switchSchool` server action instead of two
  (`src/components/shell/switch-school.ts`,
  `src/features/auth/school-actions.ts`), with one audit shape.
- [ ] One server only helper for the unique violation check (`P2002`),
  written out in eight places today.
- [ ] One variable for the screenshot folder of the end to end suite
  (`E2E_SCREENSHOTS` or `E2E_SHOTS_DIR`).
- [ ] Remove or use the unused barrel `src/components/kit/index.ts`.
- [ ] Review the exports knip reports as unused, one by one.
- [ ] Declare `@react-pdf/types` in `devDependencies`.
- [ ] Split `src/app/globals.css` and `prisma/seed.ts` by area.
- [ ] Remove the four cached translation rows of a footer text the interface
  no longer shows, if the production database still holds them.
- [ ] Promote to the kit the form dialog, confirm button, URL select and
  print components that modules created locally.

## Next features, decided by the owner

- [ ] NPI and EducMaster number on the student record and the report card
  (optional, format checked), with a search by these numbers before a student
  is created, as for teachers. Processing the NPI needs an APDP
  authorisation. (The `npi` column exists on students; nothing enters or
  shows it yet.)
- [ ] Cumulative school record book ("livret scolaire") as a signed PDF
  verifiable by QR code: years, classes, averages, class council decisions,
  distinctions; readable by the family, sent with a transfer, exportable to
  EducMaster.
- [ ] Teachers' training needs declared by the school head or the conseiller
  pédagogique (discipline, theme), summed by circonscription and department.

## Later

- [ ] APDP declaration and authorisation file (NPI, health pieces, hosting
  outside Benin), privacy page and parental consent below 16.
- [ ] Hosting in a certified data centre in Benin, using the existing
  container image.
- [ ] National student identifier shared between schools, so the history and
  report cards follow the student.
- [ ] Identity of a student prefilled from the national identity registry by
  NPI, through the State interoperability platform, under agreement and APDP
  authorisation.
- [ ] Interface with the national social benefits platform for attendance
  based transfers, only at the State's request.
- [ ] Links from each subject and level to the official curriculum
  document.
- [ ] Technical streams with work based training periods (tutor, evaluation)
  and the vocational training grant status.
- [ ] "Classéo Sup": a separate product for higher education (LMD credits,
  deliberations, verifiable transcripts, student life), built on the same
  technical core extracted into a shared package, starting with private
  institutions.
