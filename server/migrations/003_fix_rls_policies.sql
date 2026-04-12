-- Fix RLS: replace dead `app.current_user_id` policies with auth.uid()-based
-- ones, and enable RLS + policies on `vods` and `clips` (whose CREATE TABLE
-- migrations were never checked in).
--
-- The server uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely, so
-- these policies are defense-in-depth: they only fire if someone ever reaches
-- Postgres with the anon key or a user JWT. Every route handler must still
-- filter by user_id explicitly.

-- -----------------------------------------------------------------------------
-- jobs
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS jobs_user_isolation ON jobs;
DROP POLICY IF EXISTS jobs_select ON jobs;
DROP POLICY IF EXISTS jobs_insert ON jobs;
DROP POLICY IF EXISTS jobs_update ON jobs;
DROP POLICY IF EXISTS jobs_delete ON jobs;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON jobs
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY jobs_insert ON jobs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY jobs_update ON jobs
  FOR UPDATE USING (auth.uid()::text = user_id)
             WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY jobs_delete ON jobs
  FOR DELETE USING (auth.uid()::text = user_id);

-- -----------------------------------------------------------------------------
-- platform_connections
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS platform_connections_user_isolation ON platform_connections;
DROP POLICY IF EXISTS platform_connections_select ON platform_connections;
DROP POLICY IF EXISTS platform_connections_insert ON platform_connections;
DROP POLICY IF EXISTS platform_connections_update ON platform_connections;
DROP POLICY IF EXISTS platform_connections_delete ON platform_connections;

ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_connections_select ON platform_connections
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY platform_connections_insert ON platform_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY platform_connections_update ON platform_connections
  FOR UPDATE USING (auth.uid()::text = user_id)
             WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY platform_connections_delete ON platform_connections
  FOR DELETE USING (auth.uid()::text = user_id);

-- -----------------------------------------------------------------------------
-- vods: shared reference cache. No per-user ownership — any authenticated
-- user may read and insert. user_id is no longer written by the server; make
-- it nullable so new inserts don't fail.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vods' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE vods ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS vods_user_isolation ON vods;
DROP POLICY IF EXISTS vods_select ON vods;
DROP POLICY IF EXISTS vods_insert ON vods;

ALTER TABLE vods ENABLE ROW LEVEL SECURITY;

CREATE POLICY vods_select ON vods
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vods_insert ON vods
  FOR INSERT TO authenticated WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- clips: per-user isolation based on user_id column.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS clips_user_isolation ON clips;
DROP POLICY IF EXISTS clips_select ON clips;
DROP POLICY IF EXISTS clips_insert ON clips;
DROP POLICY IF EXISTS clips_update ON clips;
DROP POLICY IF EXISTS clips_delete ON clips;

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY clips_select ON clips
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY clips_insert ON clips
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY clips_update ON clips
  FOR UPDATE USING (auth.uid()::text = user_id)
             WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY clips_delete ON clips
  FOR DELETE USING (auth.uid()::text = user_id);
