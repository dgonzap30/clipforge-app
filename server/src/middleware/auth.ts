import { Context, Next } from 'hono'
import { supabase } from '../lib/supabase'

// Extend Hono context to include user_id
export type AuthContext = {
  Variables: {
    user_id: string
  }
}

/**
 * Middleware to extract and validate user from Supabase JWT token
 * Expects Authorization: Bearer <token> header
 */
export async function requireAuth(c: Context<AuthContext>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - Missing or invalid authorization header' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401)
    }

    // Set user_id in context for use in route handlers
    c.set('user_id', user.id)

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Unauthorized - Token verification failed' }, 401)
  }
}
