import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { requireAuth, type AuthContext } from '../middleware/auth'
import * as instagram from '../lib/instagram'

export const platformsRoutes = new Hono<AuthContext>()

// Instagram OAuth flow
platformsRoutes.get('/instagram/connect', requireAuth, async (c) => {
  const state = crypto.randomUUID()

  // Store state in session for verification
  // Note: In production, store this in Redis or database
  // For now, we'll verify it on callback

  const authUrl = instagram.getAuthorizationUrl(state)

  return c.json({ authUrl, state })
})

platformsRoutes.get('/instagram/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connection Failed</title>
        </head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'instagram-auth-error',
              error: '${error}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `)
  }

  if (!code || !state) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connection Failed</title>
        </head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'instagram-auth-error',
              error: 'Missing code or state'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `)
  }

  try {
    // Exchange code for short-lived token
    const shortLivedToken = await instagram.exchangeCodeForTokens(code)

    // Exchange for long-lived token (60 days)
    const longLivedToken = await instagram.getLongLivedToken(shortLivedToken.access_token)

    // Get Instagram Business Account
    const igAccount = await instagram.getInstagramBusinessAccount(longLivedToken.access_token)

    if (!igAccount) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Instagram Connection Failed</title>
          </head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'instagram-auth-error',
                error: 'No Instagram Business Account found. Please connect your Instagram account to a Facebook Page first.'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `)
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000)

    // Return success with connection data
    // The frontend will handle storing this via authenticated API call
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connected Successfully</title>
        </head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'instagram-auth-success',
              data: {
                accessToken: '${longLivedToken.access_token}',
                igUserId: '${igAccount.id}',
                igUsername: '${igAccount.username}',
                expiresAt: '${expiresAt.toISOString()}',
                state: '${state}'
              }
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('Instagram OAuth error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connection Failed</title>
        </head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'instagram-auth-error',
              error: '${errorMessage.replace(/'/g, "\\'")}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `)
  }
})

// Store Instagram connection (called by frontend after OAuth)
platformsRoutes.post('/instagram/save', requireAuth, async (c) => {
  const user_id = c.get('user_id')
  const body = await c.req.json()

  const { accessToken, igUserId, igUsername, expiresAt } = body

  if (!accessToken || !igUserId || !igUsername || !expiresAt) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    // Store in user metadata or dedicated platform_connections table
    // For now, we'll use Supabase auth user metadata
    const { error } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: {
        instagram: {
          access_token: accessToken,
          ig_user_id: igUserId,
          ig_username: igUsername,
          expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
      },
    })

    if (error) {
      console.error('Error saving Instagram connection:', error)
      return c.json({ error: 'Failed to save connection' }, 500)
    }

    return c.json({
      success: true,
      igUserId,
      igUsername,
    })
  } catch (err) {
    console.error('Unexpected error saving Instagram connection:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get platform connections status
platformsRoutes.get('/connections', requireAuth, async (c) => {
  const user_id = c.get('user_id')

  try {
    // Get user metadata
    const { data: user, error } = await supabase.auth.admin.getUserById(user_id)

    if (error || !user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const instagram = user.user.user_metadata?.instagram

    const connections = {
      instagram: instagram ? {
        connected: true,
        igUserId: instagram.ig_user_id,
        igUsername: instagram.ig_username,
        expiresAt: instagram.expires_at,
        connectedAt: instagram.connected_at,
      } : {
        connected: false,
      },
    }

    return c.json(connections)
  } catch (err) {
    console.error('Unexpected error fetching connections:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Disconnect Instagram
platformsRoutes.delete('/instagram/disconnect', requireAuth, async (c) => {
  const user_id = c.get('user_id')

  try {
    // Remove Instagram from user metadata
    const { data: user, error: fetchError } = await supabase.auth.admin.getUserById(user_id)

    if (fetchError || !user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const metadata = { ...user.user.user_metadata }
    delete metadata.instagram

    const { error } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: metadata,
    })

    if (error) {
      console.error('Error disconnecting Instagram:', error)
      return c.json({ error: 'Failed to disconnect' }, 500)
    }

    return c.json({ success: true })
  } catch (err) {
    console.error('Unexpected error disconnecting Instagram:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Refresh Instagram token
platformsRoutes.post('/instagram/refresh-token', requireAuth, async (c) => {
  const user_id = c.get('user_id')

  try {
    // Get current token from user metadata
    const { data: user, error: fetchError } = await supabase.auth.admin.getUserById(user_id)

    if (fetchError || !user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const instagramData = user.user.user_metadata?.instagram

    if (!instagramData?.access_token) {
      return c.json({ error: 'Instagram not connected' }, 400)
    }

    // Refresh the long-lived token
    const refreshedToken = await instagram.refreshLongLivedToken(instagramData.access_token)

    const expiresAt = new Date(Date.now() + refreshedToken.expires_in * 1000)

    // Update user metadata with new token
    const { error } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: {
        ...user.user.user_metadata,
        instagram: {
          ...instagramData,
          access_token: refreshedToken.access_token,
          expires_at: expiresAt.toISOString(),
        },
      },
    })

    if (error) {
      console.error('Error updating refreshed token:', error)
      return c.json({ error: 'Failed to update token' }, 500)
    }

    return c.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('Unexpected error refreshing token:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
