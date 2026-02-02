-- Add Instagram support to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

-- Create index for Instagram media lookups
CREATE INDEX IF NOT EXISTS idx_clips_instagram_media_id ON clips(instagram_media_id);
