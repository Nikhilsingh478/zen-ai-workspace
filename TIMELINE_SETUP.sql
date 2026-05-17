-- ─── Timeline Tables Setup ────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable the Timeline tab.

-- Monthly context + generated schedule storage
CREATE TABLE IF NOT EXISTS timeline_months (
  month_key          TEXT PRIMARY KEY,          -- e.g. "2026-05"
  context            TEXT    NOT NULL DEFAULT '',
  generated_schedule TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual scheduled tasks per month/day
CREATE TABLE IF NOT EXISTS timeline_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key     TEXT    NOT NULL REFERENCES timeline_months(month_key) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  title         TEXT    NOT NULL,
  domain        TEXT    NOT NULL,
  start_time    TIME    NOT NULL,
  end_time      TIME    NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  ai_generated  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS timeline_tasks_month_key_idx ON timeline_tasks(month_key);
CREATE INDEX IF NOT EXISTS timeline_tasks_date_idx      ON timeline_tasks(date);

-- Row Level Security (optional but recommended)
ALTER TABLE timeline_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_tasks  ENABLE ROW LEVEL SECURITY;

-- Allow all operations (anon key) — tighten per your auth setup
CREATE POLICY IF NOT EXISTS "allow_all_timeline_months" ON timeline_months FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_timeline_tasks"  ON timeline_tasks  FOR ALL USING (true) WITH CHECK (true);
