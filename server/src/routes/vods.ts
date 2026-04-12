import { Hono, type Context, type Next } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { TwitchClient, parseTwitchDuration, getAppAccessToken } from '../lib/twitch'
import { supabase } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

export const vodsRoutes = new Hono()

// Middleware to setup Twitch client
const setupTwitchClient = async (c: Context, next: Next) => {
  try {
    // Use app access token for Twitch API calls
    const appToken = await getAppAccessToken()
    c.set('twitchClient', new TwitchClient(appToken))
    await next()
  } catch (err) {
    console.error('Twitch client setup error:', err)
    return c.json({ error: 'Failed to connect to Twitch' }, 500)
  }
}

// Apply middleware to all routes
vodsRoutes.use('*', requireAuth, setupTwitchClient)

// Get VODs for the authenticated user
vodsRoutes.get('/mine', async (c) => {
  const client = c.get('twitchClient') as TwitchClient

  try {
    const user = await client.getUser()
    const { data: videos, pagination } = await client.getVideos(user.id, {
      type: 'archive',
      first: 20,
    })

    // Cache VODs in Supabase as a shared reference. Writes do not set user_id,
    // so caching one user's VODs never clobbers another user's ownership.
    let vodMap: Record<string, string> = {}

    if (videos.length > 0) {
      const vodsForDb = videos.map((v) => ({
        twitch_vod_id: v.id,
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

      const { error: insertError } = await supabase
        .from('vods')
        .upsert(vodsForDb, { onConflict: 'twitch_vod_id', ignoreDuplicates: true })

      if (insertError) {
        console.error('Failed to cache VODs in database:', insertError)
      }

      const { data: fetchedVods, error: selectError } = await supabase
        .from('vods')
        .select('id, twitch_vod_id')
        .in(
          'twitch_vod_id',
          videos.map((v) => v.id)
        )

      if (selectError) {
        console.error('Failed to fetch VOD UUIDs:', selectError)
      } else if (fetchedVods) {
        vodMap = Object.fromEntries(fetchedVods.map((v) => [v.twitch_vod_id, v.id]))
      }
    }

    // Transform to our format with DB UUIDs
    const vods = videos.map((v) => ({
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
      },
    })
  } catch (err) {
    console.error('Failed to fetch VODs:', err)
    return c.json({ error: 'Failed to fetch VODs' }, 500)
  }
})

// Get VODs for any channel by login
vodsRoutes.get(
  '/channel/:login',
  zValidator(
    'param',
    z.object({
      login: z.string().min(1),
    })
  ),
  async (c) => {
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

      // Cache VODs in Supabase as a shared reference (see /mine for rationale).
      let vodMap: Record<string, string> = {}

      if (videos.length > 0) {
        const vodsForDb = videos.map((v) => ({
          twitch_vod_id: v.id,
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

        const { error: insertError } = await supabase
          .from('vods')
          .upsert(vodsForDb, { onConflict: 'twitch_vod_id', ignoreDuplicates: true })

        if (insertError) {
          console.error('Failed to cache VODs in database:', insertError)
        }

        const { data: fetchedVods, error: selectError } = await supabase
          .from('vods')
          .select('id, twitch_vod_id')
          .in(
            'twitch_vod_id',
            videos.map((v) => v.id)
          )

        if (selectError) {
          console.error('Failed to fetch VOD UUIDs:', selectError)
        } else if (fetchedVods) {
          vodMap = Object.fromEntries(fetchedVods.map((v) => [v.twitch_vod_id, v.id]))
        }
      }

      // Transform to our format with DB UUIDs
      const vods = videos.map((v) => ({
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
        },
      })
    } catch (err) {
      console.error('Failed to fetch channel VODs:', err)
      return c.json({ error: 'Failed to fetch VODs' }, 500)
    }
  }
)

// Get specific VOD details
vodsRoutes.get('/:id', async (c) => {
  const client = c.get('twitchClient') as TwitchClient
  const videoId = c.req.param('id')

  try {
    const video = await client.getVideo(videoId)

    if (!video) {
      return c.json({ error: 'VOD not found' }, 404)
    }

    // Cache VOD as a shared reference; do not write user_id.
    const vodForDb = {
      twitch_vod_id: video.id,
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

    const { error: insertError } = await supabase
      .from('vods')
      .upsert([vodForDb], { onConflict: 'twitch_vod_id', ignoreDuplicates: true })

    if (insertError) {
      console.error('Failed to cache VOD in database:', insertError)
    }

    const { data: fetchedVod } = await supabase
      .from('vods')
      .select('id')
      .eq('twitch_vod_id', video.id)
      .maybeSingle()

    const dbId = fetchedVod?.id || video.id // Use DB UUID if available

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
      },
    })
  } catch (err) {
    console.error('Failed to fetch VOD:', err)
    return c.json({ error: 'Failed to fetch VOD' }, 500)
  }
})

// Get existing Twitch clips for a channel (for training data / comparison)
vodsRoutes.get('/channel/:login/clips', async (c) => {
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
