# Taskline — Task Manager

A private-by-default task board for small developer teams, built with Next.js and PostgreSQL. Includes invitation-only email/password accounts, four workflow states, explicit sharing and assignment, priority/due dates, search, and attributed effort logs.

- [Product and implementation decisions](PROJECT.md)
- [VPS Admin deployment and required environment](DEPLOYMENT.md)
- [Executed validation and remaining checks](VALIDATION.md)

```sh
npm ci
npm test
npm run test:integration
npm run typecheck
npm run check:contract
npm run build
```

Tests run in-process without a running database by default. Production requires the eight runtime keys in `.env.example`, the PostgreSQL service, and `npm run migrate`. Create the first user with the interactive `npm run bootstrap` command after migrations. Further users join through email invitations.

For local development, use `npm run dev` with APP_ORIGIN matching the local URL and a PostgreSQL service reachable as `database:5432`. The production Compose file has no host ports because VPS Admin owns routing; consult DEPLOYMENT.md for authorized runtime verification.
