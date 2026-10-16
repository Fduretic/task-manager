# VPS Admin deployment

This is a deployment handoff, not a statement that deployment was performed. No repository was created, committed, pushed, or deployed. Those actions require explicit build-workflow authorization. The supplied repository destination is `Fduretic/task-manager`, private, branch `main`; never force push.

## Components

- `web`: Next.js 16.4.2 production image, Node.js 22.23.3 Alpine 3.23, non-root user, `0.0.0.0:80`.
- `database`: PostgreSQL 17.11 Alpine 3.23, database `app`, user `app`, private hostname `database:5432`.
- Project-scoped `database_data` volume mounted at `/var/lib/postgresql/data`. No uploads, external volumes, workers, or schedules.
- Readiness: `GET /api/health` checks required configuration, database connectivity, and the migrated schema. It returns 503 until these are available. The final image includes Node and `scripts/healthcheck.mjs`; no curl dependency is required.
- Runtime migration: `node scripts/migrate.mjs`, declared in `vps-admin.yaml`. Source migrations and runtime dependencies are copied into the final image. Repeated execution verifies checksums and only applies unapplied migrations.

## Required installation values

Fill these exact keys in VPS Admin's runtime configuration; do not commit real values or pass secrets as build arguments:

| Key                 | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `APP_ORIGIN`        | Public HTTPS origin, such as `https://tasks.example.com`; not the VPS Admin URL and no path prefix |
| `AUTH_SECRET`       | Stable, randomly generated secret of at least 32 characters                                        |
| `SMTP_HOST`         | SMTP provider hostname                                                                             |
| `SMTP_PORT`         | Provider's port: 465 for TLS or a STARTTLS-capable port such as 587                                |
| `SMTP_USER`         | SMTP username                                                                                      |
| `SMTP_PASSWORD`     | SMTP credential/app password                                                                       |
| `MAIL_FROM`         | Provider-approved sender address                                                                   |
| `POSTGRES_PASSWORD` | Unique installation database password                                                              |

AUTH_SECRET, SMTP_PASSWORD, and POSTGRES_PASSWORD are secrets. Use the build machine or platform's secret manager to generate and store them. Keep AUTH_SECRET stable; changing it invalidates sessions and outstanding invitations. Coordinate any PostgreSQL password change with the actual database role; changing an environment value alone does not change an existing role's password.

Compose uses defaults for internal constants NODE_ENV=production, PORT=80, POSTGRES_USER=app, POSTGRES_DB=app and NODE_OPTIONS=--max-old-space-size=512. These are not additional installation choices; do not override them. No public build variables are needed. The application connects with separate pg connection fields, so PostgreSQL passwords are not manually URL-encoded.

## Authorized deployment sequence

1. Supply the eight runtime values through VPS Admin. Use Docker Compose v2 on the build machine.
2. Build the production image and validate Compose and the manifest. `npm ci` and `npm run check:contract` provide the repository's static checks; they do not substitute for VPS Admin's own validation.
3. Start the database and wait for its healthcheck. Run the manifest migration command using the web image and its runtime environment before waiting for web readiness.
4. Start web. VPS Admin connects the installation's HTTPS domain to web port 80. Verify `/api/health`, `/login`, and unauthenticated `/api/tasks` (401) through the domain and from inside the image.
5. On the first installation only, run `docker compose exec web npm run bootstrap` interactively on the authorized machine. It prompts for email, display name, and a hidden password; it refuses to run once a user exists. Avoid command-line passwords and terminal recording.
6. Sign in, invite a controlled test email address, accept the invitation, share and assign a task, move it through the workflow, and log effort. Check that a third user cannot see it, and that viewers cannot change state or effort. Test a creator who is no longer assigned.
7. Confirm recreation persistence and isolation between two separate Compose project names. Complete all unresolved checks in VALIDATION.md before release.

VPS Admin owns routing and isolation. The production Compose file deliberately declares no host ports, custom networks, labels, host mounts, Docker socket, or external volumes. Do not add these to solve local preview limitations. Backups and restores cover PostgreSQL only.

## Automated verification on an authorized Docker machine

Run `bash scripts/verify-deployment.sh`. The script creates two uniquely named disposable Compose projects, generates ephemeral test credentials, builds the image, starts services, runs migrations twice, checks HTTP routes from inside the web image, recreates services, verifies persisted database data, checks cross-project data isolation, and cleans up only those two projects and their test volumes. SMTP values are placeholders; this script does not send mail or validate actual SMTP delivery. It needs Docker Compose v2 with `--wait` support. It does not push or publish anything.

Run `npm test`, `npm run test:integration`, `npm run typecheck`, and `npm run build`. Integration tests use in-process PostgreSQL by default. To run the same tests against a disposable PostgreSQL service, use `NODE_ENV=test TEST_DATABASE=postgres TEST_DB_HOST=<test-host> TEST_DB_PORT=<test-port> POSTGRES_PASSWORD=<test-password> npm run test:integration` with database/user `app`. These test-only host settings are ignored outside NODE_ENV=test and are not deployment variables. Never target an installation containing real user data.

For browser tests, install Playwright Chromium on the build machine with `npx playwright install chromium`, point `E2E_BASE_URL` at a disposable app, and supply `E2E_EMAIL` and `E2E_PASSWORD` through the machine's environment for a dedicated invited account. Run `npm run test:e2e`. The authenticated test creates and deletes its own task. Test credentials are not part of the application manifest. Verify email invitation delivery manually with a controlled recipient before release.

## Resources and upgrade procedure

No known architecture conflict requires approval. Runtime resource usage under 768 MB RAM, 2 CPUs, and 256 PIDs remains unmeasured. The web pool is limited to eight connections and its heap to 512 MB; PostgreSQL uses the image defaults. Check memory, total RSS, startup, and expected team concurrency on the target platform. Build-time dependencies are larger than the final runtime set; build RAM was not measured.

Before an upgrade, take a platform database backup, build the new image, run pending migrations, then roll out web. Never reset the database or use schema synchronization. Applied migrations are immutable. For incompatible future schema changes, plan backup/restore and application rollback together; rolling back the image does not reverse a migration.
