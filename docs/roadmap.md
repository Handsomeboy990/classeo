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

- Mobile Money collection (MTN MoMo, Moov Money) with automatic reconciliation of invoices, instead of recording the transaction reference by hand.
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
