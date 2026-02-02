import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Create a Supabase client with service role key for server-side operations
// This client has elevated privileges and should only be used on the server
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Verify Supabase JWT token and return user
export async function verifySupabaseToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token)

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user, error: null }
}
