# Classéo

Classéo is a school management platform for Benin. It serves schools, families
and teachers, and the education administration above them: the two ministries
by cycle (MEMP for nursery and primary, MESTFP for secondary), their
departmental directions (DDEMP, DDESTFP) and the circonscriptions scolaires.
Each account sees what its role and its place in the territory allow, and
statistics are consolidated from the school up to the nation.

The platform follows Beninese rules rather than generic ones: evaluation
periodicity, the official 2024 average, free schooling, teacher status and
pay. It is built for weak connectivity, low literacy and visual or hearing
impairment: installable, usable offline, read aloud in French and available in
local languages. The interface is in French.

This readme is for engineers and technical reviewers. Depth lives in
[docs/](docs/):
[architecture](docs/architecture.md), [main flows](docs/flows.md),
[HTTP API and server actions](docs/api/README.md),
[deployment runbook](docs/deployment.md),
[payment providers](docs/payment-providers.md), [roadmap](docs/roadmap.md).
Detailed security notes are kept outside the repository.

## Features by role

**Ministry and administration** (national, departmental, circonscription)

- Territory of the 12 departments and 77 communes, split into the two
  administrative chains: a DDEMP or circonscription account reaches nursery and
  primary schools, a DDESTFP account secondary schools.
- Statistics with drill down from nation to school, year on year comparison.
- School register (type, faith, bilingual programme, authorisation), per school
  evaluation periodicity, school calendar, subjects.
- Registry of State teachers (APE, ACE, AME), appointed by schools, never
  created by them.
- Requests from schools, password help requests routed up the hierarchy,
  targeted announcements and resources.
- Roles and rights matrix, delegated roles per level, activity log.

**School head and staff** (head, secretary, accountant)

- Classes, students, enrolments, transfers between classes and schools,
  teacher appointments, parents.
- Timetable with conflict detection.
- Grade sheets with the official formula by default, report cards with ranks,
  class council decisions, mock exams.
- Fees, payment plans, invoices and receipts, with free schooling applied;
  confirmation of payments declared by parents.
- Payroll for the teachers the school pays (vacataires, private school staff).
- Queue of the pieces families send, and pieces requested by the school.
- Electronic signature and a register of every document issued.

**Teachers**

- Grade entry and attendance registers, both available offline.
- Their classes and timetable, messaging.
- "Ma paie": the school payslip, or a link to the Ministry of Finance portal for
  State agents.

**Parents**

- Family dashboard per child: grades, report cards, attendance, timetable,
  fees, announcements, with spoken summaries.
- Online payment through FedaPay, or declaration of a Mobile Money or bank
  transfer for the accountant to confirm.
- "Pièces et justificatifs": enrolment pieces, absence justifications, medical
  certificates sent to the school. Health files are deleted once the school has
  decided.

**Students**

- "Ma scolarité": their own grades, report cards and attendance, plus
  announcements and messages.

**Across roles**

- Messaging with group messages (one message to several people) and voice
  notes recorded in the browser.
- Offline mode: an installable PWA whose service worker keeps the key pages of
  the signed in account, and a device queue for grades, attendance and
  messages typed without network, replayed when the network returns.
- Local languages: the interface translated into Fongbe and Yoruba (Bariba,
  Adja, Ewe and Hausa are also offered by the translation layer), and voices in
  Fongbe, Yoruba and Hausa, through the api229langues service by Finanfa
  Ronaldo.
- Kora, the read aloud button: French is spoken by the Siwis voice (Piper),
  synthesised by a self hosted Python function, the same on every device.
- Verifiable documents: each PDF download and printed view (report cards,
  certificates, attestations, receipts, payslips) gets a verification code and
  a QR code pointing to the public page `/verifier/<code>`.
- E-mail and web push notifications, both optional.

## Architecture

- **Next.js 16** App Router with **React 19**, TypeScript, Tailwind CSS 4.
  Reads happen in server components through `src/features/*/queries.ts`.
- **Server actions** go through `createAction` (`src/lib/action.ts`): session
  and permission check, refusal under a temporary password, zod validation,
  then the handler, which scopes its queries, audits and revalidates.
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter on PostgreSQL
  (Docker locally, Neon in production). Uploaded files are stored in the
  database behind an authorization check (`src/lib/files.ts`).
- **RBAC**: permissions are `resource:action` codes (`src/lib/auth/permissions.ts`)
  grouped into roles stored in the database. Every account holds a territorial
  scope (national, department, commune, school, self), and every query composes
  its filter (`src/lib/auth/scope.ts`). `src/proxy.ts` only redirects requests
  without a session cookie; real checks run on the server.
