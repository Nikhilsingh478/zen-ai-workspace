-- ─── Timeline Setup ───────────────────────────────────────────────────────────
-- Run this ONE file in Supabase SQL Editor.
--
-- Note: Timeline tasks are stored in the existing `horizon_tasks` table — no
-- separate tasks table is needed. Only the monthly context + schedule metadata
-- needs its own table.

CREATE TABLE IF NOT EXISTS timeline_months (
  month_key          TEXT PRIMARY KEY,          -- e.g. "2026-05"
  context            TEXT    NOT NULL DEFAULT '',
  generated_schedule TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: allow all operations via the anon key (no auth in this app)
ALTER TABLE timeline_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_timeline_months"
  ON timeline_months FOR ALL USING (true) WITH CHECK (true);
