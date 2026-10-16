import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
const compose = parse(readFileSync('compose.yaml', 'utf8'));
const manifest = parse(readFileSync('vps-admin.yaml', 'utf8'));
const allowedTop = ['services', 'volumes', 'name', 'version'];
const allowedService = [
  'image',
  'build',
  'command',
  'entrypoint',
  'working_dir',
  'environment',
  'depends_on',
  'healthcheck',
  'restart',
  'init',
  'read_only',
  'tmpfs',
  'user',
  'volumes',
  'stop_grace_period',
  'expose',
];
for (const key of Object.keys(compose))
  assert.ok(allowedTop.includes(key), `Forbidden Compose key ${key}`);
assert.deepEqual(Object.keys(compose.services).sort(), ['database', 'web']);
for (const [name, raw] of Object.entries(compose.services)) {
  const service = raw as Record<string, any>;
  for (const key of Object.keys(service))
    assert.ok(allowedService.includes(key), `Forbidden service key ${name}.${key}`);
  assert.ok(service.image || service.build);
  assert.ok(service.healthcheck?.test?.length);
  for (const value of Object.values(service.environment || {}))
    assert.match(String(value), /^\$\{[A-Z_]+(?::-[^}]*)?\}$/);
  if (service.build) {
    assert.equal(service.build.context, '.');
    assert.equal(service.build.dockerfile, 'Dockerfile');
    assert.deepEqual(Object.keys(service.build).sort(), ['context', 'dockerfile']);
  }
  for (const volume of service.volumes || []) {
    assert.equal(volume, 'database_data:/var/lib/postgresql/data');
    assert.ok(compose.volumes.database_data !== undefined);
  }
}
assert.equal(compose.volumes.database_data, null);
assert.match(compose.services.database.image, /^postgres:\d+\.\d+-alpine\d+\.\d+$/);
assert.deepEqual(manifest.public, { service: 'web', port: 80 });
assert.equal(manifest.routing.pathPrefix, false);
assert.deepEqual(manifest.database, {
  service: 'database',
  name: 'app',
  user: 'app',
  passwordEnv: 'POSTGRES_PASSWORD',
});
assert.deepEqual(manifest.migration, { service: 'web', command: ['node', 'scripts/migrate.mjs'] });
assert.deepEqual(manifest.storage, []);
assert.deepEqual(manifest.schedules, []);
const expected = [
  'APP_ORIGIN',
  'AUTH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
  'POSTGRES_PASSWORD',
];
assert.deepEqual(manifest.environment.map((e: { key: string }) => e.key).sort(), expected.sort());
for (const e of manifest.environment) {
  assert.equal(e.phase, 'runtime');
  assert.equal(e.required, true);
  assert.equal(compose.services.web.environment[e.key], `\${${e.key}}`);
  assert.equal(e.secret, ['AUTH_SECRET', 'SMTP_PASSWORD', 'POSTGRES_PASSWORD'].includes(e.key));
}
const dockerfile = readFileSync('Dockerfile', 'utf8');
assert.match(dockerfile, /USER node/);
assert.match(dockerfile, /0.0.0.0/);
assert.match(dockerfile, /scripts\/healthcheck.mjs/);
assert.doesNotMatch(dockerfile, /ARG.*(?:SECRET|PASSWORD)/);
assert.deepEqual(
  Object.keys(manifest).sort(),
  [
    'version',
    'compose',
    'public',
    'routing',
    'services',
    'technologies',
    'environment',
    'storage',
    'database',
    'migration',
    'schedules',
  ].sort(),
);
console.log(
  'Compose and manifest satisfy the supplied static deployment contract. Runtime verification is separate.',
);
