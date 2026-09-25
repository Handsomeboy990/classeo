# Classéo

National education platform for Benin, built for the EduTech Benin challenge
of the Ministry of Digital Transformation.

Classéo connects the ministry, the departmental directorates, the communal
school districts, schools, teachers, students, parents and partner
organisations on one system. Rights are fine grained, statistics are
consolidated at every level of the territory, and the platform is designed for
users with visual or hearing impairment, low literacy and weak connectivity.

## Stack

Next.js 16 (App Router, Server Components, Server Actions), TypeScript,
Tailwind CSS 4, Prisma 7 with PostgreSQL (Neon in production), Vitest,
Playwright, Docker.

Architecture and decisions: [docs/architecture.md](docs/architecture.md).
Security controls and audit: [docs/security.md](docs/security.md).
Roadmap: [docs/roadmap.md](docs/roadmap.md).

## Run it

### With Docker, one command

```bash
docker compose --profile app up --build
```

Open http://localhost:3000. Migrations and demo data are applied on first
start.

### For development

Requirements: Node.js 22 or later, Docker.

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET
npm run db:up                 # PostgreSQL on port 55432
npm run db:deploy             # apply migrations
npm run db:seed               # demo data (about a minute)
npm run dev
```

## Demo accounts

Every account uses the password `Classeo2026`. The sign in page lists them and
fills the form in one click.

| Role | Email |
|---|---|
| National administrator | ministre@classeo.bj |
| National analyst | analyste@classeo.bj |
| Departmental director (Atlantique) | ddemp.atlantique@classeo.bj |
| Communal school district head (Abomey-Calavi) | cs.abomey-calavi@classeo.bj |
| School director (CEG Godomey) | directeur@classeo.bj |
| Secretary | secretaire@classeo.bj |
| Accountant | comptable@classeo.bj |
| Teacher (mathematics) | enseignant@classeo.bj |
| Parent | parent@classeo.bj |
| Student | eleve@classeo.bj |
| Partner organisation | partenaire@classeo.bj |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | route types and TypeScript |
| `npm run lint` | ESLint |
| `npm test` | unit tests |
| `npm run test:e2e` | end to end tests (Playwright, needs a built app and a seeded database) |
| `npm run db:seed` | seed an empty database |
| `npm run db:reset` | wipe and reseed (destroys all data) |
| `npm run db:sync-roles` | add missing default permissions to an existing database |

## Project layout

```
src/app/            routes: public pages, /connexion, /espace/*
src/components/ui/  primitives
src/components/kit/ reusable composites (tables, forms, states, voice)
src/features/       one folder per module: queries, actions, components
src/lib/auth/       sessions, permissions, authorization, territorial scope
src/lib/domain/     pure business rules, unit tested
prisma/             schema, migrations, demo seed
```
