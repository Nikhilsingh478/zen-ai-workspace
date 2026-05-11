-- Run this in Supabase SQL Editor after HORIZON_SETUP.sql
-- Creates tables for FCM token persistence and duplicate-safe reminder delivery

-- ─── notification_tokens ─────────────────────────────────────────────────────

create table if not exists notification_tokens (
  id           uuid        primary key default gen_random_uuid(),
  token        text        not null unique,
  platform     text        not null default 'web',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table notification_tokens enable row level security;
create policy "allow all" on notification_tokens for all using (true) with check (true);

-- ─── reminder_sent_log ────────────────────────────────────────────────────────
-- One row per task once a reminder has been dispatched.
-- Cascade-delete keeps it clean when a task is removed.

create table if not exists reminder_sent_log (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references horizon_tasks(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  unique (task_id)
);

alter table reminder_sent_log enable row level security;
create policy "allow all" on reminder_sent_log for all using (true) with check (true);

-- ─── Helper: auto-update updated_at on notification_tokens ───────────────────

create or replace function update_notification_token_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_tokens_updated_at on notification_tokens;
create trigger notification_tokens_updated_at
  before update on notification_tokens
  for each row execute procedure update_notification_token_timestamp();
