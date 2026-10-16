'use client';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon, Brand } from './icon';
import { Modal } from './modal';
import { api } from '@/lib/client';
import { states, type Task, type Person } from '@/lib/types';
const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
const dateLabel = (date: string) =>
  new Date(date.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
export function Board({ user }: { user: Person }) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [priority, setPriority] = useState('all');
  const [modal, setModal] = useState<'new' | 'invite' | null>(null),
    [selected, setSelected] = useState<Task | null>(null);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api('tasks'), api('people')]);
      setTasks(t.tasks);
      setPeople(p.people);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filter === 'all' ||
            (filter === 'mine' && t.creator_id === user.id) ||
            (filter === 'assigned' &&
              t.members.some((m) => m.userId === user.id && m.role === 'assignee')) ||
            (filter === 'shared' && t.creator_id !== user.id)) &&
          (priority === 'all' || t.priority === priority) &&
          `${t.title} ${t.description} TM-${t.number}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [tasks, filter, priority, query, user.id],
  );
  async function openTask(task: Task) {
    try {
      const r = await api(`tasks/${task.id}`);
      setSelected(r.task);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const done = tasks.filter((t) => t.state === 'done').length;
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-icon">W</span>
          <div>
            My workspace<small>Small team. Big ideas.</small>
          </div>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Workspace">
          <button
            className={filter === 'all' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('all')}
          >
            <Icon name="grid" />
            All tasks<span>{tasks.length}</span>
          </button>
          <button
            className={filter === 'mine' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('mine')}
          >
            <Icon name="lock" />
            Created by me
          </button>
          <button
            className={filter === 'assigned' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('assigned')}
          >
            <Icon name="check" />
            Assigned to me
          </button>
          <button
            className={filter === 'shared' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('shared')}
          >
            <Icon name="users" />
            Shared with me
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="team-callout">
            <span className="team-icon">
              <Icon name="users" size={21} />
            </span>
            <h3>Good work is a team effort.</h3>
            <p>Bring your people into the picture.</p>
            <button onClick={() => setModal('invite')}>
              Invite a teammate <Icon name="plus" size={16} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api('auth/logout', 'POST');
                  location.assign('/login');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>Main board</strong>
          </div>
          <div className="topbar-right">
            <span className="privacy-pill">
              <Icon name="lock" size={13} />
              Private by default
            </span>
            <span className="avatar small">{initials(user.name)}</span>
            <button
              className="icon-button mobile-signout"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api('auth/logout', 'POST');
                  location.assign('/login');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </header>
        <div className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">LET’S MAKE THINGS HAPPEN</span>
              <h1>
                {filter === 'mine'
                  ? 'Created by me'
                  : filter === 'assigned'
                    ? 'Assigned to me'
                    : filter === 'shared'
                      ? 'Shared with me'
                      : 'Main board'}
                <span className="heading-dot">.</span>
              </h1>
              <p>A clear view of what’s next, what’s moving, and what’s done.</p>
            </div>
            <button className="button primary" onClick={() => setModal('new')}>
              <Icon name="plus" />
              New task
            </button>
          </div>
          <section className="stats" aria-label="Workspace summary">
            <div>
              <span className="stat-icon">
                <Icon name="list" size={21} />
              </span>
              <div>
                <span>Total tasks</span>
                <strong>{tasks.length.toString().padStart(2, '0')}</strong>
              </div>
              <small>Your workspace</small>
            </div>
            <div>
              <span className="stat-icon warm">
                <Icon name="circle" size={21} />
              </span>
              <div>
                <span>In progress</span>
                <strong>
                  {tasks
                    .filter((t) => t.state === 'in_progress')
                    .length.toString()
                    .padStart(2, '0')}
                </strong>
              </div>
              <small>Making moves</small>
            </div>
            <div>
              <span className="stat-icon green">
                <Icon name="check" size={21} />
              </span>
              <div>
                <span>Completed</span>
                <strong>{done.toString().padStart(2, '0')}</strong>
              </div>
              <small>
                {tasks.length ? Math.round((done / tasks.length) * 100) : 0}% of all tasks
              </small>
            </div>
            <div>
              <span className="stat-icon peach">
                <Icon name="clock" size={21} />
              </span>
              <div>
                <span>Hours logged</span>
                <strong>
                  {Number(tasks.reduce((sum, t) => sum + t.hours, 0).toFixed(2))}
                  <em>h</em>
                </strong>
              </div>
              <small>Effort that counts</small>
            </div>
          </section>
          <div className="board-toolbar">
            <div className="board-tab">
              <Icon name="grid" size={16} />
              Board view
            </div>
            <div className="filters">
              <label className="search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search tasks"
                  placeholder="Search tasks…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter by priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                className="button secondary invite-toolbar"
                onClick={() => setModal('invite')}
              >
                <Icon name="users" />
                Invite
              </button>
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              {message}
              <button onClick={() => setMessage('')}>Dismiss</button>
            </div>
          )}
          {loading ? (
            <div className="loading" role="status">
              Getting your workspace ready…
            </div>
          ) : (
            <section className="kanban" aria-label="Task board">
              {states.map((state) => {
                const column = filtered.filter((t) => t.state === state.id);
                return (
                  <section
                    className={`column column-${state.id}`}
                    key={state.id}
                    aria-label={state.label}
                  >
                    <div className="column-heading">
                      <span className="status-dot" />
                      <h2>{state.label}</h2>
                      <span className="count">{column.length}</span>
                      {state.id === 'backlog' && (
                        <button
                          className="icon-button"
                          aria-label="Add task to backlog"
                          onClick={() => setModal('new')}
                        >
                          <Icon name="plus" size={17} />
                        </button>
                      )}
                    </div>
                    <div className="column-cards">
                      {column.map((t) => (
                        <button className="task-card" key={t.id} onClick={() => void openTask(t)}>
                          <div className="card-top">
                            <span className="task-number">TM-{t.number}</span>
                            <span className={`priority ${t.priority}`}>
                              <i />
                              {t.priority}
                            </span>
                          </div>
                          <h3>{t.title}</h3>
                          {t.description && <p>{t.description}</p>}
                          <div className="card-tags">
                            {t.due_date && (
                              <span
                                className={
                                  t.state !== 'done' &&
                                  t.due_date.slice(0, 10) < new Date().toLocaleDateString('en-CA')
                                    ? 'due overdue'
                                    : 'due'
                                }
                              >
                                <Icon name="calendar" size={13} />
                                {dateLabel(t.due_date)}
                              </span>
                            )}
                            {t.hours > 0 && (
                              <span>
                                <Icon name="clock" size={13} />
                                {t.hours}h
                              </span>
                            )}
                          </div>
                          <div className="card-bottom">
                            <span className="sharing">
                              <Icon
                                name={
                                  t.members.some((m) => m.userId !== t.creator_id)
                                    ? 'users'
                                    : 'lock'
                                }
                                size={13}
                              />
                              {t.members.some((m) => m.userId !== t.creator_id)
                                ? 'Shared'
                                : 'Private'}
                            </span>
                            <span className="avatars">
                              {t.members
                                .filter((m) => m.role === 'assignee')
                                .slice(0, 3)
                                .map((m) => (
                                  <span key={m.userId} className="avatar tiny" title={m.name}>
                                    {initials(m.name)}
                                  </span>
                                ))}
                              {!t.members.some((m) => m.role === 'assignee') && (
                                <span className="unassigned">Unassigned</span>
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                      {column.length === 0 && (
                        <div className="empty-column">
                          <span>
                            <Icon name={state.id === 'done' ? 'check' : 'circle'} size={22} />
                          </span>
                          <p>
                            {query || priority !== 'all'
                              ? 'No matching tasks'
                              : state.id === 'backlog'
                                ? 'Space for your next idea'
                                : state.id === 'ready'
                                  ? 'Ready when you are'
                                  : state.id === 'in_progress'
                                    ? 'A little room to focus'
                                    : 'Good things take work'}
                          </p>
                          <small>
                            {state.id === 'backlog'
                              ? 'Create a task to get started.'
                              : 'Tasks will appear here as work moves.'}
                          </small>
                        </div>
                      )}
                    </div>
                    {state.id === 'backlog' && (
                      <button className="add-card" onClick={() => setModal('new')}>
                        <Icon name="plus" size={15} />
                        Add a task
                      </button>
                    )}
                  </section>
                );
              })}
            </section>
          )}
          <footer className="board-footer">
            <span>
              <Icon name="lock" size={13} />
              Only you and the people you share with can see your tasks.
            </span>
            <span>One task at a time.</span>
          </footer>
        </div>
      </main>
      {modal === 'new' && (
        <NewTask
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            setMessage('Task created. It’s private and assigned to you.');
          }}
        />
      )}
      {modal === 'invite' && (
        <Invite
          onClose={() => setModal(null)}
          onSent={(m) => {
            setModal(null);
            setMessage(m);
          }}
        />
      )}
      {selected && (
        <TaskDetail
          task={selected}
          people={people}
          user={user}
          onClose={() => setSelected(null)}
          onChange={async (t) => {
            setSelected(t);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
function TaskFields({ task }: { task?: Task }) {
  return (
    <>
      <label>
        Task title
        <input
          autoFocus
          name="title"
          placeholder="What needs to happen?"
          defaultValue={task?.title}
          maxLength={160}
          required
        />
      </label>
      <label>
        Description <span className="optional">Optional</span>
        <textarea
          name="description"
          placeholder="Add a little context, a few details, or your definition of done…"
          defaultValue={task?.description}
          maxLength={10000}
          rows={4}
        />
      </label>
      <div className="form-row">
        <label>
          Priority
          <select name="priority" defaultValue={task?.priority || 'medium'}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>
          Due date <span className="optional">Optional</span>
          <input name="dueDate" type="date" defaultValue={task?.due_date?.slice(0, 10)} />
        </label>
      </div>
    </>
  );
}
function taskData(form: HTMLFormElement) {
  const d = new FormData(form);
  return {
    title: d.get('title'),
    description: d.get('description'),
    priority: d.get('priority'),
    dueDate: d.get('dueDate') || null,
  };
}
function NewTask({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="A new beginning." onClose={onClose}>
      <p className="modal-intro">Give your next task a place to start.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('tasks', 'POST', taskData(e.currentTarget));
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <TaskFields />
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="form-hint">
          <Icon name="lock" size={14} />
          Private and assigned to you. Share it whenever you’re ready.
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create task'}
            <Icon name="plus" size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Invite({ onClose, onSent }: { onClose: () => void; onSent: (s: string) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Work better, together." onClose={onClose}>
      <p className="modal-intro">
        Send a teammate an invitation. Once they accept, you can share and assign tasks to each
        other.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const data = new FormData(e.currentTarget);
          try {
            const r = await api('invitations', 'POST', { email: data.get('email') });
            onSent(r.message);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <label>
          Teammate’s email
          <input
            autoFocus
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="teammate@company.com"
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="form-hint">
          <Icon name="lock" size={14} />
          Inviting someone doesn’t share any of your tasks.
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send invitation'}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function TaskDetail({
  task,
  people,
  user,
  onClose,
  onChange,
}: {
  task: Task;
  people: Person[];
  user: Person;
  onClose: () => void;
  onChange: (t: Task | null) => Promise<void>;
}) {
  const owner = task.creator_id === user.id,
    assigned = task.members.some((m) => m.userId === user.id && m.role === 'assignee');
  const [editing, setEditing] = useState(false),
    [tab, setTab] = useState('details'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  async function mutate(path: string, method: string, data?: unknown) {
    setBusy(true);
    setError('');
    try {
      const r = await api(`tasks/${task.id}${path}`, method, data);
      await onChange(r.task ?? null);
      setEditing(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal wide title={`TM-${task.number}`} onClose={onClose}>
      <div className="detail-title">
        <span className={`priority ${task.priority}`}>
          <i />
          {task.priority}
        </span>
        <h2>{task.title}</h2>
        <p>
          Created by {task.creator_name} · {dateLabel(task.created_at)}
        </p>
      </div>
      <div className="detail-tabs">
        {['details', 'people', 'effort'].map((t) => (
          <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>
            {t === 'people'
              ? 'Sharing & assignment'
              : t === 'effort'
                ? `Effort · ${task.hours}h`
                : 'Details'}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {tab === 'details' &&
        (editing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate('', 'PATCH', taskData(e.currentTarget));
            }}
          >
            <TaskFields task={task} />
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-metadata">
              <label>
                Workflow state
                <select
                  aria-label="Workflow state"
                  value={task.state}
                  disabled={!assigned || busy}
                  onChange={(e) => void mutate('/state', 'PATCH', { state: e.target.value })}
                >
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span>Due date</span>
                <strong>{task.due_date ? dateLabel(task.due_date) : 'No due date'}</strong>
              </div>
            </div>
            {!assigned && (
              <p className="form-hint">Only assigned people can move this task or log hours.</p>
            )}
            <div className="description">
              <h3>Description</h3>
              <p>{task.description || 'No description yet.'}</p>
            </div>
            {owner && (
              <div className="modal-actions split">
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" size={15} />
                  Delete task
                </button>
                <button className="button secondary" onClick={() => setEditing(true)}>
                  Edit details
                </button>
              </div>
            )}
            {confirmDelete && (
              <div className="delete-confirm">
                <p>Delete this task and all logged effort? This cannot be undone.</p>
                <button className="button secondary" onClick={() => setConfirmDelete(false)}>
                  Keep task
                </button>{' '}
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => void mutate('', 'DELETE')}
                >
                  Delete permanently
                </button>
              </div>
            )}
          </>
        ))}
      {tab === 'people' && (
        <>
          <p className="modal-intro">
            Viewers can read this task. Assigned people can also change its state and log hours. The
            creator manages details and access.
          </p>
          <form
            key={JSON.stringify(task.members)}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const members = Array.from(f.entries())
                .filter(([, v]) => v !== 'none')
                .map(([userId, role]) => ({ userId, role }));
              await mutate('/members', 'PATCH', { members });
            }}
          >
            {(owner
              ? people
              : task.members.map((m) => ({ id: m.userId, name: m.name, email: '' }))
            ).map((p) => (
              <div className="person-row" key={p.id}>
                <span className="avatar">{initials(p.name)}</span>
                <div>
                  <strong>
                    {p.name}
                    {p.id === user.id ? ' (you)' : ''}
                  </strong>
                  <small>{p.id === task.creator_id ? 'Creator' : p.email}</small>
                </div>
                <select
                  aria-label={`Access for ${p.name}`}
                  name={p.id}
                  disabled={!owner || busy}
                  defaultValue={task.members.find((m) => m.userId === p.id)?.role || 'none'}
                >
                  <option value="none">
                    {p.id === task.creator_id ? 'Creator only' : 'No access'}
                  </option>
                  <option value="viewer">Viewer</option>
                  <option value="assignee">Assigned</option>
                </select>
              </div>
            ))}
            {owner && (
              <div className="modal-actions">
                <button className="button primary" disabled={busy}>
                  Save access
                </button>
              </div>
            )}
          </form>
        </>
      )}
      {tab === 'effort' && (
        <>
          {assigned && (
            <form
              className="effort-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (
                  await mutate('/efforts', 'POST', {
                    hours: Number(f.get('hours')),
                    note: f.get('note'),
                  })
                )
                  form.reset();
              }}
            >
              <div className="form-row">
                <label>
                  Hours spent
                  <input
                    type="number"
                    name="hours"
                    min="0.01"
                    max="24"
                    step="0.01"
                    placeholder="1.5"
                    required
                  />
                </label>
                <label>
                  What did you work on?
                  <input name="note" maxLength={1000} placeholder="A brief note (optional)" />
                </label>
              </div>
              <button className="button primary" disabled={busy}>
                <Icon name="clock" size={16} />
                Log effort
              </button>
            </form>
          )}
          <div className="effort-list">
            {task.efforts?.length ? (
              task.efforts.map((e) => (
                <div key={e.id}>
                  <span className="avatar">{initials(e.name)}</span>
                  <div>
                    <strong>
                      {e.name}
                      <small>{dateLabel(e.createdAt)}</small>
                    </strong>
                    <p>{e.note || 'Time logged'}</p>
                  </div>
                  <b>{e.hours}h</b>
                </div>
              ))
            ) : (
              <p className="muted">No effort logged yet. Every little bit of progress counts.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
