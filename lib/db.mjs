import pg from 'pg';
const globalDb = globalThis;
export const db =
  globalDb.taskManagerDb ??
  new pg.Pool({
    host: process.env.NODE_ENV === 'test' ? process.env.TEST_DB_HOST || '127.0.0.1' : 'database',
    port: process.env.NODE_ENV === 'test' ? Number(process.env.TEST_DB_PORT || 5432) : 5432,
    user: 'app',
    database: 'app',
    password: process.env.POSTGRES_PASSWORD,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    options: '-c statement_timeout=10000',
  });
globalDb.taskManagerDb = db;
export async function transaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
