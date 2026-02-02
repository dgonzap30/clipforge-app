/**
 * Supabase Client for Server
 *
 * Uses service_role key for admin operations.
 */

import { createClient } from '@supabase/supabase-js'
import { env } from './env'

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

/**
 * Supabase client with service role key
 * Has admin privileges - use carefully
 */
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

/**
 * Create a Supabase client with user context
 * Use this for user-scoped operations
 */
export function createUserClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