- **Offline**: a hand written service worker (`public/sw.js`) and an IndexedDB
  queue (`src/features/offline`).
- **PDF**: `@react-pdf/renderer` documents in `src/lib/pdf`, with the
  verification register in `src/features/verification`.
- **Voice**: `api/kora-tts.py`, a Vercel Python function running Piper, called
  only by the Next.js route `/api/voix`.
- **Feature flags**: defaults in `src/lib/features.ts`, overridable per key by
  a `FeatureFlag` row without a deployment.

```mermaid
flowchart LR
  Browser["Browser<br/>PWA, service worker,<br/>offline queue"] --> Next["Next.js 16<br/>server components,<br/>server actions, routes"]
  Next --> Auth["RBAC and<br/>territorial scope"]
  Auth --> DB[("PostgreSQL<br/>Prisma 7")]
  Next --> Voice["api/kora-tts.py<br/>Piper, Siwis voice"]
  Next --> Langues["api229langues<br/>translation, voices"]
  Next --> FedaPay["FedaPay"]
  Next --> Mail["SMTP, web push"]
```

## Getting started

Prerequisites: Node.js 22 or later (`engines` in `package.json`; CI and the
Dockerfile use Node 24), Docker. Python 3.12 (`.python-version`) only for the
local voice function.

```bash
npm install
cp .env.example .env     # then set SESSION_SECRET
npm run db:up            # PostgreSQL 17 on port 55432 (DB_PORT to change it)
npm run db:deploy        # apply migrations
npm run db:seed          # demo data
npm run dev              # http://localhost:3000
```

`docker compose up -d` also works and starts Mailpit next to the database. To
run the whole platform in containers instead, with migrations and seed applied
on first start: `docker compose --profile app up --build`.

The seed builds the real territory (12 departments, 77 communes) with
fictitious schools and people, deterministically. It refuses to run on a
database that already has users. `SEED_RESET=true` (used by `npm run db:reset`)
truncates every table first and reseeds: it destroys all data.

### Environment variables

Only `DATABASE_URL` and `SESSION_SECRET` are required. Every other service is
off when its variables are empty, and the platform still works.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon: the pooled string) |
| `SESSION_SECRET` | signs session cookies and keys the reset codes; at least 32 random characters |
| `APP_URL` | public address used in e-mail and QR links; on Vercel falls back to the project URL |
| `NEXT_PUBLIC_APP_URL` | base URL of page metadata (Open Graph) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM` | e-mail relay; without `SMTP_HOST` each e-mail is only summarised in the log |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | web push; generate with `npx web-push generate-vapid-keys` |
| `FEDAPAY_ENV`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_WEBHOOK_SECRET` | online payment; without the secret key only declarations are offered. Webhook: `<APP_URL>/api/paiements/fedapay/webhook` |
| `KORA_TTS_URL`, `KORA_TTS_SECRET` | the French voice function outside Vercel, and an optional key overriding the one derived from `SESSION_SECRET` |
| `LANGUES229_API_URL`, `LANGUES229_HF_TOKEN`, `LANGUES229_API_KEY` | api229langues credentials, for live translation, local language voices and `scripts/pretranslate.ts`; all three are needed |
| `DEMO_MODE` | `off` hides the demo account panel on the sign in page |
| `TRUST_PROXY` | `true` behind a reverse proxy other than Vercel, to enable the per address sign in limit |
| `FORCE_HTTPS` | `true` behind an HTTPS proxy outside Vercel: secure cookies and HSTS |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | lets `/api/voix` reach the voice function on a protected preview deployment |
| `DB_PORT`, `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT` | host ports of `docker-compose.yml` |

`KORA_VOICE_DIR` (Python side) sets where the voice model is cached, `/tmp` by
default. `VERCEL`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are set by
Vercel.

### E-mail in development

`docker compose up -d mailpit`, then `SMTP_HOST=localhost` and `SMTP_PORT=1025`
in `.env`. Messages are read at http://localhost:8025.

### Demo accounts

The seed creates one account per role, defined in `src/lib/demo/accounts.ts`.
They share one password, shown on the sign in page, where one click fills the
form. Sign in with the identifier or the e-mail.

