-- Life Grid — migration 0004: user-chosen tag colours.
--
-- One row per user per normalized tag name (id = normalized tag text,
-- mirroring daily_plans' "id is the natural key" shape). A tag with no row
-- here isn't uncoloured — the application derives a stable default via
-- colorForKey(tagName) — so this table only ever holds tags someone
-- explicitly picked a colour for. Purely additive: no existing table is
-- touched.

create table if not exists tag_colors (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  color text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);
