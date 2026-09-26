# Classéo, architecture

Status: approved on 2026-09-25. Challenge: EduTech Benin (Ministry of Digital
Transformation). Deadline: Saturday evening, presented Monday.
Functional reference: the scolarite project (Laravel 12, 604 commits), whose
business rules are transposed, not reinvented.

## 1. Executive summary

Classéo is a national education platform for Benin. It connects the ministry,
its departmental and communal services, schools, teachers, students, parents
and partner structures on one system, with fine grained rights and statistics
consolidated at every level of the territory. It is built for users with
visual or hearing impairment, low literacy and weak connectivity.

Name: Classéo, from "classe": understood at once by every reader, including parents with low literacy. The voice module that reads the platform aloud is called Kora.

## 2. Requirements mapping

| Challenge requirement | Answer in Classéo |
|---|---|
| Functional and inclusive solution | Every journey works end to end on real seeded data. Inclusion is a layer on every page, section 8 |
| Clear interface for limited connectivity | Server rendered pages, light payloads, installable PWA with offline reading, no heavy client libraries |
| Content management | Announcements and pedagogical resources: create, edit, publish, archive. A text transcript is mandatory for any audio or video |
| Interactions between all actors | Messaging, school to parent notifications, school to ministry requests, bulletins published to parents |
| Ministry and structures | Territorial hierarchy with scoped dashboards, section 5 |
| Evaluation: code analysis | Layered code, typed end to end, tests on business rules, reusable component library, Docker, CI |

## 3. Scope and roadmap

Nothing is dropped. Everything is scheduled in waves, and the schema is
designed for all waves on day one so that later waves add no conflicting
migration.

| Wave | Content | Target |
|---|---|---|
| W0 Foundations | Next.js app, design system, component library, schema, auth, RBAC engine, territorial model, seed, Docker, CI, preview deploy | today, first |
| W1 Core | Territory and schools admin, classes, students and enrollments, teachers, parents; grades (grade sheets, formulas, lock, report cards, ranks); attendance; content management; messaging and notifications; ministry dashboards at every level; rights management UI; inclusion layer | today |
| W2 | School fees, invoices, payment plans, payments with cascade distribution; full timetable (weekly slots, exceptions, events) | today if time allows, otherwise Monday roadmap slide |
| W3 | Payroll, salary grids, budgets, expenses, financial reports | roadmap |
| W4 | Mobile Money payments, SMS and USSD channel, voice interface in local languages (Fon, Yoruba, Dendi), national student identifier and interoperability | roadmap |

## 4. Stack

| Decision | Choice | Rejected alternative and why |
|---|---|---|
| Framework | Next.js (latest stable), App Router, React Server Components, Server Actions, TypeScript strict | Separate SPA plus API: two deployables, more client JavaScript, worse on weak networks |
| UI | Tailwind CSS plus shadcn/ui primitives (Radix, accessible by construction), wrapped in our own component library | Hand rolled primitives: accessibility bugs in dialogs and menus |
| Database | Neon PostgreSQL | Supabase: brings auth and storage we do not need |
| ORM | Prisma with the Neon serverless driver adapter | Drizzle: equally valid, Prisma is already known from MediStack |
| Auth | Own session: argon2 password hashes, signed httpOnly cookie (jose), session row in database for revocation | Auth.js: its credentials provider fights custom session revocation and scoped roles |
| Validation | zod at every server boundary | none |
| Tests | Vitest for domain rules and authorization, Playwright for critical journeys | Jest: slower, heavier config |
| Deploy | Vercel for the public link, Neon for data | a VPS: no time to operate one |
| Container | Dockerfile (Next.js standalone output) and docker-compose (app plus PostgreSQL) | see below |

On Docker, yes, but used for what it is good for. Vercel does not run our
container, so Docker is not the production path. It gives three things at
about 30 minutes of cost:
- the jury can run the whole platform with one command without a Neon
  account;
