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
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
  // Redis (for job queue)
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

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
