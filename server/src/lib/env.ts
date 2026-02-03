// Environment variables with validation
// Create a .env file based on .env.example

export const env = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // Twitch
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
  TWITCH_REDIRECT_URI: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback',

  // YouTube
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || '',
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET || '',
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:8787/api/platforms/youtube/callback',

  // Instagram
  INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID || '',
  INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET || '',
  INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:8787/api/platforms/instagram/callback',

  // TikTok
  TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY || '',
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET || '',
  TIKTOK_REDIRECT_URI: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:8787/api/platforms/tiktok/callback',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Anthropic (for Claude Vision API)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

  // Anthropic Claude (for LLM transcript analysis)
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',

  // Pexels (for B-roll stock footage)
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',

  // LLM Provider for transcript analysis
  LLM_PROVIDER: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'claude',

  // Redis (for job queue)
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // App
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
}

// Validate required env vars in production
export function validateEnv() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = required.filter(key => !env[key as keyof typeof env])

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
