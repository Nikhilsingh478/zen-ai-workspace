-- Run this in your Supabase dashboard → SQL Editor
-- Creates the mood_entries table for the Mood Tracker feature.

CREATE TABLE IF NOT EXISTS mood_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mood           integer NOT NULL CHECK (mood BETWEEN 1 AND 5),
  mood_label     text NOT NULL,
  stress         integer CHECK (stress BETWEEN 1 AND 5),
  energy         integer CHECK (energy BETWEEN 1 AND 5),
  focus          integer CHECK (focus BETWEEN 1 AND 5),
  sleep_quality  integer CHECK (sleep_quality BETWEEN 1 AND 5),
  reason         text CHECK (char_length(reason) <= 500),
  reflection     text CHECK (char_length(reflection) <= 5000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (open policy for single-user app)
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON mood_entries FOR ALL USING (true) WITH CHECK (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_mood_entries_created ON mood_entries (created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mood_entries;