| Identifier | E-mail | Role |
|---|---|---|
| adjoa.houngbedji | ministre@classeo.bj | National administrator |
| rodrigue.kpadonou | analyste@classeo.bj | National analyst |
| aristide.gbaguidi | ddestfp.atlantique@classeo.bj | Departmental director, DDESTFP Atlantique |
| clarisse.akpovi | ddemp.atlantique@classeo.bj | Departmental director, DDEMP Atlantique |
| benedicta.zannou | cs.abomey-calavi@classeo.bj | Chef de circonscription, Abomey-Calavi |
| florentin.agossou | directeur@classeo.bj | School head, CEG Godomey |
| pelagie.tossou | secretaire@classeo.bj | Secretary |
| gildas.sossou | comptable@classeo.bj | Accountant |
| nafissatou.issifou | enseignant@classeo.bj | Teacher (mathematics) |
| afiavi.hounkpatin | parent@classeo.bj | Parent of two children |
| senami.hounkpatin | eleve@classeo.bj | Student, 3e A |
| estelle.amoussou | partenaire@classeo.bj | Partner organisation, read only |

Set `DEMO_MODE=off` on any deployment holding real data.

### Local voice function

Without it, French is read by each browser's own voice. To use the Siwis voice
locally:

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python scripts/kora-tts-local.py 8765
```

then set `KORA_TTS_URL=http://127.0.0.1:8765` in `.env`. The model (63 MB) is
downloaded from a pinned revision on the first request and checked against its
sha256.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` | `prisma generate`, then the standalone production build |
| `npm start` | serve the standalone build (`.next/standalone/server.js`) |
| `npm run typecheck` | route types (`next typegen`) and `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | unit tests (Vitest) |
| `npm run test:e2e` | end to end tests (Playwright) |
| `npm run db:up` | start the PostgreSQL container |
| `npm run db:migrate` | create and apply a migration in development |
| `npm run db:deploy` | apply pending migrations |
| `npm run db:seed` | seed an empty database |
| `npm run db:reset` | wipe and reseed (destroys all data) |
| `npm run db:sync-roles` | add missing default permissions, roles and grants; never removes anything |

Maintenance scripts, run with `npx tsx` (options are documented at the top of
each file):

| Script | Purpose |
|---|---|
| `scripts/pretranslate.ts` | fill the translation cache for the family pages, or `--public` for the public pages, within the service quota |
| `scripts/export-translations.ts` | write the cached translations into `prisma/seed-extras/translations.json` |
| `scripts/load-translations.ts` | load that file into a running database, idempotent, never deletes |
| `scripts/seed-public-translations.ts` | load only the Fongbe and Yoruba rows of the public pages |
| `scripts/write-credits.ts` | regenerate `public/images/CREDITS.md` from `src/features/public-pages/photos.ts` |
| `scripts/start-e2e.sh` | serve the standalone build for Playwright |
| `scripts/kora-tts-local.py` | serve the voice function locally (run with Python) |

## Testing

- **Unit**: Vitest, `src/**/*.test.ts`, no database. Business rules live in
  `src/lib/domain` as pure functions and are tested there.
- **End to end**: Playwright in `e2e/`, against the production build. Projects:
  `setup` (signs in each role once), `desktop` (1366 px), `mobile` (375 px, the
  journeys tagged `@mobile`).

The suite depends on freshly seeded data: on a reused database the order
dependent journeys fail. Reseed before every run.

It runs without any outside service. Next.js loads `.env` by itself and
does not override a variable that is already set, so unsetting a variable in
the shell is not enough: set the service variables to empty for the build and
the server, and point `DATABASE_URL` at the local database (set any other
Neon connection variable your `.env` holds to empty as well). Run this way,
the v4 suite passed 101 of 101 journeys:

```bash
export SMTP_HOST= SMTP_USER= SMTP_PASSWORD=
export FEDAPAY_SECRET_KEY= FEDAPAY_PUBLIC_KEY= FEDAPAY_WEBHOOK_SECRET=
export LANGUES229_API_URL= LANGUES229_API_KEY= LANGUES229_HF_TOKEN=
export DATABASE_URL="postgresql://classeo:classeo@localhost:55432/classeo"
npm run db:reset      # wipes and reseeds this database
npm run build
npm run test:e2e      # starts scripts/start-e2e.sh on E2E_PORT (3000)
```

Translations then come from the seeded cache, and the voice journeys pass
with or without the voice function (`KORA_TTS_URL`). `E2E_BASE_URL` targets
a server that is already running instead; `E2E_HOSTNAME` sets the address
the test server listens on (127.0.0.1), `E2E_PASSWORD` the demo password if
it was changed, and `E2E_SCREENSHOTS` or `E2E_SHOTS_DIR` a folder for the
screenshots some journeys take.

