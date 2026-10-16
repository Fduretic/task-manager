import { PGlite } from '@electric-sql/pglite';
// Executes PostgreSQL in-process. Set TEST_DATABASE=postgres to use a disposable real service instead.
export async function setupDatabase() {
  Object.assign(process.env, { NODE_ENV: 'test' });
  process.env.AUTH_SECRET = 'integration-only-auth-secret-at-least-32-characters';
  process.env.APP_ORIGIN = 'https://tasks.example.test';
  if (process.env.TEST_DATABASE === 'postgres') return null;
  const engine = new PGlite();
  const query = async (sql: string, args: unknown[] = []) => {
    const result = args.length ? await engine.query(sql, args) : (await engine.exec(sql)).at(-1)!;
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  const adapter = {
    query,
    connect: async () => ({ query, release() {} }),
    end: async () => engine.close(),
  };
  (globalThis as unknown as { taskManagerDb: unknown }).taskManagerDb = adapter;
  return engine;
}
