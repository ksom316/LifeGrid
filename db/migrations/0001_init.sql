-- Life Grid — hosted schema, migration 0001
--
-- Design notes:
--  - IDs are UUIDs supplied by the application (crypto.randomUUID() on the
--    client or server), never a DB-generated default. This lets the local
--    data migration flow preserve a record's existing IndexedDB id when it
--    moves to the hosted database, matching the "preserve record IDs where
--    safe" requirement, and keeps the schema portable (no reliance on the
--    pgcrypto/uuid-ossp extensions for gen_random_uuid()).
--  - Every user-owned table carries user_id with ON DELETE CASCADE from
--    users, so deleting an account cleanly removes everything it owns.
--  - project_id / task_id back-references use ON DELETE SET NULL, mirroring
--    the existing client behavior in src/data/projects.ts
--    (deletePreservingRecords): deleting a project must never delete the
--    tasks/notes/focus sessions that referenced it, only detach them.
--  - recurrence lives in a single jsonb column, mirroring the client's
--    TaskRecurrence type exactly (frequency/weekdays/dayOfMonth/endDate) —
--    this avoids a parallel, hand-maintained set of SQL columns that could
--    drift from src/types/domain.ts, and keeps server-side validation
--    (server/validation.ts) directly comparable to the client's
--    isRecurrenceConfigValid().
--  - daily_plans and weekly_reviews keep their existing *semantic* id (a
--    local date key, or a Monday-of-week date key) as the primary key
--    component, scoped per user via a composite primary key, matching the
--    "one record per calendar day/week" invariant already enforced
--    client-side in src/data/dailyPlans.ts / weeklyReviews.ts.

create table if not exists users (
  id uuid primary key,
  email text not null,
  email_normalized text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists projects (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null,
  priority text,
  start_date date,
  target_date date,
  color text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists projects_user_updated_idx on projects(user_id, updated_at);

create table if not exists tasks (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  notes text not null default '',
  status text not null,
  priority text not null,
  due_date date,
  completed_at timestamptz,
  recurrence jsonb,
  recurrence_parent_id uuid references tasks(id) on delete set null,
  reminder_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_user_updated_idx on tasks(user_id, updated_at);
create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists tasks_recurrence_parent_idx on tasks(recurrence_parent_id);

create table if not exists notes (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_user_updated_idx on notes(user_id, updated_at);
create index if not exists notes_project_id_idx on notes(project_id);

create table if not exists focus_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer not null default 0,
  note text not null default '',
  type text,
  status text,
  planned_duration_minutes integer,
  accumulated_ms bigint,
  resumed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists focus_sessions_user_id_idx on focus_sessions(user_id);
create index if not exists focus_sessions_user_started_idx on focus_sessions(user_id, started_at);

create table if not exists daily_plans (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  task_ids uuid[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists weekly_reviews (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  week_start date not null,
  wins text not null default '',
  blockers text not null default '',
  lessons text not null default '',
  next_steps text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

-- Tracks which local (IndexedDB) backups have already been imported into the
-- hosted account, keyed by a content fingerprint of the backup — this is
-- what "prevent repeated imports from creating duplicates" is built on at
-- the application layer (see server/repositories/migration.ts).
create table if not exists local_imports (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  fingerprint text not null,
  imported_at timestamptz not null default now(),
  record_counts jsonb not null,
  unique (user_id, fingerprint)
);
