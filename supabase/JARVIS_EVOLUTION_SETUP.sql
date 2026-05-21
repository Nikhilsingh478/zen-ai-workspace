-- JARVIS Evolution Phase 1 — Run this in your Supabase SQL Editor
-- Creates 3 new tables. Does NOT touch any existing tables.

-- Conversation sessions
create table if not exists jarvis_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_summary text,
  message_count integer not null default 0,
  tags text[] not null default '{}'
);

-- Individual messages within sessions
create table if not exists jarvis_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references jarvis_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  message_type text not null default 'conversation',
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Persistent memory / quick captures
create table if not exists jarvis_memory (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  memory_type text not null default 'general',
  source_session_id uuid references jarvis_sessions(id) on delete set null,
  recalled_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_recalled_at timestamptz
);

-- Performance indexes
create index if not exists idx_jarvis_messages_session on jarvis_messages(session_id);
create index if not exists idx_jarvis_messages_created on jarvis_messages(created_at desc);
create index if not exists idx_jarvis_memory_type on jarvis_memory(memory_type);
create index if not exists idx_jarvis_memory_created on jarvis_memory(created_at desc);
