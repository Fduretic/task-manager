import { z } from 'zod';
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12, 'Use at least 12 characters.').max(128);
export const uuid = z.string().uuid();
export const state = z.enum(['backlog', 'ready', 'in_progress', 'done']);
export const loginInput = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const invitationInput = z.object({ email }).strict();
export const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const joinInput = tokenInput
  .extend({ name: z.string().trim().min(1).max(80).optional(), password: password.optional() })
  .strict();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, 'Use a valid date.');
export const taskInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(10000).default(''),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    dueDate: date.nullable().default(null),
  })
  .strict();
export const membersInput = z
  .object({
    members: z
      .array(z.object({ userId: uuid, role: z.enum(['viewer', 'assignee']) }).strict())
      .max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.members.map((m) => m.userId)).size === v.members.length,
    'Each person may appear only once.',
  );
export const stateInput = z.object({ state }).strict();
export const effortInput = z
  .object({
    hours: z.number().positive().max(24).multipleOf(0.01),
    note: z.string().trim().max(1000).default(''),
  })
  .strict();
