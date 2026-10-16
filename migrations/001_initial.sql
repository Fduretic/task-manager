CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK(email = lower(email)),
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80), password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE invitations (
  id uuid PRIMARY KEY, inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contacts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, contact_id), CHECK (user_id <> contact_id)
);
CREATE TABLE tasks (
  id uuid PRIMARY KEY, number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  creator_id uuid NOT NULL REFERENCES users(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK(length(description) <= 10000),
  state text NOT NULL DEFAULT 'backlog' CHECK(state IN ('backlog','ready','in_progress','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
  due_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE task_members (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('viewer','assignee')),
  PRIMARY KEY(task_id,user_id)
);
CREATE INDEX task_members_user ON task_members(user_id);
CREATE INDEX tasks_creator ON tasks(creator_id);
CREATE TABLE efforts (
  id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id), hours numeric(6,2) NOT NULL CHECK(hours > 0 AND hours <= 24),
  note text NOT NULL DEFAULT '' CHECK(length(note) <= 1000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX efforts_task ON efforts(task_id);
CREATE TABLE rate_limits (key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