- **CI** (`.github/workflows/ci.yml`, on pushes to `main` and on pull
  requests): typecheck, lint, unit tests, migrations, build and
  `npm audit --audit-level=critical`; then a second job seeds a database,
  builds and runs the Playwright suite on Chromium.

## Deployment

Production runs on Vercel with a Neon database; a merge to `main` deploys it
automatically. The full procedure, rollback and post deployment checklist
are in the [deployment runbook](docs/deployment.md). The points that have
already caused an incident or a doubt:

- **Migrations first.** The build runs no migration. Run
  `npx prisma migrate deploy` against the production `DATABASE_URL`, then
  `npm run db:sync-roles`, and only then merge. On 2026-09-25 code reached
  production before its migrations and sign in returned 500.
- **Translations**: when `prisma/seed-extras/translations.json` changed,
  `npx tsx scripts/load-translations.ts --dry-run`, then without
  `--dry-run`.
- **Voice function**: `vercel.json` declares `api/kora-tts.py` (region
  `lhr1`, 90 s maximum duration), and Vercel installs `requirements.txt` for
  it during the build, as a preview build log and a Siwis clip served by
  production on 2026-09-26 confirmed. Its key is derived from
  `SESSION_SECRET`; previews behind Vercel protection also need
  `VERCEL_AUTOMATION_BYPASS_SECRET`.
- **Reseed** (`SEED_RESET=true`) destroys all data: demo environments only.

## Security and data protection

Passwords are hashed with argon2id, sessions are database backed and revocable,
sign in is rate limited with lockout, every action and page checks its
permission and the territorial scope on the server, inputs are validated with
zod, security headers include a CSP without third party scripts, and sensitive
actions are written to an audit log. Detailed security notes, audit findings
and accepted advisories are kept outside the repository.

Personal data of minors is processed, including health documents, which are
deleted once the school has decided on them. Processing in Benin falls under
the APDP (Autorité de Protection des Données Personnelles): the declaration and
authorisation file, notably for the NPI, health documents and hosting outside
Benin, is still to be prepared (see [docs/roadmap.md](docs/roadmap.md)).

## Project structure

```
api/              Python voice function (Vercel)
docs/             architecture, flows, API, deployment, security, payments, roadmap
e2e/              Playwright journeys and fixtures
prisma/           schema, migrations, seed, sync-roles, seed extras
public/           service worker, photos and their credits
scripts/          maintenance and test scripts
src/app/          routes: public pages, /connexion, /verifier, /espace/*, /api/*
src/components/   ui primitives, kit composites, shell, brand
src/features/     one folder per module: queries, actions, components
src/lib/          auth, domain rules, pdf, voice, mail, payments, cache, audit
```

## Credits and licences

The code of Classéo is proprietary, all rights reserved: see
[LICENSE](LICENSE). The repository is visible for reference only, and viewing
it grants no licence. Third party works keep their own licences:

- **Photos**: Wikimedia Commons, credited on the `/credits` page and in
  [public/images/CREDITS.md](public/images/CREDITS.md) (CC BY 4.0, CC BY-SA 4.0
  and public domain).
- **French voice**: Piper voice `fr_FR-siwis-medium`, trained on the SIWIS
  database, CC BY 4.0.
- **Local languages**: translation and voices by the api229langues service of
  Finanfa Ronaldo (https://api229langues.vercel.app), credited on `/credits`.
- **Dependencies**: Next.js, React, zod, jose, pg, `@node-rs/argon2`,
  `@react-pdf/renderer` (MIT); Prisma (Apache-2.0); lucide-react (ISC);
  nodemailer (MIT-0); web-push (MPL-2.0); Atkinson Hyperlegible Next and
  Bricolage Grotesque fonts (OFL-1.1). `piper-tts` is GPL-3.0-or-later: it
  runs only on the server, inside the Python function, and is not distributed
  to browsers.

## Contributing

- Branch from the current release branch; name branches by type
  (`feat/...`, `fix/...`, `docs/...`).
- Commits are atomic, in English, in the conventional form
  `type(scope): summary`.
- Before a pull request: `npm run typecheck`, `npm run lint`, `npm test`, and
  the Playwright journeys touched by the change. A schema change ships with its
  migration; a new permission is added to `src/lib/auth/permissions.ts` so that
  `db:sync-roles` brings existing databases up to date.
- Code, comments, commits and technical documentation are in English; the
  interface is in French.
