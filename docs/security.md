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
| Role management | a new or duplicated role only receives permissions its creator holds (the others are dropped and reported), at the creator's level or below, never the family level; system roles are never renamed or deleted; a custom role is deleted only by someone able to assign it, when every holder is inside their scope and is moved to a role of the same level they could assign; refusals and changes are audited | `src/lib/domain/rights.ts` (tested), `src/features/roles/actions.ts` |
| Delegated roles | a school, a commune or a department creates roles for its own level only; they belong to it (`Role.owner*Id`), are invisible elsewhere, edited only by it or the ministry, and assigned only to accounts inside it; national roles are read only below the ministry; the anti escalation rules above still apply | `src/features/roles/ownership.ts` (tested), `src/features/roles/actions.ts`, `src/features/users/actions.ts` |
| School switcher | the session's school (`Session.activeSchoolId`) is set only to a school the account holds (own school or teaching appointment); the scope then follows it | `src/features/auth/school-actions.ts`, `src/lib/auth/session.ts` |
| Forgotten password | see the section below | `src/features/password-help`, `src/features/auth/reset-actions.ts`, `src/features/auth/reset-code.ts` (tested) |
| E-mail | SMTP with socket timeouts and a bound per message, never throwing; without `SMTP_HOST` only a summary is logged (masked recipient, subject, never the body, which can hold a temporary password or a code); links are built from `APP_URL`, never from the request Host header; every template value is HTML escaped and only web links are rendered | `src/lib/mail` (tested) |
| Input | zod validation at every server boundary | each `features/*/schema.ts` or action |
| Output | React escaping, no raw HTML rendering; CSV export neutralises formula injection | `src/lib/export.ts` |
| Headers | CSP without third party scripts, HSTS on HTTPS, frame denial, nosniff, referrer and permissions policies | `next.config.ts` |
| Traceability | audit log of sign ins, failures, writes, exports and rights changes | `src/lib/audit.ts` |
| Secrets | none in the repository; environment variables only | `.env.example` |

## Forgotten password flow

Most accounts have no e-mail. `/mot-de-passe-oublie` asks for the identifier and an optional phone number and files a help request routed up the hierarchy (`src/features/password-help/routing.ts`, tested): pupils, parents and school staff to their school head, school heads to the communal district, communal inspectors to the departmental direction, departmental and national agents to the ministry.

| Control | Detail |
|---|---|
| No account enumeration | same answer for an unknown, disabled or existing identifier; the request is written after the answer (`after()`) |
| Rate limits | 3 requests per identifier and 20 per client address per 15 minutes; a repeated request updates the waiting one |
| Handlers | `user:update`, the request routed to their level and territory (`helpRequestWhere`); supervising a lower level is allowed by the hierarchy, a peer of the same level needs the anti escalation rule |
| Reset | temporary password shown once, forced change at sign in, lock and counters cleared, every session closed, claimed atomically so two handlers cannot both reset, audited; a refusal needs a reason, audited |

Accounts with an address can still use the e-mail code: `/mot-de-passe-oublie/email` asks for the address, `/mot-de-passe-oublie/code` takes the code and the new password.

| Control | Detail |
|---|---|
| No account enumeration | the request always answers the same way and redirects to the code page; the code is created and e-mailed after the response (`after()`), so an existing address costs no extra time. A wrong, expired, used or exhausted code, and an unknown or disabled address, all get the same message |
| Code | 6 digits from `crypto.randomInt`; only an HMAC-SHA256 keyed with `SESSION_SECRET` and bound to the account is stored; compared in constant time |
| Lifetime | valid 15 minutes, single use; a new request voids every earlier code of the account |
| Attempts | 5 per code, counted atomically before the comparison, so parallel guesses cannot exceed the limit |
| Rate limits | requests: 3 per address and 20 per client address per 15 minutes; code checks: 10 per address and 30 per client address per 15 minutes (`hitRateLimit`); per client limits apply behind a trusted proxy, as for sign in |
| On success | new argon2id hash, `mustChangePassword` cleared, failed sign in counter and lock cleared, every session revoked, remaining codes voided, sign in limit reset, "password changed" e-mail sent, audited (`password_reset`); requests and failed codes are audited too |
| Address cookie | the code page is prefilled from a short lived httpOnly cookie limited to `/mot-de-passe-oublie`; it holds only what the visitor typed and grants nothing |

A temporary password sent by e-mail (account created, reset by a manager) is protected by the forced change at first sign in: nothing can be written with it until it is replaced. The SMTP relay should use TLS (port 465 with `SMTP_SECURE=true`, or STARTTLS on 587).

## Audit of 2026-09-25

An audit of the integrated platform found seven exploitable issues, all fixed with a proof before and after:

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | High | A teacher account not linked to a teacher record fell back to the whole school's scope | the teacher limit follows the role; an unlinked account reaches no class (`src/lib/auth/scope.ts`, tested) |
| 2 | High | Parents and students could read the rosters of their child's class (grades and attendance of classmates) | family accounts use `rosterClassroomWhere`, which reaches no roster (tested) |
| 3 | Medium | Student file sections were shown without their own permission (grades to the accountant) | each section checks its permission (`src/features/family/sections.ts`, tested) |
| 4 | Medium | Student profile loaded results for anyone with `student:view` | results load only with `grade:view`, `attendance:view` or `report_card:view` |
| 5 | Medium | Class page showed averages and attendance with `class:view` alone | shown only with the matching permissions |
| 6 | Low | Sign in answers revealed which accounts exist after repeated failures | same answer for existing and unknown addresses |
| 7 | Low | Actions and exports ran under a temporary password | refused until the password is changed |
| 8 | Low | A media address starting with a backslash was taken as a platform path | refused (tested) |

Residual, by design: offline copies on a shared phone stay readable until the sign in page is opened online; a manager can reset the password of an account with the same rights; the partner role sees school director contacts.

## Accepted advisories

| Advisory | Package path | Why accepted | Review |
|---|---|---|---|
| GHSA-ggr8-5vv4-36mx (high) | prisma > @prisma/config > deepmerge-ts | runs only when the Prisma CLI loads its configuration at build time, on trusted input | upgrade when Prisma ships a fixed release |
| GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3 (high) | prisma > mysql2 | MySQL driver bundled by the CLI, never loaded: the application uses PostgreSQL through `@prisma/adapter-pg` | same |

npm proposes a downgrade to Prisma 6 as the only fix, which would remove the driver adapter architecture. CI fails on any critical advisory.

## Known limitations

- Section rights are checked in each section layout, before any loading skeleton streams, so a refused section answers with a real 403. An object outside the user's scope inside an allowed section (another school's class, another family's invoice) shows the not found page with status 200, because that check runs in the page under its loading skeleton; no data of the target is rendered.
- Without a trusted proxy (plain Docker run), the per address login limit is disabled and only the per account limit and lockout apply.
