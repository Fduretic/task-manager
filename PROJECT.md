# Task Manager / Taskline

The workspace was empty when implementation began: the referenced PROJECT.md and DEPLOYMENT.md were not supplied. This document records the supplied brief and implementation decisions; it does not grant permission to push, deploy, access secrets, or run operational scripts.

## Requirements and architecture

Build a professional, minimal task manager for small developer teams. Use Next.js for the frontend and backend, PostgreSQL for persistence, and a private board with deliberate sharing. Email/password authentication is invitation-only. No public registration, MFA, email verification, password reset, uploads, persistent file storage, workers, or schedules.

There is one public service, `web:80`, and one private `database:5432` service. VPS Admin owns HTTPS, routing, isolation, database backups, and restoration. Root-domain hosting only. No architecture incompatibility was identified. Actual compliance with the 768 MB / 2 CPU / 256 PID per-service limits requires runtime measurement on the build machine; no load benchmark was possible here. Node's runtime heap is capped at 512 MB and the connection pool at eight connections.

No local skills were selected or present. The user's instruction to keep work in this directory and the explicit Next.js/PostgreSQL/VPS Admin contract govern implementation. No external website-building or hosting workflow was used.

## Product decisions

- Brand: Taskline, with the requested `#0f3040`, `#464858`, `#a56f63`, and `#d99b7f` palette, neutral surfaces, responsive sidebar, and four-column board.
- A new task is private, in Backlog, and assigned to its creator. Creators can remove their own assignment while retaining ownership.
- Workflow: Backlog → Ready → In progress → Done. Assignees may move in either direction, including reopening completed tasks. Transitions use an explicit selector for keyboard and touch access.
- Only the creator edits task details, deletes a task, or changes sharing/assignment. Only current assignees change state or log effort, including when the actor is the creator.
- Sharing and assignment are explicit per person. An assignee can also read the task. A viewer can only read. Invite acceptance establishes a collaborator relationship; it does not share tasks.
- Effort is an append-only record attributed to the signed-in user, with a positive number of hours, two decimals, and at most 24 hours per entry. Multiple entries are permitted. Historical effort remains when access is revoked. Deleting a task removes its effort records.
- Fields: title, description, priority, due date, state, creator, members, effort entries. Search and filters operate only on visible tasks.
- Any signed-in user can invite a collaborator. Invitations expire after seven days and are single-use. Existing accounts must sign in with the invited email to accept; new users set their name and password.
- First account: explicit interactive `npm run bootstrap`, available only when no users exist. No default credentials, setup web route, or automatic seeding.

## Implementation standards

- Pinned dependencies and a committed npm lockfile. Next.js App Router, React, TypeScript strict mode, plain CSS, Node.js runtime, parameterized `pg` queries, and Zod input validation.
- SQL migrations are versioned, additive, transactional, checksummed, and protected by a PostgreSQL advisory lock. Applied migration files must never be edited. Add a new migration for subsequent changes.
- Task mutation transactions lock the task before checking permissions and changing data. Reads incorporate access predicates directly in SQL. Inaccessible task identifiers return 404.
- Passwords use salted scrypt (N=32768, r=8, p=3, 64 MB memory ceiling). Sessions and invitations use 256-bit random tokens; only HMAC digests keyed by AUTH_SECRET are stored. Sessions expire in seven days and logout deletes the server session.
- Cookie: HttpOnly, SameSite=Lax, Secure on HTTPS, root path. Exact APP_ORIGIN checks protect mutations. JSON bodies have a 32 KB limit, strict schemas, and bounded strings. Database rate limits protect login, invite acceptance, and email sending.
- No user HTML rendering, dynamic SQL identifiers, upload endpoints, file paths from users, or third-party frontend scripts/fonts. User-facing errors do not expose SQL, credentials, token values, or stack traces.
- Security headers include CSP, anti-framing, nosniff, referrer suppression, restricted permissions, and HSTS. CSP permits inline scripts/styles for Next.js hydration; it does not claim nonce-based protection. Development additionally permits eval for tooling.
- Browser APIs use relative `/api` URLs. APP_ORIGIN is used for invitation URLs and origin checking, never baked into frontend assets. Invitation tokens use URL fragments to keep them out of HTTP access logs.
- SMTP sends during the request with timeouts and TLS/STARTTLS required. Delivery failure removes the invitation and returns a recoverable error. There is no worker or queue; users can retry. Provider delivery is not guaranteed by SMTP acceptance.

## Verification

See VALIDATION.md for checks actually executed and DEPLOYMENT.md for remaining deployment verification. Tests cover business rules, access control, SQL migrations, authentication, invitations, and browser flows. Embedded PostgreSQL tests complement, and do not replace, container PostgreSQL verification.

## Reference checks

The implementation used the [Next.js installation documentation](https://nextjs.org/docs/app/getting-started/installation) and [support policy](https://nextjs.org/support-policy) to select the supported Next.js 16 line. Pinned image tags were checked against the official [Node image catalog](https://github.com/docker-library/official-images/blob/master/library/node) and [PostgreSQL image catalog](https://github.com/docker-library/official-images/blob/master/library/postgres). The supplied [Color Hunt palette](https://colorhunt.co/palette/0f3040464858a56f63d99b7f) could not be retrieved; its four color values were taken directly from the supplied URL.
