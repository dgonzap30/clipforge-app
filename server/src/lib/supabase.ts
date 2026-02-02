import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Create Supabase client for server-side operations
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Helper to verify JWT token and get user
export async function verifySupabaseToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return { user: null, error }
  }

  return { user: data.user, error: null }
}
