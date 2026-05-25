-- Run this in your Supabase dashboard → SQL Editor to enable the
-- Link Board, Image Board, and Important Messages tabs.
--
-- Single-user setup: matches the existing items / desktop_layout pattern.
-- RLS is left disabled so the existing anon-key client can read & write.

-- ─── Link Board ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  url         text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS links_position_idx ON public.links (position);
ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;

-- ─── Image Board ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.image_board (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  storage_path text NOT NULL,
  public_url   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS image_board_created_idx ON public.image_board (created_at DESC);
ALTER TABLE public.image_board DISABLE ROW LEVEL SECURITY;

-- Storage bucket for image uploads (public read so public_url works)
INSERT INTO storage.buckets (id, name, public)
VALUES ('image-board', 'image-board', true)
ON CONFLICT (id) DO NOTHING;

-- Allow the anon role to upload / read / delete in the image-board bucket
-- (single-user app, mirrors the rest of the schema).
DO $$
BEGIN
  BEGIN
    CREATE POLICY "image-board public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'image-board');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "image-board anon insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'image-board');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "image-board anon delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'image-board');
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─── Important Messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.important_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motive     text NOT NULL,
  time       text NOT NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS important_messages_created_idx
  ON public.important_messages (created_at DESC);
ALTER TABLE public.important_messages DISABLE ROW LEVEL SECURITY;