import test from 'node:test';
import assert from 'node:assert/strict';
import { canView, canManage, canWork } from '../lib/tasks';
import { taskInput, effortInput, membersInput, password, joinInput } from '../lib/validation';
import { hashPassword, verifyPassword, digest, checkOrigin } from '../lib/auth';
process.env.AUTH_SECRET = 'test-only-auth-secret-with-at-least-32-characters';
process.env.APP_ORIGIN = 'https://tasks.example.test';
test('creators manage tasks, but assignment alone controls workflow and effort', () => {
  for (const owner of [true, false])
    for (const role of [null, 'viewer', 'assignee'] as const) {
      assert.equal(canView(owner, role), owner || role !== null);
      assert.equal(canManage(owner), owner);
      assert.equal(canWork(role), role === 'assignee');
    }
});
test('task input rejects extra fields, whitespace titles, and invalid dates', () => {
  assert.equal(taskInput.parse({ title: ' A task ' }).title, 'A task');
  for (const input of [
    { title: ' ' },
    { title: 'a', state: 'done' },
    { title: 'a', creator_id: 'other' },
    { title: 'a', dueDate: '2026-02-30' },
  ])
    assert.equal(taskInput.safeParse(input).success, false);
  assert.equal(taskInput.safeParse({ title: 'a', dueDate: '2028-02-29' }).success, true);
});
test('effort requires finite positive hours, at most 24 per entry, two decimals', () => {
  for (const hours of [0, -1, 24.01, Infinity, NaN, 1.001, '1'])
    assert.equal(effortInput.safeParse({ hours }).success, false);
  for (const hours of [0.01, 1.5, 24]) assert.equal(effortInput.safeParse({ hours }).success, true);
});
test('membership rejects duplicate people and role escalation', () => {
  const id = '879459a6-a003-4257-899f-30f06d03a862';
  assert.equal(membersInput.safeParse({ members: [{ userId: id, role: 'owner' }] }).success, false);
  assert.equal(
    membersInput.safeParse({
      members: [
        { userId: id, role: 'viewer' },
        { userId: id, role: 'assignee' },
      ],
    }).success,
    false,
  );
});
test('passwords are salted and verifiable; token digests depend on AUTH_SECRET', async () => {
  assert.equal(password.safeParse('short').success, false);
  const a = await hashPassword('a-long-test-password'),
    b = await hashPassword('a-long-test-password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('a-long-test-password', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
  assert.notEqual(digest('token-one'), digest('token-two'));
  assert.equal(joinInput.safeParse({ token: 'invalid' }).success, false);
});
test('mutations require exact configured origin', () => {
  checkOrigin('https://tasks.example.test');
  for (const origin of [null, 'https://evil.example', 'https://tasks.example.test.evil.example'])
    assert.throws(() => checkOrigin(origin));
});
