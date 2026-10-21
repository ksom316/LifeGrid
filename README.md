# Life Grid

A private, local-first personal productivity app (projects, tasks with
recurrence, a knowledge vault, focus sessions, daily planning, weekly
reviews). It works fully offline/local-only with no account; signing in
additionally syncs your data through a hosted Neon Postgres database via
Vercel Functions.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4, IndexedDB
  (via `idb`) for local-first storage. Source in `src/`.
- **Hosted API**: Vercel Functions under `api/`, a thin layer over
  `server/repositories/*.ts`. Every protected endpoint requires a valid
  session (`server/http.ts`'s `withAuth`) and scopes every query to
  `user_id` — see `api/ownership.test.ts` for the isolation guarantees this
  is tested against.
- **Auth**: self-hosted email + password (scrypt-hashed, Node's built-in
  `crypto`), opaque session tokens in an httpOnly cookie, hashed before
  storage (`server/auth.ts`). *Why not Neon Auth*: at the time this was
  built, Neon's own auth offering spans several overlapping, partly-beta
  products (a legacy Stack Auth integration, a sync-table-based "Neon Auth,"
  and a newer "Managed Better Auth") with an API surface still in flux and
  no way to provision/verify it without live Neon project credentials this
  environment doesn't have. A minimal, dependency-light, standard
  session-cookie system was the smaller and more verifiable choice for this
  milestone; revisit Neon Auth once its API has settled.
- **Database**: Neon Postgres, accessed via `@neondatabase/serverless`.
  Simple one-shot queries use `Pool.query()` (HTTP-based, no connection held
  open between calls). Anything needing a real transaction or a
  `SELECT ... FOR UPDATE` lock (recurring-task completion, focus-session
  finalization, backup restore) uses `Pool.connect()` for a dedicated,
  session-affine connection instead (`server/db.ts`'s `withTransaction`) —
  `Pool.query()` alone does **not** support sessions/transactions, since each
  call is an independent HTTP request that may land on a different
  connection. Schema in `db/migrations/`.

### Security posture (server/http.ts, server/auth.ts, server/rateLimit.ts)

- **CSRF**: every state-changing request must present an `Origin` header
  matching this deployment's own `Host` (`assertSameOrigin`), on top of the
  session cookie's `SameSite=Lax`. Paired with a Content-Type check
  (`assertJsonContentType`) that rejects anything but `application/json`,
  which a cross-site HTML form cannot send without triggering a CORS
  preflight it can't complete.
- **Brute force**: login and signup are rate-limited per email and per
  source IP, backed by a Postgres table (`db/migrations/0002_rate_limits.sql`)
  rather than in-memory state, since a serverless function instance isn't
  guaranteed to still be warm for the next request.
- **Tenant isolation**: every query is scoped to the authenticated
  `user_id`; foreign-key fields (`projectId`, `taskId`) are validated to
  belong to the requesting user before being accepted; backup/restore
  upserts are guarded against a record id colliding with a *different*
  user's existing row (`server/repositories/backup.ts`'s
  `partitionByForeignConflict` and the `ON CONFLICT ... WHERE` clause in
  `upsertRecord`).
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin` on every response.

## Local development

```bash
npm install
npm run dev        # frontend only, at http://localhost:5173 (no /api routes — see below)
npm test            # full test suite (no live database needed — see Testing)
npm run lint
npm run build
```

`npm run dev` serves only the Vite frontend; it does not run the `/api`
functions. To exercise the hosted API locally, install the Vercel CLI
(`npm i -g vercel`) and run `vercel dev`, which serves both the frontend and
`/api/*.ts` together against whatever `DATABASE_URL` you configure (see
below).

## Hosted setup (Neon + Vercel)

1. **Create a Neon project** at [neon.tech](https://neon.tech) and copy its
   pooled connection string.
2. **Configure environment variables** — copy `.env.example` to `.env.local`
   (for `vercel dev`) and set `DATABASE_URL`. In the Vercel dashboard, set
   the same variable under Project Settings > Environment Variables for
   Production/Preview/Development. **Use a separate Neon database (or at
   minimum a separate Neon branch) for Preview than for Production** — Vercel
   Preview deployments run on every branch/PR with no additional access
   control, so a Preview `DATABASE_URL` pointing at production data would let
   anyone who can open a preview URL reach real user data. Neon's
   branch-per-environment workflow (a cheap copy-on-write branch off your
   production branch) is the natural fit: production `DATABASE_URL` → main
   branch, preview `DATABASE_URL` → a disposable branch, local development →
   either the preview branch or your own throwaway branch.
3. **Run migrations** against that database:
   ```bash
   DATABASE_URL="<your Neon connection string>" npm run db:migrate
   ```
   This applies every file in `db/migrations/` in order, tracked in a
   `_migrations` table, so re-running it is always safe — already-applied
   migrations are skipped.
4. **Deploy**: `vercel --prod` (or connect the repo in the Vercel dashboard
   for git-based deploys). Vercel auto-detects the Vite frontend and the
   `/api` functions; `vercel.json` adds the SPA rewrite so client-side
   routes (e.g. `/projects/abc123`) don't 404 on a hard refresh.
5. **Origins / cookies**: the session cookie is `SameSite=Lax` and scoped to
   whatever origin serves the API, with no separate "allowed redirect URL"
   configuration needed (this is a same-origin app, not an OAuth
   integration) — just make sure the frontend and `/api` are served from the
   same Vercel deployment/domain, which is the default when both are part
   of one project.
6. **Health check**: `GET /api/health` returns `{"status":"ok"}` (200) or
   `{"status":"unavailable"}` (503) based on database connectivity only —
   safe to point an uptime monitor at without authentication.

## Testing

The full suite (`npm test`) needs no live database or credentials:
IndexedDB-backed code is tested against `fake-indexeddb`; the hosted
API/database layer is tested against [`pg-mem`](https://github.com/oguimbal/pg-mem),
an in-memory Postgres emulator that runs the real SQL in
`db/migrations/0001_init.sql` — not a hand-simplified stand-in. See
`api/ownership.test.ts` for cross-user isolation tests and
`server/repositories/tasks.test.ts` for recurring-task completion
idempotency.

`pg-mem` does not simulate real connection-level locking, so it alone
cannot verify true concurrent-request duplicate-prevention for
recurring-task completion or focus-session finalization — only that the
underlying idempotency check is logically correct under repeated sequential
calls. That gap is what the real-PostgreSQL suite below closes.

## Real-PostgreSQL integration tests (`npm run test:neon`)

A second, separate test suite (`server/test/neon/**`) runs against an
**actual** Neon/Postgres database using the real `@neondatabase/serverless`
driver — proving `server/db.ts`'s `withTransaction()` (BEGIN/COMMIT/ROLLBACK
session affinity, connection release on error) and the recurring-task and
focus-session concurrency guarantees under real concurrent requests, which
`pg-mem` cannot simulate. It is **not** part of `npm test` and never runs
automatically — only `npm run test:neon` reaches it, and that script refuses
to do anything until `DATABASE_URL` is explicitly set, printing the target
host/database name before any write so you can confirm it's the database you
intended.

**Setup (uses a disposable Neon branch — never run this against a database
holding real data):**

1. In the Neon console, open your project and create a new branch off your
   main branch (Neon branches are cheap, copy-on-write, and disposable by
   design — this is what makes the suite safe to run). Name it something
   recognizable, e.g. `integration-test-scratch`.
2. Copy that branch's connection string and set it as `DATABASE_URL` in your
   shell for this session only (not `.env.local`, so it can't linger):
   ```bash
   export DATABASE_URL="<the integration-test-scratch branch's connection string>"
   ```
   (PowerShell: `$env:DATABASE_URL = "<connection string>"`.) This repo's
   `.env.example` has no real value in it and nothing here ever logs the
   full string — only the host and database name are ever printed.
3. Apply migrations to that branch (the same command as production setup,
   now pointed at the scratch branch):
   ```bash
   npm run db:migrate
   ```
4. Run the suite:
   ```bash
   npm run test:neon
   ```
   It prints the target host and database name, pauses 3 seconds (so you can
   Ctrl+C if that's not the branch you meant), then runs. Every record it
   creates belongs to a single, uniquely-named test user per test file
   (`server/test/neon/testSetup.ts`'s `createNeonTestUser`); cleanup deletes
   that one user by id, which cascades (via `ON DELETE CASCADE`) to remove
   everything it owned. No table is ever truncated or dropped, and nothing
   outside those test users is ever touched.
5. If a cleanup step ever fails, the test output prints the exact
   `delete from users where id = '...'` statement to run by hand — it will
   also be visible as a thrown error, which fails that test file.
6. When you're done, delete the Neon branch from the console (or leave it —
   it costs nothing meaningful at rest, but deleting it is the simplest way
   to guarantee no scratch data lingers anywhere).
7. Unset `DATABASE_URL` in your shell (`unset DATABASE_URL` /
   `Remove-Item Env:DATABASE_URL`) so a later `npm run db:migrate` or
   anything else doesn't accidentally target it.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
