#!/usr/bin/env bash
# Local verification only. Run on an explicitly authorized Docker build machine.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null
docker compose version >/dev/null
run_id="tmcheck$(date +%s)"
project_a="${run_id}a"
project_b="${run_id}b"
export APP_ORIGIN=https://tasks.example.test
export AUTH_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export POSTGRES_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")"
export SMTP_HOST=smtp.example.test SMTP_PORT=587 SMTP_USER=placeholder SMTP_PASSWORD=placeholder MAIL_FROM=tasks@example.test
cleanup() {
  docker compose -p "$project_a" down --volumes --remove-orphans
  docker compose -p "$project_b" down --volumes --remove-orphans
}
trap cleanup EXIT
npm run check:contract
docker compose config --quiet
docker compose -p "$project_a" build --pull
for project in "$project_a" "$project_b"; do
  docker compose -p "$project" up -d --wait database
  docker compose -p "$project" run --rm web node scripts/migrate.mjs
  docker compose -p "$project" run --rm web node scripts/migrate.mjs
  docker compose -p "$project" up -d --wait web
  docker compose -p "$project" exec -T web node scripts/healthcheck.mjs
  docker compose -p "$project" exec -T web node --input-type=module -e '
    for (const [path,status] of [["/api/health",200],["/login",200],["/api/tasks",401]]) {
      const r=await fetch(`http://127.0.0.1:80${path}`); if(r.status!==status)throw new Error(`Unexpected status for ${path}`);
    }
    const r=await fetch("http://127.0.0.1:80/",{redirect:"manual"});if(r.status!==307)throw new Error("Missing login redirect");
  '
done
docker compose -p "$project_a" exec -T database psql -U app -d app -v ON_ERROR_STOP=1 -c 'CREATE TABLE deployment_probe (value text); INSERT INTO deployment_probe VALUES ($$persisted$$);'
docker compose -p "$project_a" up -d --force-recreate --wait
docker compose -p "$project_a" exec -T web node scripts/healthcheck.mjs
persisted="$(docker compose -p "$project_a" exec -T database psql -U app -d app -Atc 'SELECT value FROM deployment_probe')"
test "$persisted" = persisted
isolated="$(docker compose -p "$project_b" exec -T database psql -U app -d app -Atc "SELECT to_regclass('public.deployment_probe') IS NULL")"
test "$isolated" = t
printf 'Images, internal HTTP routing, repeated migrations, persistence and project isolation verified.\n'
