import { Hono } from 'hono'
import { verifySupabaseToken } from '../lib/supabase'

export const authRoutes = new Hono()

// Get current user from JWT token
// Expects Authorization: Bearer <token> header
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ user: null, authenticated: false })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const { user, error } = await verifySupabaseToken(token)

    if (error || !user) {
      return c.json({ user: null, authenticated: false })
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        created_at: user.created_at,
      },
      authenticated: true
    })

  } catch (err) {
    console.error('Auth check error:', err)
    return c.json({ user: null, authenticated: false })
  }
})

// Health check for auth service
authRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'Auth service is running with Supabase JWT verification'
  })
})
