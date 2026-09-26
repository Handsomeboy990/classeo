# Roadmap

Classéo is delivered in waves. The data model already holds the tables of the
next waves, so they add features without conflicting migrations.

## Delivered

| Wave | Content |
|---|---|
| W0 Foundations | data model, sessions, permissions with territorial scope, component kit, brand, demo data for the 12 departments and 77 communes, Docker, CI |
| W1 Core | classes, students, teachers, parents; grade entry, report cards, attendance; statistics at every territorial level; schools, requests, user accounts, rights matrix, activity log; targeted content, messaging, notifications; audio first family space, installable offline app, public landing |
| W2 | school fees, payment plans, invoices, payments with cascade over installments, receipts; weekly timetable with conflict detection |
| Later | offline entry of grades, attendance and messages with conflict detection; the Siwis French voice; translation into six local languages and voices in Fongbe, Yoruba and Hausa; online payment through FedaPay and payment declarations; verifiable documents with QR codes and electronic signature; transfers between schools with parent consent; mock exams; pieces sent by families; school payslips |
| Quality | 73 unit test files, 1358 tests (Vitest); end to end journeys: see CI; security audit with seven fixes, real 403 statuses |

## Next

### W3: school finance (schema ready)

- Payroll from salary grids, with the draft, approved and paid workflow.
- Budgets per category and year, with approval that prevents deletion.
- Expenses and a financial report comparing budget, income from fees and spending.

### W4: reach every family

- Online payment through an aggregator is built (FedaPay adapter, signed webhook, reconciliation of invoices), waiting for the merchant keys; parents can already declare a Mobile Money or bank transfer that the accountant confirms. Next: one FedaPay sub-account per school so the money lands on the school's own account, and an adapter for the Treasury's payment platform for public schools once the DGTCP opens an integration (see payment-providers.md; the TrésorPay name is not confirmed for Benin). A direct connection to the operators' APIs (MTN MoMo, Moov Money) is out of scope: the aggregator carries it.
- SMS and voice call notifications for parents without a smartphone, using the preferred channel already stored on each guardian.
- USSD menu to check a child's last average and absences on a basic phone.
- Voices in Dendi and Bariba for the read aloud feature (Fongbe, Yoruba and Hausa are delivered), and pre recorded messages for the most frequent notifications.
- Sign language videos for national announcements, next to the text transcript already required.

### W5: national scale and interoperability

- National student identifier shared between schools, so a transfer keeps the history and the report cards follow the student.
- Background jobs for mass notifications (national and departmental announcements) and for scheduled statistics snapshots.
- Examination results (CEP, BEPC, BAC) imported from the examination office and compared with continuous assessment.
- Open data export of aggregated indicators for partners, with no personal data.

## Known follow ups

- Invoice cancellation screen and a payment status field, so a cancelled payment stays visible instead of living only in the audit log.
- Publication notifications to readers of commune, department and national targets (needs the background jobs of W5).
- Weekly hours limit per course in the timetable.
- Promote to the kit the form dialog, confirm button, URL select and print components that modules created locally.

## Beninese context, next steps

Follow ups of the comparison with the Beninese system (internal study of 26 September 2026); what is delivered is the national formula, periodicity per school, the two administrative chains, free schooling, school types, teacher statuses and registry, Ma paie with school payroll and class council decisions.