- local development runs against a real PostgreSQL;
- the application stays portable to a government data center, which matters
  to a ministry that cannot depend on a foreign SaaS.

## 5. Territorial model and scoped statistics

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
user who is not a ministry agent holds a scope: an entity at one level. A
query runs through one function, `scopeFilter(user)`, which returns the Prisma
`where` clause for the user's scope:
- a national agent sees everything;
- a departmental agent sees the schools of the communes of their department;
- a communal agent sees the schools of their commune;
- a school user sees their school;
- a parent sees their children;
- a student sees themselves.

Statistics aggregate the same indicators at every level: enrollments, gender
parity, pass rate, averages, attendance rate, teacher to student ratio,
content activity, fee recovery in W2. A drill down goes from nation to
department, commune, then school. The same dashboard component serves every
level.

Seed data: the real 12 departments and 77 communes, fictitious schools and
people with local names, amounts in FCFA.

## 6. Rights management

The model is permission based with a territorial scope. It is not a list of
hardcoded roles.

- **Permission:** `resource:action`. The resources are `territory`, `school`,
  `class`, `student`, `teacher`, `parent`, `grade`, `report_card`,
  `attendance`, `content`, `message`, `statistics`, `user`, `role`, `audit`,
  `fee`, `payment`, `timetable`. The actions are `view`, `create`, `update`,
  `delete`, `export`, `publish`, `lock`, `approve`.
- **Role:** a named set of permissions, stored in the database and seeded
  with defaults. It can be edited from a permission matrix screen by an
  authorized administrator. Every change is audited.
- **Default roles:**
  - ministry side: national administrator, national analyst, departmental
    director, communal inspector;
  - school side: school director, secretary, accountant, teacher;
  - other users: student, parent, partner structure (read only statistics).
- **Enforcement:**
  - One server side choke point, `authorize(user, "grade:update", resource)`,
    called by every server action and route handler. It checks the
    permission and then object ownership through the scope. A teacher may
    update grades only on the sheets of classes they teach.
  - The UI never decides access. Menus, buttons and export actions are
    derived from the same permission set through `can()`, only to hide what
    the server would refuse anyway.
- **Menu:** the navigation is declared once as data, and each entry names the
  permission it requires. The sidebar renders the entries the user is allowed
  to see.
- **Audit log:** who did what, to which object, when, and from which scope.
  It covers every write, export, login and role change.

## 7. Application architecture

```
src/
  app/                      routes grouped by space: (auth), (public), espace/...
  components/ui/            primitives (shadcn, themed)
  components/kit/           reusable composites: DataTable, PageHeader,
                            StatCard, FilterBar, FormField, ConfirmDialog,
                            EmptyState, ErrorState, Skeletons, ReadAloud,
                            PermissionGate, ScopeBreadcrumb, ChartCard
  features/<module>/        per module: queries.ts, actions.ts, schema.ts (zod),
                            components/
  lib/auth/                 session, password, authorize, can, scopeFilter
  lib/domain/               pure business rules: grade formulas, ranks,
                            attendance rates, invoice distribution (unit tested)
  lib/db.ts, lib/cache.ts, lib/audit.ts, lib/rate-limit.ts
prisma/schema.prisma, prisma/seed.ts
```

Rules:
- Business rules live in `lib/domain` as pure functions.
- A page is composed from kit components. A module never re-implements a
  table, a form field or a state view.
- Data reads happen in server components through `features/*/queries.ts`.
  Writes go through server actions that validate, authorize, write, audit and
  revalidate, in that order.

## 8. Inclusion layer

- **Read aloud.** A button on every page and on every card reads the content
  in French through the Web Speech API. Report cards and announcements are
  also read aloud.
- **Low literacy.**
  - The parent and student spaces use pictograms, few words and guided audio
    labels.
  - Key figures are shown as colour coded levels (good, average, at risk),
    and the colour always comes with an icon and a word.
