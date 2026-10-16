import { db } from '@/lib/db.mjs';
import { validateRuntime } from '@/lib/config';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    validateRuntime();
    await db.query('SELECT 1 FROM schema_migrations LIMIT 1');
    await db.query('SELECT id FROM users LIMIT 0');
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
