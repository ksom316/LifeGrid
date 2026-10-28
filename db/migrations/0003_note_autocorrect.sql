-- Life Grid — migration 0003: per-note auto-correct setting.
--
-- Nullable, no default: NULL means "not set," which the application layer
-- (src/data/notes.ts's noteAutocorrectEnabled, server/repositories/notes.ts)
-- treats as enabled (true) — the same meaning as the field being absent on
-- a note created before this existed. This keeps the migration purely
-- additive: every existing row stays valid and behaves exactly as before.

alter table notes add column if not exists autocorrect boolean;
