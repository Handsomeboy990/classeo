# Classéo, deployment runbook

For the person deploying Classéo or answering an incident after a
deployment. Steps are in the order to run them. Commands run from the root of
a checkout of the branch being deployed, with `npm ci` done.

## Environments

| Environment | Where | Database | Deployed by |
|---|---|---|---|
| Local | `npm run dev`, or `docker compose --profile app up --build` | PostgreSQL 17 in Docker (`npm run db:up`, port 55432) | you |
| Preview | Vercel preview deployment of a branch or pull request, behind Vercel Authentication | the `DATABASE_URL` set for Preview in Vercel | Vercel, on every push |
| Production | Vercel production deployment, functions in `lhr1` (`vercel.json`) | Neon PostgreSQL | Vercel, automatically on every merge to `main` |

Outside Vercel, the `Dockerfile` builds the standalone server; see
[Outside Vercel](#outside-vercel).

What the build does and does not do: `npm run build` runs `prisma generate`
then `next build`. **It runs no migration.** A merge to `main` therefore
deploys code to production whether or not its migrations were applied. This
happened on 2026-09-25: the code reached production before its migrations,
and sign in returned 500 until `prisma migrate deploy` was run. Migrations
always go first.

## Environment variables

Set in Vercel, per environment. Only `DATABASE_URL` and `SESSION_SECRET` are
required; every other service is off when its variables are empty. The full
list with comments is in [.env.example](../.env.example), and the table in
the [README](../README.md#environment-variables).

- Every environment: `DATABASE_URL`, `SESSION_SECRET` (at least 32 random
  characters, a different one per environment: it signs sessions, keys the
  reset codes, the public clip tokens and the voice function key).
- Production: also `APP_URL` and `NEXT_PUBLIC_APP_URL` (the public address,
  used in e-mails and QR codes), the SMTP variables, the VAPID keys, the
  FedaPay variables with `FEDAPAY_ENV=live`, the api229langues variables
  (`LANGUES229_API_URL`, `LANGUES229_API_KEY`, `LANGUES229_HF_TOKEN`), and,
  while production holds demo data, `DEMO_ACCESS_TOKEN` and `DEMO_PASSWORD`
  (see [Demo access](#demo-access)). `DEMO_MODE` stays unset: the public sign
  in page of the production deployment never shows the demo panel.
- Preview behind Vercel Authentication: `VERCEL_AUTOMATION_BYPASS_SECRET`,
  so that `/api/voix` can reach the voice function of the preview.
- The voice needs nothing else on Vercel: the Python function runs in the
  same deployment and its key is derived from `SESSION_SECRET`.
  `KORA_TTS_SECRET` overrides it on both sides when set.

A changed variable only applies to deployments made after the change:
redeploy after editing one.

## First deployment

1. Create the Neon database and the Vercel project linked to the
   repository. Set the variables above for Production (and Preview).
2. Apply the migrations to the production database:

   ```bash
   DATABASE_URL="<production connection string>" npx prisma migrate deploy
   ```

   A variable set on the command line wins over `.env` (`dotenv` does not
   override it). If the command stalls or fails on Neon's pooled
   connection string, use the direct connection string of the same
   database for this command.
3. Create the permissions and default roles:

   ```bash
   DATABASE_URL="<production connection string>" npm run db:sync-roles
   ```

4. Only for a demo environment, load the demo data (the seed refuses a
   database that already has users). With `NODE_ENV=production` the seed
   refuses to run without `DEMO_PASSWORD`, so the demo accounts never get
   the development fallback password:

   ```bash
   NODE_ENV=production DEMO_PASSWORD="<demo password>" DATABASE_URL="<connection string>" npm run db:seed
   ```

   For real data, create the first national administrator account instead;
   the seed must not run there.
5. Merge to `main` (or promote a deployment in Vercel). Vercel builds and
   deploys.
6. Load the translations (see step 4 of each release).
7. In the FedaPay dashboard, declare the webhook
   `<APP_URL>/api/paiements/fedapay/webhook` and copy its secret into
   `FEDAPAY_WEBHOOK_SECRET`, then redeploy.
8. Run the [post deployment checklist](#post-deployment-checklist).

## Each release

Run in this order. Steps 1 and 2 are safe to run when nothing changed: they
then do nothing.

1. **Migrations**, against the production database, before the merge:

   ```bash
   DATABASE_URL="<production connection string>" npx prisma migrate deploy
   ```

   It applies the pending migrations of `prisma/migrations` and reports
   "No pending migrations to apply" otherwise. Keep migrations additive
   (new tables, new nullable columns) so that the code still running in
   production keeps working between this step and the deployment.
2. **Roles**: adds the permissions, roles and default grants the release
   introduces. Never removes anything, and leaves grants changed in the
   rights matrix as they are.

   ```bash
   DATABASE_URL="<production connection string>" npm run db:sync-roles
   ```

3. **Deploy**: merge the release into `main`. Vercel deploys production
   automatically. Follow the build in the Vercel dashboard until it is
   "Ready".
4. **Translations**, when `prisma/seed-extras/translations.json` changed:

   ```bash
   DATABASE_URL="<production connection string>" npx tsx scripts/load-translations.ts --dry-run
   DATABASE_URL="<production connection string>" npx tsx scripts/load-translations.ts
   ```

   The dry run prints how many rows would be inserted, updated or are
   already up to date; check the counts, then run without `--dry-run`. The
   script is idempotent and never deletes. Pages pick up the new rows at
   their next request.
5. **Reseed, demo environments only.** Destroys every row of every table,
   then reloads the demo data. Never on a database holding real data.

   ```bash
   NODE_ENV=production DEMO_PASSWORD="<demo password>" DATABASE_URL="<demo connection string>" SEED_RESET=true npx tsx prisma/seed.ts
   ```

   After a reseed, run step 4 again only if translations were changed since
   the file the seed loads.
6. Run the [post deployment checklist](#post-deployment-checklist).

## Demo access

The demo accounts of `src/lib/demo/accounts.ts` are public in the
repository, and so is the password the development machines use. Production
therefore never shows the demo panel on `/connexion`: invited reviewers use a
secret sign in page, `https://<domain>/acces/<DEMO_ACCESS_TOKEN>`, which shows
the same sign in page with the demo panel. A wrong token, or an empty
variable, answers the regular 404 page; after ten wrong tokens in fifteen
minutes an address gets 404 even for the right one. The page is dynamic,
`noindex, nofollow`, sends no referrer, and nothing links to it.

1. Generate the two values on your machine, and keep them in a password
   manager, never in the repository, an issue or a chat log:

   ```bash
   openssl rand -hex 32   # DEMO_ACCESS_TOKEN: 64 characters
   openssl rand -base64 18   # a DEMO_PASSWORD candidate: 24 characters
   ```

   The token needs at least 32 characters among letters, digits, `-` and
   `_`; a shorter or malformed one keeps the page closed (the server logs
   why). The password needs 12 to 200 characters.
2. In Vercel, Project Settings, Environment Variables, add
   `DEMO_ACCESS_TOKEN` and `DEMO_PASSWORD` for **Production** only, with
   **Sensitive** checked, then redeploy production.
3. Set the password of the demo accounts already in the production
   database, without reseeding. The script only touches the accounts listed
   in `src/lib/demo/accounts.ts`, by identifier, and skips those already up
   to date:

   ```bash
   DEMO_PASSWORD="<demo password>" DATABASE_URL="<production connection string>" npx tsx scripts/set-demo-password.ts --dry-run
   DEMO_PASSWORD="<demo password>" DATABASE_URL="<production connection string>" npx tsx scripts/set-demo-password.ts --revoke-sessions
   ```

   The dry run prints how many accounts would be updated, are already up to
   date or were not found. `--revoke-sessions` signs out the sessions opened
   with the former public password; later runs need it no more. To keep the
   password out of the shell history, type it at a prompt first
   (`read -rs DEMO_PASSWORD && export DEMO_PASSWORD`) and drop the
   `DEMO_PASSWORD=...` prefix from the commands.
4. Check: `$APP/connexion` shows no "Comptes de démonstration" panel,
   `$APP/acces/<token>` shows it, a wrong token answers 404, and a demo
   account signs in with the new password.
5. Share `https://<domain>/acces/<token>` with the reviewers. The secret
   page prefills the password from `DEMO_PASSWORD`; without that variable it
   lists the identifiers only and the password is sent separately.

To close the access, remove `DEMO_ACCESS_TOKEN` and redeploy; to change it,
set a new value and redeploy (the former address then answers 404). To
change the password, update `DEMO_PASSWORD`, redeploy, and run step 3 again.

## The Python voice function

`api/kora-tts.py` is a Vercel Python function deployed with the Next.js
application. `vercel.json` declares it (90 seconds maximum duration, and the
application files excluded from its bundle). Vercel installs
`requirements.txt` (`piper-tts`) for it during the build: this was confirmed
by the build log of a preview deployment, and by a Siwis clip served by
production on 2026-09-26. The Python version comes from `.python-version`
(3.12).

The voice model (63 MB) is not in the repository: each new instance
downloads it from a pinned revision on its first request (up to a minute),
checks its sha256 and keeps it in `/tmp`. The first read of a new instance
is therefore slow; later ones are not, and every clip is cached in the
database, so a text is synthesised once.

When the function fails or is not reachable, the application keeps working:
`/api/voix` answers `{"voice": null}` for a while and browsers read with
their own voice.

## Rollback

- **Code**: in the Vercel dashboard, open the project's deployments and use
  Instant Rollback on the previous production deployment (or promote it).
  Then revert the merge on `main`, so that the next push does not redeploy
  the faulty code.
- **Database**: Prisma migrations have no down step. The previous code keeps
  working as long as the migration was additive (see step 1). If a
  migration must be undone, write a new migration that reverses it, test it
  on a copy, and apply it with `migrate deploy`. For data loss, restore from
  Neon's point in time restore to a new branch, check it, then point
  `DATABASE_URL` at it.
- **Translations**: the loader never deletes; a wrong row is corrected by
  fixing `translations.json` and loading again.
- **A feature misbehaving**: switch its flag off with a `FeatureFlag` row
  (`src/lib/features.ts` lists the keys) instead of redeploying.

## Post deployment checklist

Replace `$APP` with the public address, for example
`APP=https://classeo.example`.

1. Smoke URLs answer 200 and render: `$APP/`, `$APP/connexion`,
   `$APP/mot-de-passe-oublie`, `$APP/verifier`, `$APP/credits`.

   ```bash
   for p in / /connexion /mot-de-passe-oublie /verifier /credits; do
     printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$APP$p")" "$p"
   done
   ```

2. Sign in works with a real account (or a demo account from the secret
   page on a demo environment), and `/espace` shows the dashboard of its
   role; `/connexion` shows no demo panel. A 500 on
   sign in usually means a migration is missing: run step 1.
3. The French voice is on:

   ```bash
   curl -s "$APP/api/voix"
   ```

   must print `{"voice":"Siwis"}`. `{"voice":null}` means the function is
   not reachable, or failed in the last few minutes: check the function logs.
4. A public clip request returns a WAV. The body is built from the public
   sign in text, the only kind of text a signed out visitor may have read:

   ```bash
   npx tsx -e 'import { PUBLIC_SPEECH } from "./src/features/public-pages/texts"; process.stdout.write(JSON.stringify({ text: PUBLIC_SPEECH.signIn, part: 0 }))' > /tmp/voix.json
   clip=$(curl -s -X POST "$APP/api/voix" -H 'content-type: application/json' --data @/tmp/voix.json | sed -E 's/.*"clip":"([^"]+)".*/\1/')
   curl -s -o /tmp/clip.wav -w '%{http_code} %{content_type}\n' "$APP$clip"
   file /tmp/clip.wav
   ```

   Expected: `200 audio/wav`, and `RIFF (little-endian) data, WAVE audio`.
   The first request of a new instance may take up to a minute.
5. Translations are present: the dry run of step 4 reports every row
   "already up to date", and a parent page switched to Fongbe shows
   Fongbe labels.
6. A PDF verifies: download a report card or an attestation from
   `/espace`, scan its QR code (or type its code at `$APP/verifier`), and
   check the page says "Document authentique". Selecting the downloaded
   file in the comparison box must answer "Fichier identique à
   l'original".
7. On production with FedaPay, the webhook is declared in the dashboard
   (first deployment, or when `APP_URL` changed).
8. Logs: in Vercel, the runtime logs of the deployment show no error for the
   requests above (filter on level error and on `/api/`).

## Outside Vercel

- Build the image with the `Dockerfile` (standalone server) and set
  `FORCE_HTTPS=true` and `TRUST_PROXY=true` behind an HTTPS reverse proxy
  that rewrites `X-Forwarded-For`.
- Run the voice function separately (`python scripts/kora-tts-local.py
  8765` in a virtual environment holding `requirements.txt`, or any host
  running `api/kora-tts.py`), and set `KORA_TTS_URL` and, on both sides, the
  same `KORA_TTS_SECRET`.
- The release order is the same: migrations, roles, then the new image.
