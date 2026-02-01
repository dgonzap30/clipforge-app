import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { nanoid } from 'nanoid'
import { 
  getAuthorizationUrl, 
  exchangeCodeForTokens, 
  TwitchClient,
  validateToken,
  refreshAccessToken,
} from '../lib/twitch'
import { env } from '../lib/env'

export const authRoutes = new Hono()

// Initiate OAuth flow
authRoutes.get('/login', (c) => {
  const state = nanoid()
  
  // Store state in cookie for CSRF protection
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 10, // 10 minutes
  })
  
  const authUrl = getAuthorizationUrl(state)
  return c.redirect(authUrl)
})

// OAuth callback
authRoutes.get('/callback', async (c) => {
  const { code, state, error } = c.req.query()
  
  // Handle OAuth errors
  if (error) {
    return c.redirect(`${env.FRONTEND_URL}?error=${error}`)
  }
  
  // Verify state
  const storedState = getCookie(c, 'oauth_state')
  if (!storedState || storedState !== state) {
    return c.redirect(`${env.FRONTEND_URL}?error=invalid_state`)
  }
  
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    
    // Get user info
    const client = new TwitchClient(tokens.access_token)
    const user = await client.getUser()
    
    // Store tokens in secure cookie (or use a proper session store in production)
    setCookie(c, 'twitch_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: tokens.expires_in,
    })
    
    setCookie(c, 'twitch_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    
    // Clear state cookie
    setCookie(c, 'oauth_state', '', { maxAge: 0 })
    
    // Redirect to frontend with success
    return c.redirect(`${env.FRONTEND_URL}?auth=success&user=${user.login}`)
    
  } catch (err) {
    console.error('OAuth callback error:', err)
    return c.redirect(`${env.FRONTEND_URL}?error=auth_failed`)
  }
})

// Get current user
authRoutes.get('/me', async (c) => {
  const accessToken = getCookie(c, 'twitch_access_token')
  
  if (!accessToken) {
    return c.json({ user: null, authenticated: false })
  }
  
  try {
    // Validate token
    const isValid = await validateToken(accessToken)
    
    if (!isValid) {
      // Try to refresh
      const refreshToken = getCookie(c, 'twitch_refresh_token')
      if (refreshToken) {
        const newTokens = await refreshAccessToken(refreshToken)
        
        setCookie(c, 'twitch_access_token', newTokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
          maxAge: newTokens.expires_in,
        })
        
        const client = new TwitchClient(newTokens.access_token)
        const user = await client.getUser()
        
        return c.json({ user, authenticated: true })
      }
      
      return c.json({ user: null, authenticated: false })
    }
    
    const client = new TwitchClient(accessToken)
    const user = await client.getUser()
    
    return c.json({ user, authenticated: true })
    
  } catch (err) {
    console.error('Auth check error:', err)
    return c.json({ user: null, authenticated: false })
  }
})

// Logout
authRoutes.post('/logout', (c) => {
  setCookie(c, 'twitch_access_token', '', { maxAge: 0 })
  setCookie(c, 'twitch_refresh_token', '', { maxAge: 0 })
  
  return c.json({ success: true })
})
