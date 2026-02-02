import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { requireAuth, type AuthContext } from '../middleware/auth'
import {
  getAuthorizationUrl as getYouTubeAuthUrl,
  exchangeCodeForTokens as exchangeYouTubeTokens,
  refreshAccessToken as refreshYouTubeToken,
  YouTubeClient,
} from '../lib/youtube'
import { nanoid } from 'nanoid'

export const platformsRoutes = new Hono<AuthContext>()

// OAuth state storage (in production, use Redis or database)
const oauthStates = new Map<string, { userId: string; timestamp: number }>()

// Cleanup old states every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      oauthStates.delete(state)
    }
  }
}, 10 * 60 * 1000)

// Get all platform connections for the user
platformsRoutes.get('/connections', requireAuth, async (c) => {
  try {
    const user_id = c.get('userId')

    const { data: connections, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', user_id)

    if (error) {
      console.error('Error fetching platform connections:', error)
      return c.json({ error: 'Failed to fetch connections' }, 500)
    }

    // Return connections without sensitive tokens
    const safeConnections = (connections || []).map(conn => ({
      id: conn.id,
      platform: conn.platform,
      username: conn.username,
      connected_at: conn.connected_at,
    }))

    return c.json({ connections: safeConnections })
  } catch (error) {
    console.error('Unexpected error fetching connections:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// YouTube OAuth connect
platformsRoutes.get('/youtube/connect', requireAuth, async (c) => {
  try {
    const user_id = c.get('userId')

    // Generate state for CSRF protection
    const state = nanoid()
    oauthStates.set(state, { userId: user_id, timestamp: Date.now() })

    const authUrl = getYouTubeAuthUrl(state)

    return c.json({ url: authUrl })
  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error)
    return c.json({ error: 'Failed to initiate OAuth' }, 500)
  }
})

// YouTube OAuth callback
platformsRoutes.get('/youtube/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error) {
      return c.json({ error: `OAuth error: ${error}` }, 400)
    }

    if (!code || !state) {
      return c.json({ error: 'Missing code or state' }, 400)
    }

    // Verify state
    const stateData = oauthStates.get(state)
    if (!stateData) {
      return c.json({ error: 'Invalid or expired state' }, 400)
    }

    oauthStates.delete(state)
    const user_id = stateData.userId

    // Exchange code for tokens
    const tokens = await exchangeYouTubeTokens(code)

    // Get channel info
    const youtubeClient = new YouTubeClient(tokens.access_token)
    const channelData = await youtubeClient.getChannel()
    const channel = channelData.items?.[0]

    if (!channel) {
      return c.json({ error: 'Failed to fetch YouTube channel info' }, 500)
    }

    // Store connection in database
    const { error: dbError } = await supabase
      .from('platform_connections')
      .upsert({
        user_id,
        platform: 'youtube',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        username: channel.snippet.title,
        platform_user_id: channel.id,
        metadata: {
          customUrl: channel.snippet.customUrl,
          thumbnailUrl: channel.snippet.thumbnails?.default?.url,
        },
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform',
      })

    if (dbError) {
      console.error('Error storing YouTube connection:', dbError)
      return c.json({ error: 'Failed to store connection' }, 500)
    }

    // Return success with postMessage to close popup
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>YouTube Connected</title></head>
        <body>
          <script>
            window.opener.postMessage({ type: 'youtube-connected', success: true }, '*');
            window.close();
          </script>
          <p>YouTube connected successfully! You can close this window.</p>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Error in YouTube callback:', error)
    return c.json({ error: 'OAuth callback failed' }, 500)
  }
})

// Disconnect platform
platformsRoutes.delete('/:platform/disconnect', requireAuth, async (c) => {
  try {
    const user_id = c.get('userId')
    const platform = c.req.param('platform')

    if (!['youtube', 'tiktok', 'instagram'].includes(platform)) {
      return c.json({ error: 'Invalid platform' }, 400)
    }

    const { error } = await supabase
      .from('platform_connections')
      .delete()
      .eq('user_id', user_id)
      .eq('platform', platform)

    if (error) {
      console.error('Error disconnecting platform:', error)
      return c.json({ error: 'Failed to disconnect' }, 500)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Unexpected error disconnecting platform:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Helper function to get and refresh tokens if needed
export async function getPlatformTokens(userId: string, platform: string): Promise<{ accessToken: string; refreshToken: string | null } | null> {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()

  if (error || !connection) {
    return null
  }

  // Check if token is expired
  const expiresAt = new Date(connection.token_expires_at)
  const now = new Date()

  if (expiresAt <= now && connection.refresh_token) {
    // Refresh token
    try {
      let newTokens

      if (platform === 'youtube') {
        newTokens = await refreshYouTubeToken(connection.refresh_token)
      } else {
        throw new Error(`Refresh not implemented for platform: ${platform}`)
      }

      // Update tokens in database
      await supabase
        .from('platform_connections')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId)
        .eq('platform', platform)

      return {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || connection.refresh_token,
      }
    } catch (refreshError) {
      console.error('Error refreshing token:', refreshError)
      return null
    }
  }

  return {
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
  }
}
