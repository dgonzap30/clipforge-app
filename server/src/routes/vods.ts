import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { TwitchClient, parseTwitchDuration, getAppAccessToken } from '../lib/twitch'
import { supabase, verifySupabaseToken } from '../lib/supabase'
import '../middleware/auth' // Side-effect import for ContextVariableMap

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

    // Use app access token for Twitch API calls
    // VOD data is public, so we don't need user-specific tokens
    const appToken = await getAppAccessToken()
    c.set('twitchClient', new TwitchClient(appToken))

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

    const supabaseUserId = c.get('user')!.id

    // Upsert VODs to Supabase first
    let vodMap: Record<string, string> = {} // twitchVodId -> dbUuid

    if (videos.length > 0) {
      const vodsForDb = videos.map(v => ({
        twitch_vod_id: v.id,
        user_id: supabaseUserId,
        title: v.title,
        channel_login: v.user_login,
        duration_seconds: parseTwitchDuration(v.duration),
        duration_formatted: v.duration,
        thumbnail_url: v.thumbnail_url,
        twitch_url: v.url,
        view_count: v.view_count,
        stream_id: v.stream_id,
        twitch_created_at: v.created_at,
      }))

      const { data: upsertedVods, error: upsertError } = await supabase
        .from('vods')
        .upsert(vodsForDb, { onConflict: 'twitch_vod_id' })
        .select('id, twitch_vod_id')

      if (upsertError) {
        console.error('Failed to upsert VODs to database:', upsertError)
        // Continue even if upsert fails - we still return the data from Twitch
      } else if (upsertedVods) {
        vodMap = Object.fromEntries(
          upsertedVods.map(v => [v.twitch_vod_id, v.id])
        )
      }
    }

    // Transform to our format with DB UUIDs
    const vods = videos.map(v => ({
      id: vodMap[v.id] || v.id, // Use DB UUID if available, fall back to Twitch ID
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

    const { data: videos, pagination} = await client.getVideos(user.id, {
      type: 'archive',
      first: 20,
    })

    const supabaseUserId = c.get('user')!.id

    // Upsert VODs to Supabase first
    let vodMap: Record<string, string> = {} // twitchVodId -> dbUuid

    if (videos.length > 0) {
      const vodsForDb = videos.map(v => ({
        twitch_vod_id: v.id,
        user_id: supabaseUserId,
        title: v.title,
        channel_login: v.user_login,
        duration_seconds: parseTwitchDuration(v.duration),
        duration_formatted: v.duration,
        thumbnail_url: v.thumbnail_url,
        twitch_url: v.url,
        view_count: v.view_count,
        stream_id: v.stream_id,
        twitch_created_at: v.created_at,
      }))

      const { data: upsertedVods, error: upsertError } = await supabase
        .from('vods')
        .upsert(vodsForDb, { onConflict: 'twitch_vod_id' })
        .select('id, twitch_vod_id')

      if (upsertError) {
        console.error('Failed to upsert VODs to database:', upsertError)
        // Continue even if upsert fails - we still return the data from Twitch
      } else if (upsertedVods) {
        vodMap = Object.fromEntries(
          upsertedVods.map(v => [v.twitch_vod_id, v.id])
        )
      }
    }

    // Transform to our format with DB UUIDs
    const vods = videos.map(v => ({
      id: vodMap[v.id] || v.id, // Use DB UUID if available, fall back to Twitch ID
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

    const supabaseUserId = c.get('user')!.id

    // Upsert single VOD to Supabase
    const vodForDb = {
      twitch_vod_id: video.id,
      user_id: supabaseUserId,
      title: video.title,
      channel_login: video.user_login,
      duration_seconds: parseTwitchDuration(video.duration),
      duration_formatted: video.duration,
      thumbnail_url: video.thumbnail_url,
      twitch_url: video.url,
      view_count: video.view_count,
      stream_id: video.stream_id,
      twitch_created_at: video.created_at,
    }

    const { data: upsertedVod, error: upsertError } = await supabase
      .from('vods')
      .upsert([vodForDb], { onConflict: 'twitch_vod_id' })
      .select('id')
      .single()

    if (upsertError) {
      console.error('Failed to upsert VOD to database:', upsertError)
      // Continue even if upsert fails - we still return the data from Twitch
    }

    const dbId = upsertedVod?.id || video.id // Use DB UUID if available

    return c.json({
      id: dbId,
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
