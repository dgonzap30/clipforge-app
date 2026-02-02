-- Create platform_connections table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint: one connection per user per platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_connections_user_platform ON platform_connections(user_id, platform);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);

-- Enable Row Level Security
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access their own platform connections
CREATE POLICY platform_connections_user_isolation ON platform_connections
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));
