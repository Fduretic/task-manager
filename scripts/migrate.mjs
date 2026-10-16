import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/db.mjs';
export async function migrate() {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(816301)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
    for (const name of (await readdir(dir)).filter((n) => /^\d+_[a-z0-9_]+\.sql$/.test(n)).sort()) {
      const sql = await readFile(`${dir}/${name}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const old = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [
        name,
      ]);
      if (old.rowCount) {
        if (old.rows[0].checksum !== checksum)
          throw new Error('Previously applied migration was modified');
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(816301)');
    client.release();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await migrate();
  } catch {
    console.error('Migration failed. Check database connectivity and migration history.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
