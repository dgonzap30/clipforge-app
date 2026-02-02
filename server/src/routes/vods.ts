import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { TwitchClient, parseTwitchDuration } from '../lib/twitch'
import { verifySupabaseToken } from '../lib/supabase'

export const vodsRoutes = new Hono()

// Middleware to require auth using Supabase JWT Bearer token
const requireAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const { user, error } = await verifySupabaseToken(token)

    if (error || !user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401)
    }

    // Store user in context
    c.set('user', user)

    // Get Twitch access token from user metadata
    // Assuming Supabase Auth with Twitch OAuth stores the provider token in user_metadata
    const twitchAccessToken = user.user_metadata?.provider_token || user.user_metadata?.twitch_access_token

    if (!twitchAccessToken) {
      return c.json({ error: 'Twitch authentication required' }, 401)
    }

    c.set('accessToken', twitchAccessToken)
    c.set('twitchClient', new TwitchClient(twitchAccessToken))

    await next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

// Get VODs for the authenticated user
vodsRoutes.get('/mine', requireAuth, async (c) => {
  const client = c.get('twitchClient') as TwitchClient
  
  try {
    const user = await client.getUser()
    const { data: videos, pagination } = await client.getVideos(user.id, {
      type: 'archive',
      first: 20,
    })
    
    // Transform to our format
    const vods = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: parseTwitchDuration(v.duration),
      durationFormatted: v.duration,
      thumbnailUrl: v.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180'),
      url: v.url,
      viewCount: v.view_count,
      createdAt: v.created_at,
      streamId: v.stream_id,
    }))
    
    return c.json({ 
      vods, 
      pagination,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
      }
    })
    
  } catch (err) {
    console.error('Failed to fetch VODs:', err)
    return c.json({ error: 'Failed to fetch VODs' }, 500)
  }
})

// Get VODs for any channel by login
vodsRoutes.get('/channel/:login', requireAuth, zValidator('param', z.object({
  login: z.string().min(1),
})), async (c) => {
  const client = c.get('twitchClient') as TwitchClient
  const { login } = c.req.valid('param')
  
  try {
    const user = await client.getUserByLogin(login)
    
    if (!user) {
      return c.json({ error: 'Channel not found' }, 404)
    }
    
    const { data: videos, pagination } = await client.getVideos(user.id, {
      type: 'archive',
      first: 20,
    })
    
    const vods = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: parseTwitchDuration(v.duration),
      durationFormatted: v.duration,
      thumbnailUrl: v.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180'),
      url: v.url,
      viewCount: v.view_count,
      createdAt: v.created_at,
      streamId: v.stream_id,
    }))
    
    return c.json({ 
      vods, 
      pagination,
      channel: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
      }
    })
    
  } catch (err) {
    console.error('Failed to fetch channel VODs:', err)
    return c.json({ error: 'Failed to fetch VODs' }, 500)
  }
})

// Get specific VOD details
vodsRoutes.get('/:id', requireAuth, async (c) => {
  const client = c.get('twitchClient') as TwitchClient
  const videoId = c.req.param('id')
  
  try {
    const video = await client.getVideo(videoId)
    
    if (!video) {
      return c.json({ error: 'VOD not found' }, 404)
    }
    
    return c.json({
      id: video.id,
      title: video.title,
      description: video.description,
      duration: parseTwitchDuration(video.duration),
      durationFormatted: video.duration,
      thumbnailUrl: video.thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720'),
      url: video.url,
      viewCount: video.view_count,
      createdAt: video.created_at,
      streamId: video.stream_id,
      mutedSegments: video.muted_segments,
      channel: {
        id: video.user_id,
        login: video.user_login,
        displayName: video.user_name,
      }
    })
    
  } catch (err) {
    console.error('Failed to fetch VOD:', err)
    return c.json({ error: 'Failed to fetch VOD' }, 500)
  }
})

// Get existing Twitch clips for a channel (for training data / comparison)
vodsRoutes.get('/channel/:login/clips', requireAuth, async (c) => {
  const client = c.get('twitchClient') as TwitchClient
  const { login } = c.req.param()
  
  try {
    const user = await client.getUserByLogin(login)
    
    if (!user) {
      return c.json({ error: 'Channel not found' }, 404)
    }
    
    const { data: clips, pagination } = await client.getClips(user.id, {
      first: 50,
    })
    
    return c.json({ clips, pagination })
    
  } catch (err) {
    console.error('Failed to fetch clips:', err)
    return c.json({ error: 'Failed to fetch clips' }, 500)
  }
})
