-- Run this in your Supabase SQL Editor to create the Horizon tasks table

create table if not exists horizon_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_date date not null,
  task_time text not null,
  priority text default 'medium',
  completed boolean default false,
  notification_enabled boolean default false,
  created_at timestamptz default now()
);

-- Enable Row Level Security (open policy for single-user app)
alter table horizon_tasks enable row level security;

create policy "allow all" on horizon_tasks for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table horizon_tasks;
