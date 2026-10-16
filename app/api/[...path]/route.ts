import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db.mjs';
import {
  COOKIE,
  sessionUser,
  createSession,
  verifyPassword,
  hashPassword,
  digest,
  checkOrigin,
  rateLimit,
  appOrigin,
} from '@/lib/auth';
import { HttpError, requireRule } from '@/lib/errors';
import { loginInput } from '@/lib/validation';
import * as tasks from '@/lib/tasks';
import { invite, inspectInvite, acceptInvite } from '@/lib/invitations';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const dummyHash = hashPassword('unusable-dummy-password-for-timing');
async function body(req: NextRequest) {
  requireRule(
    req.headers.get('content-type')?.startsWith('application/json'),
    415,
    'Send JSON data.',
  );
  const reader = req.body?.getReader();
  requireRule(reader, 400, 'Request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function withCookie(data: unknown, token: string) {
  const response = json(data);
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: new URL(appOrigin()).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400,
  });
  return response;
}
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const route = path.join('/');
    const method = req.method;
    if (method !== 'GET') checkOrigin(req.headers.get('origin'));
    const cookie = req.cookies.get(COOKIE)?.value;
    if (route === 'auth/login' && method === 'POST') {
      const input = loginInput.parse(await body(req));
      await rateLimit('login:global', 300);
      await rateLimit(`login:${input.email}`, 10);
      const { rows } = await db.query(
        'SELECT id,name,email,password_hash FROM users WHERE email=$1',
        [input.email],
      );
      const valid = await verifyPassword(
        input.password,
        rows[0]?.password_hash ?? (await dummyHash),
      );
      requireRule(rows[0] && valid, 401, 'Email or password is incorrect.');
      const { password_hash: _, ...user } = rows[0];
      return withCookie({ user }, await createSession(user.id));
    }
    const user = await sessionUser(cookie);
    if (route === 'auth/invitation' && method === 'POST') {
      await rateLimit('invitation:inspect', 300);
      return json(await inspectInvite(await body(req)));
    }
    if (route === 'auth/join' && method === 'POST') {
      await rateLimit('invitation:accept', 60);
      const joined = await acceptInvite(await body(req), user);
      return withCookie({ user: joined }, await createSession(joined.id));
    }
    requireRule(user, 401, 'Please sign in.');
    if (route === 'auth/me' && method === 'GET') return json({ user });
    if (route === 'auth/logout' && method === 'POST') {
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(cookie!)]);
      const response = json({ ok: true });
      response.cookies.set(COOKIE, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: new URL(appOrigin()).protocol === 'https:',
        sameSite: 'lax',
      });
      return response;
    }
    if (route === 'people' && method === 'GET')
      return json({ people: await tasks.listPeople(user.id) });
    if (route === 'invitations' && method === 'POST') {
      await rateLimit(`invite:${user.id}`, 10, 3600);
      return json(await invite(user, await body(req)), 201);
    }
    if (route === 'tasks' && method === 'GET')
      return json({ tasks: await tasks.listTasks(user.id) });
    if (route === 'tasks' && method === 'POST')
      return json({ task: await tasks.createTask(user.id, await body(req)) }, 201);
    if (path[0] === 'tasks' && path.length >= 2) {
      const id = path[1];
      if (path.length === 2 && method === 'GET')
        return json({ task: await tasks.getTask(id, user.id) });
      if (path.length === 2 && method === 'PATCH')
        return json({ task: await tasks.updateTask(id, user.id, await body(req)) });
      if (path.length === 2 && method === 'DELETE') {
        await tasks.deleteTask(id, user.id);
        return json({ ok: true });
      }
      if (path.length === 3 && method === 'PATCH' && path[2] === 'members')
        return json({ task: await tasks.setMembers(id, user.id, await body(req)) });
      if (path.length === 3 && method === 'PATCH' && path[2] === 'state')
        return json({ task: await tasks.setState(id, user.id, await body(req)) });
      if (path.length === 3 && method === 'POST' && path[2] === 'efforts')
        return json({ task: await tasks.logEffort(id, user.id, await body(req)) }, 201);
    }
    throw new HttpError(404, 'Endpoint not found.');
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues.map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`).join(' '),
        },
        400,
      );
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    // Never log database parameters, cookies, credentials, or invitation tokens.
    console.error('API request failed', {
      method: req.method,
      kind: error instanceof Error ? error.name : 'UnknownError',
    });
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
