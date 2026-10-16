export type Person = { id: string; name: string; email: string };
export type Member = { userId: string; name: string; role: 'viewer' | 'assignee' };
export type Task = {
  id: string;
  number: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  state: 'backlog' | 'ready' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  members: Member[];
  hours: number;
  efforts?: { id: string; hours: number; note: string; name: string; createdAt: string }[];
};
export const states = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'ready', label: 'Ready' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
] as const;
