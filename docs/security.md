# Security notes

## Controls in place

| Area | Control | Where |
|---|---|---|
| Passwords | argon2id (19 MiB, 2 iterations), forced change at first sign in, 10 characters minimum | `src/lib/auth/password.ts`, `src/features/auth/actions.ts` |
| Sessions | signed httpOnly SameSite cookie holding a session id, checked against the database on every request, revocable, closed on password change | `src/lib/auth/session.ts` |
| Brute force | 10 attempts per account per 15 minutes, 30 per address behind a trusted proxy, account lock after 5 failures, same response time for unknown emails | `src/features/auth/actions.ts`, `src/lib/rate-limit.ts` |
| Authorization | permission codes checked on the server for every action and page; the menu is only a reflection | `src/lib/auth/authorize.ts`, `src/lib/action.ts` |
| Object access | every query composes the territorial scope filter; teachers are limited to their own classes | `src/lib/auth/scope.ts` |
| Privilege escalation | a role can only be assigned or edited by someone holding all its permissions at an equal or higher level | `src/lib/domain/rights.ts` |
| Input | zod validation at every server boundary | each `features/*/schema.ts` or action |
| Output | React escaping, no raw HTML rendering; CSV export neutralises formula injection | `src/lib/export.ts` |
| Headers | CSP without third party scripts, HSTS on HTTPS, frame denial, nosniff, referrer and permissions policies | `next.config.ts` |
| Traceability | audit log of sign ins, failures, writes, exports and rights changes | `src/lib/audit.ts` |
| Secrets | none in the repository; environment variables only | `.env.example` |

## Accepted advisories

| Advisory | Package path | Why accepted | Review |
|---|---|---|---|
| GHSA-ggr8-5vv4-36mx (high) | prisma > @prisma/config > deepmerge-ts | runs only when the Prisma CLI loads its configuration at build time, on trusted input | upgrade when Prisma ships a fixed release |
| GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3 (high) | prisma > mysql2 | MySQL driver bundled by the CLI, never loaded: the application uses PostgreSQL through `@prisma/adapter-pg` | same |

npm proposes a downgrade to Prisma 6 as the only fix, which would remove the driver adapter architecture. CI fails on any critical advisory.

## Known limitations

- Pages that end in the 403 or 404 page return HTTP status 200, because the shared loading skeleton starts streaming before the page decides. The page renders no data of the target. Route handlers return real 403 statuses.
- Without a trusted proxy (plain Docker run), the per address login limit is disabled and only the per account limit and lockout apply.
