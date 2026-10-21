-- Life Grid — migration 0002: brute-force rate limiting.
--
-- A fixed-window counter keyed by an arbitrary string (e.g.
-- "login:someone@example.com"), stored in Postgres rather than in a
-- function instance's memory — a serverless function instance is not
-- guaranteed to see the next request at all, let alone keep any in-memory
-- state until then, so an in-memory counter would not actually limit
-- anything in production. See server/rateLimit.ts.

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);
