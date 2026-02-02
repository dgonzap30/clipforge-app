import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { TwitchClient } from '../lib/twitch'

export interface AuthContext {
  userId: string
  userLogin: string
}

// Extend Hono context with auth variables
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    userLogin: string
  }
}

export async function requireAuth(c: Context, next: Next) {
  const accessToken = getCookie(c, 'twitch_access_token')

  if (!accessToken) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const client = new TwitchClient(accessToken)
    const user = await client.getUser()

    // Set user context for downstream handlers
    c.set('userId', user.id)
    c.set('userLogin', user.login)

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
