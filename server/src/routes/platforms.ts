import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { requireAuth, type AuthContext } from '../middleware/auth'
import * as instagram from '../lib/instagram'
import * as tiktok from '../lib/tiktok'
import { TikTokClient } from '../lib/tiktok'

const platformsRoutes = new Hono<AuthContext>()

// Apply auth middleware to all routes except OAuth callbacks
platformsRoutes.use('*', async (c, next) => {
  // Skip auth for OAuth callbacks
  if (c.req.path.includes('/callback')) {
    return next()
  }
  return requireAuth(c, next)
})

// Get all platform connections for the current user
platformsRoutes.get('/connections', async (c) => {
  const user_id = c.get('user_id')

  try {
    // Get TikTok connection from platform_connections table
    const { data: tiktokConnection, error: tiktokError } = await supabase
      .from('platform_connections')
      .select('id, platform, account_metadata, created_at, updated_at')
      .eq('user_id', user_id)
      .eq('platform', 'tiktok')
      .single()

    // Get Instagram connection from user metadata
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(user_id)

    const instagramData = (!userError && user) ? user.user.user_metadata?.instagram : null

    const connections = {
      tiktok: tiktokConnection || null,
      youtube: null,
      instagram: instagramData ? {
        connected: true,
        igUserId: instagramData.ig_user_id,
        igUsername: instagramData.ig_username,
        expiresAt: instagramData.expires_at,
        connectedAt: instagramData.connected_at,
      } : {
        connected: false,
      },
    }

    return c.json(connections)
  } catch (error: Error | unknown) {
    console.error('Unexpected error fetching platform connections:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Instagram OAuth - Initiate connection
platformsRoutes.get('/instagram/connect', async (c) => {
  const state = crypto.randomUUID()

  // Store state in session for verification
  // Note: In production, store this in Redis or database
  // For now, we'll verify it on callback

  const authUrl = instagram.getAuthorizationUrl(state)

  return c.json({ authUrl, state })
})

// Instagram OAuth - Handle callback
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
platformsRoutes.post('/instagram/save', async (c) => {
  const user_id = c.get('user_id')
  const body = await c.req.json()

  const { accessToken, igUserId, igUsername, expiresAt } = body

  if (!accessToken || !igUserId || !igUsername || !expiresAt) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    // Store in user metadata
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

// Disconnect Instagram
platformsRoutes.delete('/instagram/disconnect', async (c) => {
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
platformsRoutes.post('/instagram/refresh-token', async (c) => {
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

// TikTok OAuth - Initiate connection
platformsRoutes.get('/tiktok/connect', async (c) => {
  const user_id = c.get('user_id')

  // Generate state parameter for CSRF protection
  const state = `${user_id}_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // Store state in session or database for validation in callback
  // For now, we'll include user_id in state (in production, use encrypted state)

  const authUrl = tiktok.getAuthorizationUrl(state)

  return c.redirect(authUrl)
})

// TikTok OAuth - Handle callback
platformsRoutes.get('/tiktok/callback', zValidator('query', z.object({
  code: z.string(),
  state: z.string(),
})), async (c) => {
  const { code, state } = c.req.valid('query')

  try {
    // Extract user_id from state (in production, verify state properly)
    const user_id = state.split('_')[0]

    if (!user_id) {
      return c.json({ error: 'Invalid state parameter' }, 400)
    }

    // Exchange code for tokens
    const tokens = await tiktok.exchangeCodeForTokens(code)

    // Get user info from TikTok
    const tiktokClient = new TikTokClient(tokens.access_token)
    const userInfo = await tiktokClient.getUserInfo()

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Store tokens in database (upsert)
    const { error } = await supabase
      .from('platform_connections')
      .upsert({
        user_id,
        platform: 'tiktok',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        account_metadata: {
          open_id: userInfo.open_id,
          union_id: userInfo.union_id,
          display_name: userInfo.display_name,
          avatar_url: userInfo.avatar_url,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform',
      })

    if (error) {
      console.error('Error storing TikTok connection:', error)
      return c.json({ error: 'Failed to store connection' }, 500)
    }

    // Redirect back to frontend settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    return c.redirect(`${frontendUrl}/settings?tiktok=connected`)
  } catch (error: Error | unknown) {
    console.error('Error in TikTok OAuth callback:', error)
    return c.json({ error: error instanceof Error ? error.message : 'OAuth callback failed' }, 500)
  }
})

// Disconnect platform
platformsRoutes.post('/disconnect', zValidator('json', z.object({
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
})), async (c) => {
  const user_id = c.get('user_id')
  const { platform } = c.req.valid('json')

  try {
    if (platform === 'instagram') {
      // Handle Instagram disconnect via user metadata
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
        return c.json({ error: 'Failed to disconnect platform' }, 500)
      }
    } else {
      // Handle TikTok/YouTube via platform_connections table
      const { error } = await supabase
        .from('platform_connections')
        .delete()
        .eq('user_id', user_id)
        .eq('platform', platform)

      if (error) {
        console.error('Error disconnecting platform:', error)
        return c.json({ error: 'Failed to disconnect platform' }, 500)
      }
    }

    return c.json({ success: true })
  } catch (error: Error | unknown) {
    console.error('Unexpected error disconnecting platform:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Refresh TikTok access token (internal endpoint, called when token is expired)
export async function refreshTikTokToken(userId: string): Promise<string | null> {
  try {
    // Fetch current connection
    const { data: connection, error: fetchError } = await supabase
      .from('platform_connections')
      .select('refresh_token, access_token')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (fetchError || !connection?.refresh_token) {
      console.error('Error fetching TikTok connection for refresh:', fetchError)
      return null
    }

    // Refresh token
    const tokens = await tiktok.refreshAccessToken(connection.refresh_token)

    // Calculate new expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Update database
    const { error: updateError } = await supabase
      .from('platform_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('platform', 'tiktok')

    if (updateError) {
      console.error('Error updating refreshed TikTok token:', updateError)
      return null
    }

    return tokens.access_token
  } catch (error) {
    console.error('Error refreshing TikTok token:', error)
    return null
  }
}

export default platformsRoutes
