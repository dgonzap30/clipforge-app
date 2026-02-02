// Environment variables with validation
// Create a .env file based on .env.example

export const env = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Twitch
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
  TWITCH_REDIRECT_URI: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback',

  // Storage (S3-compatible)
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_BUCKET: process.env.S3_BUCKET || 'clipforge',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  S3_REGION: process.env.S3_REGION || 'auto',

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
