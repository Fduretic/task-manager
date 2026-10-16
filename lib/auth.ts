import { randomBytes, createHmac, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { db } from './db.mjs';
import { requireRule } from './errors';

const passwordCost = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function scrypt(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    rawScrypt(value, salt, 64, passwordCost, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export type User = { id: string; name: string; email: string };
export const COOKIE = 'tm_session';
export function digest(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('AUTH_SECRET must contain at least 32 characters');
  return createHmac('sha256', secret).update(value).digest('hex');
}
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(value, salt);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(value: string, stored: string) {
  const [algorithm, salt, hex] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !hex || hex.length !== 128) return false;
  const hash = await scrypt(value, salt);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
export async function sessionUser(token?: string): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await db.query(
    'SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [digest(token)],
  );
  return rows[0] ?? null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [digest(token), userId],
  );
  return token;
}
export function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('Production APP_ORIGIN must use HTTPS');
  return url.origin;
}
export function checkOrigin(origin: string | null) {
  requireRule(origin === appOrigin(), 403, 'This request did not come from this application.');
}
export async function rateLimit(key: string, max: number, seconds = 900) {
  await db.query('DELETE FROM rate_limits WHERE reset_at < now()');
  const { rows } = await db.query(
    `INSERT INTO rate_limits(key,attempts,reset_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1 RETURNING attempts`,
    [digest(key), seconds],
  );
  requireRule(rows[0].attempts <= max, 429, 'Too many attempts. Please try again later.');
}
