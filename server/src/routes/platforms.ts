import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import * as tiktok from '../lib/tiktok'

const platformsRoutes = new Hono()

// Apply auth middleware to all routes
platformsRoutes.use('*', requireAuth)

// Get all platform connections for the current user
platformsRoutes.get('/connections', async (c) => {
  const user_id = c.get('user_id')

  try {
    const { data: connections, error } = await supabase
      .from('platform_connections')
      .select('id, platform, account_metadata, created_at, updated_at')
      .eq('user_id', user_id)

    if (error) {
      console.error('Error fetching platform connections:', error)
      return c.json({ error: 'Failed to fetch platform connections' }, 500)
    }

    // Return connections mapped by platform
    const connectionsMap = {
      tiktok: connections?.find(conn => conn.platform === 'tiktok') || null,
      youtube: connections?.find(conn => conn.platform === 'youtube') || null,
      instagram: connections?.find(conn => conn.platform === 'instagram') || null,
    }

    return c.json(connectionsMap)
  } catch (error: Error | unknown) {
    console.error('Unexpected error fetching platform connections:', error)
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
    const tiktokClient = new tiktok.TikTokClient(tokens.access_token)
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
    const { error } = await supabase
      .from('platform_connections')
      .delete()
      .eq('user_id', user_id)
      .eq('platform', platform)

    if (error) {
      console.error('Error disconnecting platform:', error)
      return c.json({ error: 'Failed to disconnect platform' }, 500)
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
