# Classéo, architecture

For engineers joining the project or reviewing it. It describes how the
platform is built and why; the journeys step by step are in
[flows.md](flows.md), the HTTP routes and server actions in
[api/](api/README.md), operations in [deployment.md](deployment.md), security
controls in [security.md](security.md), and what is not built yet in
[roadmap.md](roadmap.md).

## 1. Summary

Classéo is a school management platform for Benin. It connects the
ministries (MEMP for nursery and primary, MESTFP for secondary), their
departmental directions and the circonscriptions scolaires, schools,
teachers, students, parents and partner organisations on one system, with
fine grained rights and statistics consolidated at every level of the
territory. It is built for users with visual or hearing impairment, low
literacy and weak connectivity.

The name comes from "classe", understood at once by every reader, including
parents with low literacy. The read aloud voice of the platform is called
Kora.

Some business rules (grade formulas, ranks, invoice distribution) are
transposed from an earlier Laravel school application, "scolarite", and then
adapted to the Beninese texts cited in the code.

## 2. Stack

| Decision | Choice | Rejected alternative and why |
|---|---|---|
| Framework | Next.js 16, App Router, React Server Components, server actions, TypeScript strict | A separate SPA plus API: two deployables, more client JavaScript, worse on weak networks |
| UI | Tailwind CSS 4 and our own primitives (`src/components/ui`) and composites (`src/components/kit`) | A third party component library: heavier, and accessibility still has to be checked |
| Database | PostgreSQL 17: Docker locally, Neon in production | Supabase: brings auth and storage the platform does not use |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`), one client per process | Drizzle: equally valid |
| Auth | Own sessions: argon2id hashes (`@node-rs/argon2`), signed httpOnly cookie (`jose`), a session row per sign in for revocation | Auth.js: its credentials provider fights custom revocation and scoped roles |
| Validation | zod at every server boundary | none |
| Tests | Vitest for domain rules and authorization, Playwright for journeys | Jest: slower, heavier configuration |
| Hosting | Vercel (functions in `lhr1`) and Neon | A VPS: one more system to operate |
| Container | `Dockerfile` (Next.js standalone output) and `docker-compose.yml` (database, Mailpit, optional app profile) | see below |
| French voice | Piper, voice `fr_FR-siwis-medium`, in a Vercel Python function (`api/kora-tts.py`) | The browser's own voice only: different, sometimes harsh, from one device to the next; it remains the fallback |

Vercel does not run the container, so Docker is not the production path. It
lets anyone run the whole platform with one command without a Neon account,
gives local development a real PostgreSQL, and keeps the application
portable to a government data centre.

## 3. Territorial model and scoped statistics

```
Nation (MEMP and MESTFP)
  Department (12)
    DDEMP: nursery and primary schools
      Commune (77, holding the circonscription scolaire of the primary chain)
        School (nursery, primary)
    DDESTFP: secondary schools, no circonscription
      School (secondary general, technical)
