-- Harden RLS. Schema context (discovered on the live db):
--   jobs.user_id, clips.user_id, vods.user_id are uuid + FK auth.users.id
--   platform_connections.user_id is text (no FK)
--   jobs / clips / vods already have a SELECT policy using auth.uid() = user_id
--     but no INSERT / UPDATE / DELETE policies — fills that gap
--   platform_connections had a dead policy referencing
--     current_setting('app.current_user_id') which was never set anywhere
--     in the server — replaced with per-op policies using auth.uid()::text
--   vods is repositioned as a shared reference cache: any authenticated user
--     may SELECT and INSERT it; user_id becomes nullable. The server stopped
--     writing user_id in vods.ts.
--
-- Server uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely, so
-- these policies are defense-in-depth only. Handler-level .eq('user_id', ...)
-- filters remain the primary authorization mechanism.

-- ----------------------------------------------------------------------------
-- jobs: add INSERT / UPDATE / DELETE (keep existing SELECT)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS jobs_insert ON jobs;
DROP POLICY IF EXISTS jobs_update ON jobs;
DROP POLICY IF EXISTS jobs_delete ON jobs;

CREATE POLICY jobs_insert ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY jobs_update ON jobs
  FOR UPDATE USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY jobs_delete ON jobs
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- clips: add INSERT / UPDATE / DELETE (keep existing SELECT)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS clips_insert ON clips;
DROP POLICY IF EXISTS clips_update ON clips;
DROP POLICY IF EXISTS clips_delete ON clips;

CREATE POLICY clips_insert ON clips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY clips_update ON clips
  FOR UPDATE USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY clips_delete ON clips
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- vods: convert to a shared reference cache
--   - make user_id nullable (server no longer writes it; FK still enforces
--     referential integrity for rows that do carry it)
--   - drop the per-owner SELECT policy, replace with read-all for authenticated
--   - allow authenticated INSERT (server upserts on conflict do nothing, so
--     only first-writer creates a row)
-- ----------------------------------------------------------------------------

ALTER TABLE vods ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users read own vods" ON vods;
DROP POLICY IF EXISTS vods_select ON vods;
DROP POLICY IF EXISTS vods_insert ON vods;
DROP POLICY IF EXISTS vods_update ON vods;

CREATE POLICY vods_select ON vods
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vods_insert ON vods
  FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- platform_connections: replace dead current_setting('app.current_user_id')
-- policy with auth.uid()::text per-operation policies. user_id is text here.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS platform_connections_user_isolation ON platform_connections;
DROP POLICY IF EXISTS platform_connections_select ON platform_connections;
DROP POLICY IF EXISTS platform_connections_insert ON platform_connections;
DROP POLICY IF EXISTS platform_connections_update ON platform_connections;
DROP POLICY IF EXISTS platform_connections_delete ON platform_connections;

CREATE POLICY platform_connections_select ON platform_connections
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY platform_connections_insert ON platform_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY platform_connections_update ON platform_connections
  FOR UPDATE USING (auth.uid()::text = user_id)
             WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY platform_connections_delete ON platform_connections
  FOR DELETE USING (auth.uid()::text = user_id);
