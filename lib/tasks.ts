import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, transaction } from './db.mjs';
import { requireRule } from './errors';
import { taskInput, membersInput, stateInput, effortInput, uuid } from './validation';
export type Role = 'owner' | 'viewer' | 'assignee' | null;
export function canView(owner: boolean, role: Role) {
  return owner || role === 'viewer' || role === 'assignee';
}
export function canManage(owner: boolean) {
  return owner;
}
export function canWork(role: Role) {
  return role === 'assignee';
}
async function access(client: PoolClient, taskId: string, userId: string) {
  uuid.parse(taskId);
  const { rows } = await client.query(
    `SELECT t.*, (SELECT role FROM task_members WHERE task_id=t.id AND user_id=$2) AS role
    FROM tasks t WHERE t.id=$1 FOR UPDATE`,
    [taskId, userId],
  );
  const task = rows[0];
  requireRule(task && canView(task.creator_id === userId, task.role), 404, 'Task not found.');
  return task;
}
const projection = `SELECT t.*, u.name AS creator_name,
  COALESCE((SELECT json_agg(json_build_object('userId',m.user_id,'name',p.name,'role',m.role) ORDER BY p.name)
    FROM task_members m JOIN users p ON p.id=m.user_id WHERE m.task_id=t.id),'[]') AS members,
  COALESCE((SELECT sum(e.hours) FROM efforts e WHERE e.task_id=t.id),0)::float AS hours
  FROM tasks t JOIN users u ON u.id=t.creator_id`;
export async function listTasks(userId: string) {
  const { rows } = await db.query(
    `${projection} WHERE t.creator_id=$1 OR EXISTS(SELECT 1 FROM task_members WHERE task_id=t.id AND user_id=$1) ORDER BY t.created_at DESC`,
    [userId],
  );
  return rows;
}
export async function getTask(taskId: string, userId: string) {
  uuid.parse(taskId);
  // A single statement keeps task visibility and effort reads in the same snapshot.
  const { rows } = await db.query(
    `${projection.replace('FROM tasks t JOIN users u', `, COALESCE((SELECT json_agg(json_build_object('id',e.id,'hours',e.hours::float,'note',e.note,'name',p.name,'createdAt',e.created_at) ORDER BY e.created_at DESC) FROM efforts e JOIN users p ON p.id=e.user_id WHERE e.task_id=t.id),'[]') AS efforts FROM tasks t JOIN users u`)}
    WHERE t.id=$1 AND (t.creator_id=$2 OR EXISTS(SELECT 1 FROM task_members WHERE task_id=t.id AND user_id=$2))`,
    [taskId, userId],
  );
  requireRule(rows[0], 404, 'Task not found.');
  return rows[0];
}
export async function createTask(userId: string, input: unknown) {
  const data = taskInput.parse(input);
  const id = randomUUID();
  await transaction(async (client: PoolClient) => {
    await client.query(
      'INSERT INTO tasks(id,creator_id,title,description,priority,due_date) VALUES($1,$2,$3,$4,$5,$6)',
      [id, userId, data.title, data.description, data.priority, data.dueDate],
    );
    await client.query("INSERT INTO task_members(task_id,user_id,role) VALUES($1,$2,'assignee')", [
      id,
      userId,
    ]);
  });
  return getTask(id, userId);
}
export async function updateTask(taskId: string, userId: string, input: unknown) {
  const data = taskInput.parse(input);
  await transaction(async (client: PoolClient) => {
    const task = await access(client, taskId, userId);
    requireRule(
      canManage(task.creator_id === userId),
      403,
      'Only the creator can edit task details.',
    );
    await client.query(
      'UPDATE tasks SET title=$2,description=$3,priority=$4,due_date=$5,updated_at=now() WHERE id=$1',
      [taskId, data.title, data.description, data.priority, data.dueDate],
    );
  });
  return getTask(taskId, userId);
}
export async function deleteTask(taskId: string, userId: string) {
  await transaction(async (client: PoolClient) => {
    const task = await access(client, taskId, userId);
    requireRule(
      canManage(task.creator_id === userId),
      403,
      'Only the creator can delete this task.',
    );
    await client.query('DELETE FROM tasks WHERE id=$1', [taskId]);
  });
}
export async function setMembers(taskId: string, userId: string, input: unknown) {
  const data = membersInput.parse(input);
  await transaction(async (client: PoolClient) => {
    const task = await access(client, taskId, userId);
    requireRule(
      canManage(task.creator_id === userId),
      403,
      'Only the creator can share or assign this task.',
    );
    const ids = data.members.map((m) => m.userId).filter((id) => id !== userId);
    if (ids.length) {
      const { rowCount } = await client.query(
        'SELECT contact_id FROM contacts WHERE user_id=$1 AND contact_id=ANY($2::uuid[])',
        [userId, ids],
      );
      requireRule(
        rowCount === ids.length,
        400,
        'Invite these people to collaborate before sharing a task.',
      );
    }
    await client.query('DELETE FROM task_members WHERE task_id=$1', [taskId]);
    for (const member of data.members)
      await client.query('INSERT INTO task_members(task_id,user_id,role) VALUES($1,$2,$3)', [
        taskId,
        member.userId,
        member.role,
      ]);
    await client.query('UPDATE tasks SET updated_at=now() WHERE id=$1', [taskId]);
  });
  return getTask(taskId, userId);
}
export async function setState(taskId: string, userId: string, input: unknown) {
  const data = stateInput.parse(input);
  await transaction(async (client: PoolClient) => {
    const task = await access(client, taskId, userId);
    requireRule(canWork(task.role), 403, 'Only assigned people can change task state.');
    await client.query('UPDATE tasks SET state=$2,updated_at=now() WHERE id=$1', [
      taskId,
      data.state,
    ]);
  });
  return getTask(taskId, userId);
}
export async function logEffort(taskId: string, userId: string, input: unknown) {
  const data = effortInput.parse(input);
  await transaction(async (client: PoolClient) => {
    const task = await access(client, taskId, userId);
    requireRule(canWork(task.role), 403, 'Only assigned people can log effort.');
    await client.query(
      'INSERT INTO efforts(id,task_id,user_id,hours,note) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), taskId, userId, data.hours, data.note],
    );
    await client.query('UPDATE tasks SET updated_at=now() WHERE id=$1', [taskId]);
  });
  return getTask(taskId, userId);
}
export async function listPeople(userId: string) {
  const { rows } = await db.query(
    'SELECT id,name,email FROM users WHERE id=$1 OR id IN (SELECT contact_id FROM contacts WHERE user_id=$1) ORDER BY name',
    [userId],
  );
  return rows;
}
