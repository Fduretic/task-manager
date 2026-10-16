import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import type { PoolClient } from 'pg';
import { db, transaction } from '../lib/db.mjs';
import { hashPassword } from '../lib/auth';
import { email, password } from '../lib/validation';
// Password is read interactively; never use command-line arguments or saved env files.
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
let hidden = false;
const rl = createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY });
try {
  const address = email.parse(await rl.question('First user email: '));
  const name = (await rl.question('Display name: ')).trim();
  if (!name || name.length > 80) throw new Error('Invalid name');
  process.stdout.write('Password (at least 12 characters, hidden): ');
  hidden = true;
  const secret = password.parse(await rl.question(''));
  hidden = false;
  process.stdout.write('\n');
  const hash = await hashPassword(secret);
  await transaction(async (client: PoolClient) => {
    await client.query('SELECT pg_advisory_xact_lock(816302)');
    const { rows } = await client.query('SELECT count(*)::int AS count FROM users');
    if (rows[0].count !== 0)
      throw new Error('Bootstrap is only available when there are no users.');
    await client.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      address,
      name,
      hash,
    ]);
  });
  console.log('First user created. Sign in and invite your team.');
} catch {
  console.error('Bootstrap failed. Verify inputs, migrations, and that no user exists.');
  process.exitCode = 1;
} finally {
  rl.close();
  await db.end();
}
