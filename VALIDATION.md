# Validation record

Executed in the supplied workspace on 2026-10-16. No deployment, remote repository creation, push, or commit was performed. The original workspace contained no project/deployment files or application code.

## Passed

- Dependency installation with exact versions and npm lockfile; install audit reported zero vulnerabilities across the installed dependency set.
- `npm run build`: optimized production Next.js build completed, including route generation and TypeScript validation.
- `npm run typecheck`: strict TypeScript check passed.
- `npm run format:check`: source formatting check passed.
- `npm test`: 6 unit tests passed, covering the permission matrix, strict input validation, dates, effort precision/range, duplicate membership, password hashing, token digests, and request-origin enforcement.
- `npm run test:integration`: 14 tests passed against in-process PostgreSQL (PGlite). Tests execute the actual SQL migrations, application services, and Next.js route handlers. Coverage: default privacy, creator/assignee/viewer rules, unknown collaborators, revoked access, workflow, attributed effort, unauthorized API requests, sessions, login/logout, single-use and expired invitations, existing-account invitation authorization, parameterized SQL handling, cascade deletion, rate limits, failed SMTP cleanup, and readiness configuration.
- Migration coverage includes both migrations on an empty schema, rerunning migrations on an existing schema, and applying the later migration over a populated initial schema while preserving data. Migration checksums and history remain in use. This is embedded-engine verification, not verification against the pinned PostgreSQL container.
- `npm run check:contract`: static Compose/manifest validation passed, checking allowed keys, the selected service names, pinned PostgreSQL tag, runtime variable mappings, secret flags, no unexpected manifest properties, the project-scoped volume, migration command, and web:80 entrypoint.
- `bash -n scripts/verify-deployment.sh`: shell syntax passed. The script was not executed against Docker.
- `npm run start`: production HTTP server started at `0.0.0.0:3000` for host-level checks. Actual HTTP responses: `/login` 200; `/join` 200; `/` 307 to `/login`; anonymous `/api/tasks` 401; `/api/health` 503 without installation configuration/database. Login HTML and CSP, nosniff, anti-framing, referrer-policy, and HSTS headers were checked. These were host-level HTTP checks, not in-container port-80 checks.

## Blocked or not executed

- `docker build -t task-manager:verification .` failed before building because access to `/var/run/docker.sock` is denied by the environment. No production image was built or started.
- Installed `docker-compose` is version 1.25.0; it rejects the current Compose-spec file. Docker Compose v2 is absent. The repository's static validator passed, but actual Compose v2 and VPS Admin validation remain pending.
- A disposable local PostgreSQL 12 cluster was initialized under ignored `.local/` using the system binary. Startup failed because both local TCP and Unix socket creation are prohibited in that execution context. It was never used as a substitute for the specified PostgreSQL 17 container.
- The anonymous Playwright desktop/mobile tests were attempted but could not launch: Chromium was not installed. A workspace-local browser install was then attempted; Playwright reported that its Chromium build does not support this host's Ubuntu 20.04. The system Snap Chromium also cannot start under the available capabilities. No browser test or screenshot inspection is claimed as passed.
- Authenticated desktop/mobile CRUD/workflow/effort browser tests are supplied but have not executed. They require a supported browser, a running disposable installation, and a dedicated invited test account.
- Actual invitation email delivery, provider TLS/STARTTLS negotiation, HTTPS-domain routing, in-image readiness, PostgreSQL container migrations, volume persistence after recreation, isolation across two Compose projects, backup/restore, and resource measurements remain unverified.
- No persistent uploads, workers, or schedules were selected, so their checks are not applicable.

## Required before release

Use the exact eight environment keys and deployment sequence in DEPLOYMENT.md. Run the supplied deployment verification script on an authorized Docker Compose v2 build machine, run the browser tests, exercise real invitation delivery with controlled recipients, and measure each running service against the 768 MB RAM / 2 CPU / 256 PID limit. Do not call this deployment-validated until those checks pass.
