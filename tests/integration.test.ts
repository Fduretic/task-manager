import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { setupDatabase } from './database';
let db: typeof import('../lib/db.mjs').db;
let tasks: typeof import('../lib/tasks');
let auth: typeof import('../lib/auth');
let invites: typeof import('../lib/invitations');
let routes: typeof import('../app/api/[...path]/route');
let owner: string, viewer: string, assignee: string, stranger: string;
let taskId: string;
const users = () => [owner, viewer, assignee, stranger];
before(async () => {
  await setupDatabase();
  ({ db } = await import('../lib/db.mjs'));
  tasks = await import('../lib/tasks');
  auth = await import('../lib/auth');
  invites = await import('../lib/invitations');
  routes = await import('../app/api/[...path]/route');
  const { migrate } = await import('../scripts/migrate.mjs');
  await migrate();
  owner = randomUUID();
  viewer = randomUUID();
  assignee = randomUUID();
  stranger = randomUUID();
  const hash = await auth.hashPassword('integration-password-123');
  for (const [index, id] of users().entries())
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      id,
      `${id}@example.test`,
      `Person ${index}`,
      hash,
    ]);
  await db.query('INSERT INTO contacts(user_id,contact_id) VALUES($1,$2),($1,$3)', [
    owner,
    viewer,
    assignee,
  ]);
});
after(async () => {
  if (db) {
    await db.query('DELETE FROM tasks WHERE creator_id=ANY($1::uuid[])', [users()]);
    await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users()]);
    await db.end();
  }
});
async function denied(fn: () => Promise<unknown>, status: number) {
  await assert.rejects(fn, (e: unknown) => (e as { status: number }).status === status);
}
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  userId?: string,
  origin = 'https://tasks.example.test',
) {
  const token = userId ? await auth.createSession(userId) : '';
  return routes.GET(
    new NextRequest(`https://tasks.example.test/api/${path}`, {
      method,
      headers: {
        origin,
        'content-type': 'application/json',
        ...(token ? { cookie: `tm_session=${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: path.split('/') }) },
  );
}
test('initial schema migrates and rerunning preserves existing data', async () => {
  const { migrate } = await import('../scripts/migrate.mjs');
  await migrate();
  const { rows } = await db.query('SELECT id FROM users WHERE id=$1', [owner]);
  assert.equal(rows[0].id, owner);
  const history = await db.query('SELECT * FROM schema_migrations');
  assert.ok(history.rowCount >= 2);
});
test('new tasks are private and self-assigned; hidden tasks return 404', async () => {
  const task = await tasks.createTask(owner, {
    title: 'Private implementation task',
    description: 'Do the work',
  });
  taskId = task.id;
  assert.equal(task.state, 'backlog');
  assert.deepEqual(
    task.members.map((m: { userId: string; role: string }) => [m.userId, m.role]),
    [[owner, 'assignee']],
  );
  assert.equal((await tasks.listTasks(stranger)).length, 0);
  await denied(() => tasks.getTask(taskId, stranger), 404);
  await denied(() => tasks.deleteTask(taskId, stranger), 404);
});
test('sharing grants visibility without edit/work permission and rejects unknown contacts', async () => {
  await denied(
    () => tasks.setMembers(taskId, owner, { members: [{ userId: stranger, role: 'assignee' }] }),
    400,
  );
  await tasks.setMembers(taskId, owner, {
    members: [
      { userId: viewer, role: 'viewer' },
      { userId: assignee, role: 'assignee' },
    ],
  });
  assert.equal((await tasks.listTasks(viewer)).length, 1);
  await denied(() => tasks.updateTask(taskId, viewer, { title: 'Hijacked' }), 403);
  await denied(() => tasks.deleteTask(taskId, viewer), 403);
  await denied(() => tasks.setMembers(taskId, assignee, { members: [] }), 403);
  await denied(() => tasks.setState(taskId, viewer, { state: 'done' }), 403);
  await denied(() => tasks.logEffort(taskId, viewer, { hours: 1 }), 403);
  await denied(() => tasks.setState(taskId, owner, { state: 'done' }), 403);
  await denied(() => tasks.logEffort(taskId, owner, { hours: 1 }), 403);
});
test('assigned users move tasks through workflow and log immutable effort', async () => {
  for (const state of ['ready', 'in_progress', 'done'])
    assert.equal((await tasks.setState(taskId, assignee, { state })).state, state);
  await tasks.logEffort(taskId, assignee, { hours: 1.25, note: 'Implementation' });
  const task = await tasks.logEffort(taskId, assignee, { hours: 0.75, note: 'Review' });
  assert.equal(task.hours, 2);
  assert.equal(task.efforts.length, 2);
  assert.equal(task.efforts[0].name, 'Person 2');
});
test('revoking access immediately removes visibility and workflow access', async () => {
  await tasks.setMembers(taskId, owner, { members: [] });
  assert.equal((await tasks.listTasks(assignee)).length, 0);
  await denied(() => tasks.getTask(taskId, viewer), 404);
  await denied(() => tasks.setState(taskId, assignee, { state: 'ready' }), 404);
  await denied(() => tasks.logEffort(taskId, assignee, { hours: 1 }), 404);
  assert.equal((await tasks.getTask(taskId, owner)).hours, 2);
});
test('API rejects unauthenticated, cross-origin, malformed and permission-escalating requests', async () => {
  assert.equal((await request('tasks')).status, 401);
  assert.equal(
    (await request('tasks', 'POST', { title: 'Cross origin' }, owner, 'https://evil.example'))
      .status,
    403,
  );
  assert.equal(
    (await request('tasks', 'POST', { title: 'Invalid', state: 'done' }, owner)).status,
    400,
  );
  assert.equal((await request(`tasks/${taskId}`, 'GET', undefined, stranger)).status, 404);
  assert.equal(
    (await request(`tasks/${taskId}/state`, 'PATCH', { state: 'done' }, owner)).status,
    403,
  );
});
test('sessions expire, logout revokes them, and login errors do not enumerate accounts', async () => {
  const token = await auth.createSession(owner);
  assert.equal((await auth.sessionUser(token))?.id, owner);
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [
    auth.digest(token),
  ]);
  assert.equal(await auth.sessionUser(token), null);
  const a = await request('auth/login', 'POST', {
    email: `${owner}@example.test`,
    password: 'wrong',
  });
  const b = await request('auth/login', 'POST', {
    email: 'unknown@example.test',
    password: 'wrong',
  });
  assert.equal(a.status, 401);
  assert.deepEqual(await a.json(), await b.json());
  const ok = await request('auth/login', 'POST', {
    email: `${owner}@example.test`,
    password: 'integration-password-123',
  });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
  const session = cookie.split(';')[0];
  const response = await routes.POST(
    new NextRequest('https://tasks.example.test/api/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://tasks.example.test', cookie: session },
    }),
    { params: Promise.resolve({ path: ['auth', 'logout'] }) },
  );
  assert.equal(response.status, 200);
  assert.equal(await auth.sessionUser(session.split('=')[1]), null);
});
test('invitations are expiring single-use links; acceptance never shares existing tasks', async () => {
  const token = randomBytes(32).toString('hex'),
    newEmail = `${randomUUID()}@example.test`;
  await db.query(
    "INSERT INTO invitations(id,inviter_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",
    [randomUUID(), owner, newEmail, auth.digest(token)],
  );
  assert.equal((await invites.inspectInvite({ token })).existing, false);
  const user = await invites.acceptInvite(
    { token, name: 'New teammate', password: 'a-new-user-password' },
    null,
  );
  assert.equal((await tasks.listTasks(user.id)).length, 0);
  assert.ok((await tasks.listPeople(owner)).some((p: { id: string }) => p.id === user.id));
  await denied(
    () => invites.acceptInvite({ token, name: 'Replay', password: 'a-new-user-password' }, null),
    400,
  );
  await db.query('DELETE FROM users WHERE id=$1', [user.id]);
  const expired = randomBytes(32).toString('hex');
  await db.query(
    "INSERT INTO invitations(id,inviter_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()-interval '1 minute')",
    [randomUUID(), owner, newEmail, auth.digest(expired)],
  );
  await denied(() => invites.inspectInvite({ token: expired }), 400);
});
test('existing accounts require their own session to accept invitations', async () => {
  const token = randomBytes(32).toString('hex');
  await db.query(
    "INSERT INTO invitations(id,inviter_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",
    [randomUUID(), owner, `${stranger}@example.test`, auth.digest(token)],
  );
  await denied(() => invites.acceptInvite({ token }, null), 401);
  await denied(
    () =>
      invites.acceptInvite(
        { token },
        { id: viewer, name: 'Viewer', email: `${viewer}@example.test` },
      ),
    401,
  );
  const user = await invites.acceptInvite(
    { token },
    { id: stranger, name: 'Stranger', email: `${stranger}@example.test` },
  );
  assert.equal(user.id, stranger);
});
test('creator can edit/delete; deletion cascades effort and membership', async () => {
  assert.equal(
    (await tasks.updateTask(taskId, owner, { title: "Updated '); DROP TABLE users; --" })).title,
    "Updated '); DROP TABLE users; --",
  );
  await tasks.deleteTask(taskId, owner);
  await denied(() => tasks.getTask(taskId, owner), 404);
  assert.equal((await db.query('SELECT * FROM efforts WHERE task_id=$1', [taskId])).rowCount, 0);
});
test('database-backed throttling enforces the limit', async () => {
  const key = randomUUID();
  await auth.rateLimit(key, 2);
  await auth.rateLimit(key, 2);
  await denied(() => auth.rateLimit(key, 2), 429);
});
test('failed email delivery removes the unusable invitation', async () => {
  delete process.env.SMTP_HOST;
  const email = `${randomUUID()}@example.test`;
  await denied(
    () => invites.invite({ id: owner, name: 'Owner', email: `${owner}@example.test` }, { email }),
    503,
  );
  assert.equal((await db.query('SELECT * FROM invitations WHERE email=$1', [email])).rowCount, 0);
});
test('readiness checks configuration and the migrated database', async () => {
  const health = await import('../app/api/health/route');
  const previous = { ...process.env };
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'placeholder',
    SMTP_PASSWORD: 'placeholder',
    MAIL_FROM: 'tasks@example.test',
    POSTGRES_PASSWORD: 'placeholder',
  });
  assert.equal((await health.GET()).status, 200);
  delete process.env.AUTH_SECRET;
  assert.equal((await health.GET()).status, 503);
  Object.assign(process.env, previous);
});

test('a later migration applies over populated initial schema without changing data', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { migrate } = await import('../scripts/migrate.mjs');
  const schema = `upgrade_${randomUUID().replaceAll('-', '')}`;
  // Generated identifier only; this suite must target a disposable database.
  await db.query(`CREATE SCHEMA ${schema}`);
  await db.query(`SET search_path TO ${schema}`);
  try {
    const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
    await db.query(sql);
    await db.query(
      'CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
      '001_initial.sql',
      createHash('sha256').update(sql).digest('hex'),
    ]);
    const id = randomUUID();
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      id,
      'upgrade@example.test',
      'Preserved user',
      'unused-test-hash',
    ]);
    await migrate();
    assert.equal(
      (await db.query('SELECT name FROM users WHERE id=$1', [id])).rows[0].name,
      'Preserved user',
    );
    assert.equal((await db.query('SELECT name FROM schema_migrations')).rows.length, 2);
    await migrate();
    assert.equal((await db.query('SELECT id FROM users')).rows.length, 1);
  } finally {
    await db.query('SET search_path TO public');
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
});