- Circonscriptions scolaires as their own entity (118, several per commune) and the 344 pedagogical zones, with the conseiller pédagogique role; today a circonscription is held at the level of its commune.
- National and departmental contents and statistics narrowed by chain for the ministries (MEMP or MESTFP accounts); today a national account covers both.
- National table of coefficients by level and series, managed by the ministry and applied to classes; series (A1, A2, B, C, D) as a class field and the catalogue completed (Philosophie, Allemand, Espagnol, Économie, Français lecture and communication écrite).
- Primary evaluation model: formative evaluations, three summative evaluations, minimum mastery per discipline and a scale to confirm with a circonscription (MEMP order n° 0279 of 2016).
- Coefficients of mock exams (BEPC grid of 4e and 3e) in the results.
- Exemptions modelled beyond the girls of public colleges, and the compensation statement the State pays schools for them.
- EducMaster number and NPI on the student record and the report card (NPI processing needs an APDP authorisation), export of transfers to EducMaster, livret scolaire.
- Class council sessions per period with an entered appreciation, beyond the end of year decision; invalidation after 60 days of abandonment (article 63).
- Teacher statistics by status, history of appointments and vacant posts per circonscription; hourly quotas of annex 1 as defaults with an alert in the timetable.
- Payroll: salary grids, CNSS statements for private schools, several months at once; the payer of public school vacataires to confirm.
- Censeur, surveillant général and professeur principal as model roles of secondary schools.
- Nursery levels (petite and grande section) without marks, technical streams.
- Honour roll, congratulations and encouragements configurable by school; register of the disciplinary council's sanctions.
- APDP declaration and authorisation file (NPI, health documents, hosting outside Benin), privacy page and parental consent below 16.
- Payment of the public contribution scolaire through the Treasury (eQuittance, BjPay) once the DGTCP opens an integration.

## Code quality

Findings of the review of 26 September 2026 that were not fixed, because
each needs a decision or a change broader than a safe cleanup. At that date
`npx tsc --noEmit` and `npx eslint src e2e prisma scripts` report nothing,
`src` holds no `console.log` and no TODO or FIXME, and the unused
`Combobox` and `PermissionGate` kit composites were removed.

- Two `switchSchool` server actions: `src/components/shell/switch-school.ts`
  (header switcher, answers a message, audits on the school) and
  `src/features/auth/school-actions.ts` (school picker, redirects and
  revalidates the private space, audits on the user). Keep one, with one
  audit shape.
- The unique violation check (`PrismaClientKnownRequestError` with code
  `P2002`) is written out in eight places, including two local copies of the
  helper exported by `src/features/classes/academic.ts`
  (`src/features/verification/registry.ts`, `src/features/subjects/actions.ts`).
  Move it to a server only module in `src/lib` and use it everywhere.
- The `offline.entry` feature flag is declared in `src/lib/features.ts` but
  never read: offline entry cannot be switched off. Read it in the grade
  grid, the attendance register and the message composer, or drop it.
- Two variables name the screenshot folder of the end to end suite:
  `E2E_SCREENSHOTS` (`e2e/mock-exams.spec.ts`, `e2e/offline.spec.ts`) and
  `E2E_SHOTS_DIR` (`e2e/targeting.spec.ts`, `e2e/institutions.spec.ts`).
  Keep one.
- `src/components/kit/index.ts` is a barrel file nothing imports: every page
  imports kit components by file. Remove it or use it.
- knip (`npx --yes knip`) reports 91 exports and 19 exported types that no
  other module imports. Many are used inside their own file or by unit
  tests; the rest (for example `issueDocument` in
  `src/features/verification/registry.ts`, `getReceipt` in
  `src/features/payments/queries.ts`, `listCommunes` in
  `src/features/territory/queries.ts`) should be reviewed one by one and
  unexported or deleted. Its report of unused files (scripts, the service
  worker, the Playwright setup) and unused dependencies (`pg`,
  `@prisma/client`, the `@fontsource` packages) are false positives: they
  are entry points or are loaded at run time.
- `@react-pdf/types` is imported by `src/lib/pdf/components.tsx` and
  `src/lib/pdf/layout.tsx` but only installed as a dependency of
  `@react-pdf/renderer`. Declare it in `devDependencies`.
- Files over 600 lines: `src/app/globals.css` (about 2 570 lines) and
  `prisma/seed.ts` (about 1 330 lines) would read better split by area;
  `prisma/schema.prisma` (about 1 670 lines) is one file by Prisma's
  default and can stay so.
- The production database may still hold four cached translation rows of a
  footer text the interface no longer shows (removed from
  `prisma/seed-extras/translations.json`; `scripts/load-translations.ts`
  never deletes). They are never looked up. To remove them, count then
  delete the rows whose `key` is
  `3a26e60e63d84ce192ac7e4f43cc2879937c8aac433ed99c983ab6bf62742fcb` or
  `768e872f655128904fc9c96da3b91a9ac671e9931bd2898b41b9f8dfd654a07c`
  (languages `fon` and `yo`, four rows).
