import { Context, Next } from 'hono'
import { verifySupabaseToken } from '../lib/supabase'

// Extend Hono's context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string
      email?: string
      user_metadata?: Record<string, any>
      app_metadata?: Record<string, any>
    } | null
  }
}

// Middleware to verify Supabase JWT token from Authorization header
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  const { user, error } = await verifySupabaseToken(token)

  if (error || !user) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
  }

  // Store user in context for use in route handlers
  c.set('user', user)

  await next()
}

// Optional auth middleware - doesn't fail if no token is provided
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { user } = await verifySupabaseToken(token)

    if (user) {
      c.set('user', user)
    }
  }

  await next()
}
