-- Run this in your Supabase dashboard → SQL Editor
-- to enable usage tracking for the Insights tab.

CREATE TABLE IF NOT EXISTS usage_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    text NOT NULL,
  item_name  text NOT NULL DEFAULT '',
  item_url   text,
  type       text NOT NULL CHECK (type IN ('tool', 'prompt')),
  action     text NOT NULL CHECK (action IN ('open', 'copy')),
  timestamp  timestamptz NOT NULL DEFAULT now()
);

-- Optional: index for fast time-range queries
CREATE INDEX IF NOT EXISTS usage_logs_timestamp_idx ON usage_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS usage_logs_item_id_idx   ON usage_logs (item_id);

-- Disable RLS (single-user personal app)
ALTER TABLE usage_logs DISABLE ROW LEVEL SECURITY;