- **Visual impairment.**
  - Contrast meets WCAG AA and the high contrast mode meets AAA.
  - Text size can be adjusted up to 200 percent without breaking the layout.
  - Every screen is fully usable from the keyboard, with a visible focus.
  - Landmarks and labels are in place for screen readers.
- **Hearing impairment.**
  - No information is carried by sound alone.
  - Captions or transcripts are mandatory on audio and video content.
  - Alerts are visual, and notifications are in text.
- **Connectivity.**
  - The platform is an installable PWA.
  - Timetable, report cards and announcements are cached for offline reading.
  - A light data mode disables images.
- **Preferences.** They are stored per device and applied before the first
  paint, with no flash.

## 9. Cross cutting quality

- **Cache.**
  - Reference and statistics reads are cached per scope with cache tags and
    invalidated by the mutating action.
  - User scoped data is never shared across users.
  - Static assets are immutable and the service worker serves the offline
    shell.
- **Security.**
  - Sessions: argon2 password hashing, signed httpOnly SameSite cookies, and
    sessions that can be revoked.
  - Forced password change at first login.
  - Login rate limiting per account and per IP, with a lockout.
  - zod on every input.
  - Access control is checked on each object, which prevents one user from
    reaching another's data (IDOR).
  - Server actions carry built-in CSRF protection through an origin check.
  - Security headers: CSP, HSTS, frame-ancestors, Referrer-Policy and
    Permissions-Policy.
  - No secret in the repository.
  - `npm audit` runs in CI.
  - An audit log records every sensitive action.
- **UI states.**
  - Every data view has a loading skeleton (`loading.tsx` and Suspense), an
    empty state, an error state with retry (`error.tsx`), and pending and
    disabled submit buttons.
  - Changes show immediate feedback, and success and failure notifications
    are both announced to screen readers.
- **Brand.**
  - The palette comes from the Benin flag and meets the contrast targets:
    primary deep green, accent yellow on dark surfaces only, red reserved for
    danger.
  - Tokens are declared once in CSS variables, with light and dark themes.
  - The original SVG logo is a book whose pages form a rising sun. It is also
    produced as a favicon, PWA icons and an Open Graph image.

## 10. Risks

| Risk | Mitigation |
|---|---|
| One day for a broad scope | Schema designed once for all waves; vertical modules built in parallel by agents on disjoint folders; W2 and later waves protected by the roadmap |
| Parallel agents colliding | Wave 0 fixes the contracts first: schema, kit, auth API, navigation. Each agent owns a disjoint `features/<module>` and route folder |
| Vercel CLI logged out | You run `vercel login` before the first deploy |
| Production deploy not delegated to me | Configuration allows non production only. I prepare the production deploy and hand it to you |
| Speech synthesis voice availability | Browser French voice. When none is available, the button explains why and falls back to the text |

## 11. Delivery plan and agents

| Step | Owner | Output | Gate |
|---|---|---|---|
| W0 | me, sequential | scaffold, tokens, logo, kit, schema, auth, RBAC, scope, seed, Docker, CI, preview deploy | build green, login works per role, `authorize` tests pass |
| W1a | `frontend-engineer` (worktree) | pedagogy: classes, enrollments, grades, report cards, attendance | unit tests on formulas, journey test |
| W1b | `backend-engineer` (worktree) | ministry: territory admin, schools, scoped statistics and drill down, rights matrix UI, audit log view | scope tests |
| W1c | `frontend-engineer` (worktree) | communication: content management, messaging, notifications | journey test |
| W1d | `ui-ux-engineer` (worktree) | inclusion layer, PWA, parent and student spaces | accessibility checks |
| Merge | me | integration, conflicts, seed coherence | full build and tests |
| W2 | agents again | fees and payments, timetable | tests |
| Verify | `qa-engineer`, `playwright-engineer`, `security-engineer` | tests, journeys, security audit and fixes | findings fixed |
| Final | `final-verifier` | independent verdict | evidence |
| Ship | you | production deploy, links emailed | production answered |
