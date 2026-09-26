# Roadmap

Classéo is delivered in waves. The data model already holds the tables of the
next waves, so they add features without conflicting migrations.

## Delivered

| Wave | Content |
|---|---|
| W0 Foundations | data model, sessions, permissions with territorial scope, component kit, brand, demo data for the 12 departments and 77 communes, Docker, CI |
| W1 Core | classes, students, teachers, parents; grade entry, report cards, attendance; statistics at every territorial level; schools, requests, user accounts, rights matrix, activity log; targeted content, messaging, notifications; audio first family space, installable offline app, public landing |
| W2 | school fees, payment plans, invoices, payments with cascade over installments, receipts; weekly timetable with conflict detection |
| Quality | 161 unit tests, 45 end to end tests in CI, security audit with seven fixes, real 403 statuses |

## Next

### W3: school finance (schema ready)

- Payroll from salary grids, with the draft, approved and paid workflow.
- Budgets per category and year, with approval that prevents deletion.
- Expenses and a financial report comparing budget, income from fees and spending.

### W4: reach every family

- Online payment through an aggregator is built (FedaPay adapter, signed webhook, reconciliation of invoices), waiting for the merchant keys; parents can already declare a Mobile Money or bank transfer that the accountant confirms. Next: one FedaPay sub-account per school so the money lands on the school's own account, and an adapter for the Treasury's payment platform for public schools once the DGTCP opens an integration (see payment-providers.md; the TrésorPay name is not confirmed for Benin). A direct connection to the operators' APIs (MTN MoMo, Moov Money) is out of scope: the aggregator carries it.
- SMS and voice call notifications for parents without a smartphone, using the preferred channel already stored on each guardian.
- USSD menu to check a child's last average and absences on a basic phone.
- Voice in Fon, Yoruba, Dendi and Bariba for the read aloud feature, starting with pre recorded messages for the most frequent notifications.
- Sign language videos for national announcements, next to the text transcript already required.

### W5: national scale and interoperability

- National student identifier shared between schools, so a transfer keeps the history and the report cards follow the student.
- Background jobs for mass notifications (national and departmental announcements) and for scheduled statistics snapshots.
- Examination results (CEP, BEPC, BAC) imported from the examination office and compared with continuous assessment.
- Open data export of aggregated indicators for partners, with no personal data.
- Offline data entry for teachers in areas without network, synchronised when the connection returns.

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
- Enrollment documents of article 21, absence justifications, medical certificates and EPS dispensations uploaded by families (in progress on the features branch).
- Class council sessions per period with an entered appreciation, beyond the end of year decision; invalidation after 60 days of abandonment (article 63).
- Teacher statistics by status, history of appointments and vacant posts per circonscription; hourly quotas of annex 1 as defaults with an alert in the timetable.
- Payroll: salary grids, CNSS statements for private schools, several months at once; the payer of public school vacataires to confirm.
- Censeur, surveillant général and professeur principal as model roles of secondary schools.
- Nursery levels (petite and grande section) without marks, technical streams.
- Honour roll, congratulations and encouragements configurable by school; register of the disciplinary council's sanctions.
- APDP declaration and authorisation file (NPI, health documents, hosting outside Benin), privacy page and parental consent below 16.
- Payment of the public contribution scolaire through the Treasury (eQuittance, BjPay) once the DGTCP opens an integration.