```

Two administrative chains share the territory (`src/lib/domain/chains.ts`): a
departmental account belongs to the DDEMP or to the DDESTFP and reaches only
the schools of its cycles; a circonscription reaches nursery and primary
schools only. An account without a chain (created before the chains) keeps
both. Real circonscriptions (118, distinct from the 77 communes) and
pedagogical zones are on the roadmap.

Each school belongs to one commune, each commune to one department. Every
account holds a scope: national, department, commune, school, or self (a
parent or a student). Queries compose the filter of the user's scope through
the functions of `src/lib/auth/scope.ts` (`schoolWhere`, `classroomWhere`,
`enrollmentWhere` and the others), one per model:

- a national agent sees everything;
- a departmental agent sees the schools of the communes of their department,
  within their chain;
- a communal agent sees the schools of their commune;
- a school account sees its school, or the school chosen for the session
  when it works in several;
- a parent sees their children; a student sees themselves.

Statistics aggregate the same indicators at every level
(`src/lib/domain/indicators.ts`: schools, enrollments, girls' share,
students with a disability, teachers, students per teacher, class size,
absence rate, pass rate and mean average of the previous year, pending
requests). A drill down goes from nation to department, commune, then
school, and the same dashboard serves every level.

Seed data: the real 12 departments and 77 communes, fictitious schools and
people with local names, amounts in FCFA.

## 4. Rights management

The model is permission based with a territorial scope, not a list of
hardcoded roles.

- **Permission:** `resource:action`, catalogued in
  `src/lib/auth/permissions.ts`. The resources include `territory`,
  `school`, `class`, `student`, `teacher`, `parent`, `grade`,
  `report_card`, `attendance`, `timetable`, `content`, `message`,
  `request`, `statistics`, `fee`, `payment`, `user`, `role`, `audit`,
  `translation`, `calendar`, `subject`, `document_request`, `mock_exam`,
  `family_document`, `health_document`, `payroll` and `payslip`. The actions
  are `view`, `create`, `update`, `delete`, `export`, `publish`, `lock` and
  `approve`, and a table lists which actions apply to which resource.
- **Role:** a named set of permissions stored in the database and seeded with
  defaults: national administrator, national analyst, departmental director,
  communal inspector, school head, secretary, accountant, teacher, parent,
  student, partner (read only). Roles are edited from the rights matrix;
  schools, communes and departments may create roles for their own level.
  Every change is audited. `npm run db:sync-roles` adds missing default
  permissions and grants to an existing database without removing anything.
- **Enforcement:**
  - `authorize(user, permission)` (`src/lib/auth/authorize.ts`) is the
    permission check of every server action (through `createAction`) and of
    the export routes. Ownership is the second half of the check: the
    handler's query is composed with the scope filter and must find the
    target row, or the request fails with the same answer as an unknown id.
  - The UI never decides access. Menus and buttons use `can()` on the same
    permission set, only to hide what the server would refuse anyway.
- **Menu:** the navigation is declared once as data
  (`src/lib/navigation.ts`), each entry naming the permission it requires.
- **Audit log:** who did what, to which object, when, from which scope. It
  covers writes, exports and downloads, sign ins and failed sign ins, and
  role changes.

## 5. Application structure

```
src/
  app/                      routes: public pages, /connexion, /verifier,
                            /espace/* (private space), /api/* (route handlers)
  components/ui/            primitives (buttons, inputs, dialogs, cards)
  components/kit/           composites: DataTable, PageHeader, StatCard,
                            FormField, FormDialog, ConfirmButton, ReadAloud,
                            PermissionGate, charts, skeletons, states
  components/shell/         layout, navigation, accessibility controls
  features/<module>/        per module: queries.ts, actions.ts, rules.ts
                            (pure, tested), components/
  lib/auth/                 session, password, permissions, authorize, scope
  lib/domain/               pure business rules: grade formulas, ranks,
                            periodicity, attendance, payments, payroll,
                            free schooling, timetable conflicts (unit tested)
  lib/pdf/                  PDF documents, printed views, verification codes
  lib/voice/                Kora: French voice client and server, allowlist
  lib/payments/             payment providers (FedaPay)
  lib/mail/, lib/channels/  e-mail and web push
  lib/db.ts, lib/cache.ts, lib/audit.ts, lib/rate-limit.ts, lib/files.ts,
  lib/features.ts
api/kora-tts.py             Python voice function (Vercel)
public/sw.js                service worker
prisma/                     schema, migrations, seed, sync-roles
```

Rules:

- Business rules live in pure functions (`lib/domain`, `features/*/rules.ts`)
  and are unit tested there.
- A page is composed from kit components; a module does not re-implement a
  table, a form field or a state view.
- Reads happen in server components through `features/*/queries.ts`. Writes
  go through server actions built with `createAction` (`src/lib/action.ts`):
  authenticate, authorize, refuse a temporary password, validate, then the
  handler scopes, writes, audits and invalidates caches.
- Route handlers exist only where a server action does not fit: file and
  PDF downloads, CSV exports, polling, speech and translation, offline
  replay, and the payment webhook.

## 6. Integrations and cross module services

- **Files** are stored in PostgreSQL (`FileBlob`), never on a disk or a
  bucket. Every upload is checked against its first bytes (`src/lib/files.ts`):
  the declared type is ignored, the stored type is the sniffed one, SVG
  logos may not carry scripts. `/api/files/[id]` serves a file after an
  access check by purpose.
- **PDF and verification**: `@react-pdf/renderer` documents in
  `src/lib/pdf`, served through `exportPdf`. Each download and printed view
  gets a verification code and a QR code to `/verifier/<code>`, registered
  with the hash of the file (`src/features/verification`). School heads sign
  documents electronically; a signature seals the content.
- **French voice (Kora)**: the browser asks `/api/voix`, which serves cached
  clips and, on a miss, calls the Python function `api/kora-tts.py` of the
  same deployment (Piper, voice Siwis). When the function is not configured
  or fails, or the device is offline, the browser's own speech synthesis
  reads the text (`src/lib/voice/kora.ts`).
- **Local languages**: api229langues translates the interface and contents
  (Fongbe, Yoruba, Bariba, Adja, Ewe, Hausa) and speaks Fongbe, Yoruba and
  Hausa. Every result is cached in the database; missing interface strings
  are translated in the background within the service quota
  (`src/features/languages/service.ts`).
- **Payments**: FedaPay (Mobile Money and cards) behind a provider interface
  (`src/lib/payments/providers`), with a signed webhook; declarations of
  transfers made outside the platform, confirmed by the accountant. See
  [payment-providers.md](payment-providers.md).
- **Notifications**: in app always; e-mail through SMTP and web push through
  VAPID, each off when its variables are empty.
- **Offline**: a hand written service worker keeps the key pages of the
  signed in account, and an IndexedDB queue holds grades, attendance and
  messages typed without network until they are replayed
  (`src/features/offline`).
- **Feature flags**: defaults in `src/lib/features.ts`, overridable per key
  by a `FeatureFlag` row without a deployment (online payment, declarations,
  translation, voices, mock exams, transfers, signatures, the announcement
  ticker).

## 7. Inclusion layer

- **Read aloud.** A button on pages and cards reads the content in French
  with Kora: the Siwis voice synthesised on the server, the same on every
  device, or the browser's voice as a fallback (a French female voice when
  one exists). Report cards and announcements are read aloud too, and in
  Fongbe, Yoruba or Hausa where the voice is enabled. Speed is a preference.
- **Low literacy.**
  - The parent and student spaces use pictograms, few words and spoken
    summaries.
  - Key figures are shown as colour coded levels (good, average, at risk),
    and the colour always comes with an icon and a word.
- **Visual impairment.**
  - Contrast meets WCAG AA; the high contrast mode aims at AAA.
  - Text size is a preference (up to 150 percent of the base size), on top
    of browser zoom, and layouts reflow.
  - Every screen is usable from the keyboard, with a visible focus.
  - Landmarks and labels are in place for screen readers.
- **Hearing impairment.**
  - No information is carried by sound alone.
  - An audio or video content cannot be published without a text
    transcript.
  - Alerts are visual, and notifications are in text.
- **Connectivity.**
  - The platform is an installable PWA that keeps the key pages of the
    account for offline reading.
  - Grades, attendance and messages can be typed offline and are replayed
    when the network returns, with conflict detection.
  - A light mode hides decorative images.
- **Preferences** (theme, contrast, text size, light mode, voice speed) are
  stored per device and applied before the first paint.

## 8. Cross cutting quality

- **Cache.**
  - Reference and statistics reads are cached with tags (`src/lib/cache.ts`)
    and invalidated by the mutating action; role permissions are cached and
    invalidated by the rights matrix.
  - User scoped data is never shared across users.
  - Static assets are immutable; the service worker serves the offline
    shell and the private pages of the signed in account only.
- **Security.** Summary here, details and audit findings in
  [security.md](security.md).
  - argon2id hashes, signed httpOnly SameSite=Lax cookies, revocable
    sessions of eight hours.
  - Forced password change after any temporary password.
  - Sign in limits per account and per address, with a lockout.
  - zod on every input; access control on each object through the scope
    filters (no IDOR).
  - Server actions carry the built in origin check of Next.js; the offline
    replay route checks the origin itself.
  - Security headers: CSP without third party origins, HSTS where TLS is
    guaranteed, frame-ancestors, Referrer-Policy, Permissions-Policy.
  - No secret in the repository; `npm audit` in CI.
  - An audit log of every sensitive action.
- **UI states.**
  - Data views have a loading skeleton, an empty state, an error state with
    retry, and pending and disabled submit buttons.
  - Success and failure notifications are announced to screen readers.
- **Brand.**
  - The palette comes from the Benin flag: primary deep green, accent yellow
    on dark surfaces only, red reserved for danger.
  - Tokens are declared once in CSS variables, with light and dark themes.
  - The SVG logo is a book whose pages form a rising sun, also produced as
    favicon, PWA icons and Open Graph image.
