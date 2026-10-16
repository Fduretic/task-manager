import { randomBytes, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { PoolClient } from 'pg';
import { db, transaction } from './db.mjs';
import { appOrigin, digest, hashPassword, type User } from './auth';
import { requireRule } from './errors';
import { invitationInput, joinInput, tokenInput } from './validation';
export async function invite(inviter: User, input: unknown) {
  const { email } = invitationInput.parse(input);
  requireRule(email !== inviter.email, 400, 'You are already part of your workspace.');
  const token = randomBytes(32).toString('hex');
  const id = randomUUID();
  await db.query(
    "INSERT INTO invitations(id,inviter_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')",
    [id, inviter.id, email, digest(token)],
  );
  try {
    const port = Number(process.env.SMTP_PORT);
    requireRule(
      process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD &&
        process.env.MAIL_FROM &&
        Number.isInteger(port) &&
        port > 0,
      503,
      'Invitation email is not configured.',
    );
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'You’re invited to Task Manager',
      text: `${inviter.name} invited you to collaborate in Task Manager.\n\nAccept your invitation (expires in 7 days):\n${appOrigin()}/join#${token}\n\nTasks stay private until their creator shares them.`,
    });
  } catch {
    await db.query('DELETE FROM invitations WHERE id=$1', [id]);
    throw new (await import('./errors')).HttpError(
      503,
      'We could not send the invitation. Check the mail configuration and try again.',
    );
  }
  return { message: 'Invitation sent. The link expires in 7 days.' };
}
export async function inspectInvite(input: unknown) {
  const { token } = tokenInput.parse(input);
  const { rows } = await db.query(
    `SELECT i.email,u.name AS inviter,EXISTS(SELECT 1 FROM users WHERE email=i.email) AS existing
    FROM invitations i JOIN users u ON u.id=i.inviter_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at>now()`,
    [digest(token)],
  );
  requireRule(rows[0], 400, 'This invitation is invalid, expired, or already used.');
  return rows[0];
}
export async function acceptInvite(input: unknown, currentUser: User | null) {
  const data = joinInput.parse(input);
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  return transaction(async (client: PoolClient) => {
    const { rows } = await client.query(
      'SELECT * FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>now() FOR UPDATE',
      [digest(data.token)],
    );
    const invitation = rows[0];
    requireRule(invitation, 400, 'This invitation is invalid, expired, or already used.');
    const existing = await client.query('SELECT id,name,email FROM users WHERE email=$1', [
      invitation.email,
    ]);
    let user: User = existing.rows[0];
    if (user)
      requireRule(
        currentUser?.id === user.id,
        401,
        'Sign in with the invited email address, then open this invitation again.',
      );
    else {
      requireRule(
        data.name && passwordHash,
        400,
        'Your name and a password of at least 12 characters are required.',
      );
      user = { id: randomUUID(), name: data.name, email: invitation.email };
      await client.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)', [
        user.id,
        user.name,
        user.email,
        passwordHash,
      ]);
    }
    await client.query(
      'INSERT INTO contacts(user_id,contact_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING',
      [user.id, invitation.inviter_id],
    );
    await client.query('UPDATE invitations SET accepted_at=now() WHERE id=$1', [invitation.id]);
    return user;
  });
}
