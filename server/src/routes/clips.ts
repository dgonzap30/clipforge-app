import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { clips as clipsStorage } from '../lib/storage'
import { requireAuth, type AuthContext } from '../middleware/auth'
import { InstagramClient } from '../lib/instagram'
import { TikTokClient } from '../lib/tiktok'
import { refreshTikTokToken } from './platforms'
import { getPlatformTokens } from './platforms'
import { YouTubeClient } from '../lib/youtube'

export const clipsRoutes = new Hono<AuthContext>()

// Apply auth middleware to all routes
clipsRoutes.use('*', requireAuth)

// Schemas
const createClipSchema = z.object({
  jobId: z.string(),
  vodId: z.string(),
  title: z.string().min(1).max(200),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  hydeScore: z.number().min(0).max(100),
  signals: z.object({
    chatVelocity: z.number().optional(),
    audioPeak: z.number().optional(),
    faceReaction: z.number().optional(),
    viewerClips: z.number().optional(),
  }),
})

const updateClipSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['processing', 'ready', 'exported', 'failed']).optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
})

/**
 * Helper function to add signed URLs to clip records
 */
async function addSignedUrls(clip: any) {
  const videoUrl = clip.video_path
    ? await clipsStorage.getSignedUrl(clip.video_path)
    : null

  const thumbnailUrl = clip.thumbnail_path
    ? await clipsStorage.getSignedUrl(clip.thumbnail_path)
    : null

  return {
    id: clip.id,
    jobId: clip.job_id,
    vodId: clip.vod_id,
    title: clip.title,
    startTime: clip.start_time,
    endTime: clip.end_time,
    duration: clip.duration,
    status: clip.status,
    hydeScore: clip.hyde_score,
    signals: clip.signals,
    videoUrl,
    thumbnailUrl,
    exportedTo: clip.exported_to || [],
    createdAt: clip.created_at,
    updatedAt: clip.updated_at,
  }
}

// List all clips
clipsRoutes.get('/', async (c) => {
  const user_id = c.get('user_id')
  const { status, limit = '50', offset = '0' } = c.req.query()

  try {
    let query = supabase
      .from('clips')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    // Paginate
    const limitNum = parseInt(limit)
    const offsetNum = parseInt(offset)
    query = query.range(offsetNum, offsetNum + limitNum - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching clips:', error)
      return c.json({ error: 'Failed to fetch clips' }, 500)
    }

    // Add signed URLs to all clips
    const clipsWithUrls = await Promise.all(
      (data || []).map(clip => addSignedUrls(clip))
    )

    return c.json({
      clips: clipsWithUrls,
      total: count || 0,
      hasMore: count ? offsetNum + limitNum < count : false,
    })
  } catch (error: Error | unknown) {
    console.error('Unexpected error fetching clips:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get single clip
clipsRoutes.get('/:id', async (c) => {
  const user_id = c.get('user_id')
  const id = c.req.param('id')

  try {
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single()

    if (error || !data) {
      return c.json({ error: 'Clip not found' }, 404)
    }

    // Add signed URLs
    const clipWithUrls = await addSignedUrls(data)

    return c.json(clipWithUrls)
  } catch (error: Error | unknown) {
    console.error('Unexpected error fetching clip:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get signed URL for clip video
clipsRoutes.get('/:id/signed-url', async (c) => {
  const user_id = c.get('user_id')
  const id = c.req.param('id')

  try {
    // Fetch clip from database
    const { data: clip, error } = await supabase
      .from('clips')
      .select('status, video_path')
      .eq('id', id)
      .eq('user_id', user_id)
      .single()

    if (error || !clip) {
      return c.json({ error: 'Clip not found' }, 404)
    }

    if (clip.status !== 'ready') {
      return c.json({ error: 'Clip not ready for playback' }, 400)
    }

    if (!clip.video_path) {
      return c.json({ error: 'Video URL not available' }, 404)
    }

    // Generate signed URL from storage
    const result = await clipsStorage.getSignedUrl(clip.video_path)

    if (!result.success || !result.url) {
      return c.json({ error: 'Failed to generate signed URL' }, 500)
    }

    const expiresIn = 3600 // 1 hour in seconds

    return c.json({
      url: result.url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      expiresIn,
    })
  } catch (error: Error | unknown) {
    console.error('Unexpected error generating signed URL:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create clip (called by processing pipeline)
clipsRoutes.post('/', zValidator('json', createClipSchema), async (c) => {
  const user_id = c.get('user_id')
  const data = c.req.valid('json')

  try {
    const clipId = crypto.randomUUID()

    const { data: clip, error } = await supabase
      .from('clips')
      .insert({
        id: clipId,
        user_id,
        job_id: data.jobId,
        vod_id: data.vodId,
        title: data.title,
        start_time: data.startTime,
        end_time: data.endTime,
        status: 'processing',
        hyde_score: data.hydeScore,
        signals: data.signals,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating clip:', error)
      return c.json({ error: 'Failed to create clip' }, 500)
    }

    // Add signed URLs
    const clipWithUrls = await addSignedUrls(clip)

    return c.json(clipWithUrls, 201)
  } catch (error: Error | unknown) {
    console.error('Unexpected error creating clip:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Update clip
clipsRoutes.patch('/:id', zValidator('json', updateClipSchema), async (c) => {
  const user_id = c.get('user_id')
  const id = c.req.param('id')
  const updates = c.req.valid('json')

  try {
    // First verify the clip belongs to the user
    const { data: existingClip, error: fetchError } = await supabase
      .from('clips')
      .select('id')
      .eq('id', id)
      .eq('user_id', user_id)
      .single()

    if (fetchError || !existingClip) {
      return c.json({ error: 'Clip not found' }, 404)
    }

    // Map camelCase fields to snake_case for database
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.title !== undefined) {
      dbUpdates.title = updates.title
    }
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status
    }
    if (updates.videoUrl !== undefined) {
      // Note: videoUrl here is expected to be a storage path, not a signed URL
      dbUpdates.video_path = updates.videoUrl
    }
    if (updates.thumbnailUrl !== undefined) {
      // Note: thumbnailUrl here is expected to be a storage path, not a signed URL
      dbUpdates.thumbnail_path = updates.thumbnailUrl
    }

    const { data: clip, error: updateError } = await supabase
      .from('clips')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single()

    if (updateError || !clip) {
      console.error('Error updating clip:', updateError)
      return c.json({ error: 'Failed to update clip' }, 500)
    }

    // Add signed URLs
    const clipWithUrls = await addSignedUrls(clip)

    return c.json(clipWithUrls)
  } catch (error: Error | unknown) {
    console.error('Unexpected error updating clip:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Delete clip
clipsRoutes.delete('/:id', async (c) => {
  const user_id = c.get('user_id')
  const id = c.req.param('id')

  try {
    // Fetch the clip to get file paths before deleting
    const { data: clip, error: fetchError } = await supabase
      .from('clips')
      .select('video_path, thumbnail_path')
      .eq('id', id)
      .eq('user_id', user_id)
      .single()

    if (fetchError || !clip) {
      return c.json({ error: 'Clip not found' }, 404)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('clips')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)

    if (deleteError) {
      console.error('Error deleting clip:', deleteError)
      return c.json({ error: 'Failed to delete clip' }, 500)
    }

    // Delete associated files from storage (fire and forget)
    if (clip.video_path) {
      clipsStorage.delete(clip.video_path).catch(err =>
        console.error('Error deleting video file:', err)
      )
    }
    if (clip.thumbnail_path) {
      clipsStorage.delete(clip.thumbnail_path).catch(err =>
        console.error('Error deleting thumbnail file:', err)
      )
    }

    return c.json({ success: true })
  } catch (error: Error | unknown) {
    console.error('Unexpected error deleting clip:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Bulk actions
clipsRoutes.post('/bulk/delete', zValidator('json', z.object({
  ids: z.array(z.string()),
})), async (c) => {
  const user_id = c.get('user_id')
  const { ids } = c.req.valid('json')

  try {
    // Fetch clips to get file paths
    const { data: clips, error: fetchError } = await supabase
      .from('clips')
      .select('id, video_path, thumbnail_path')
      .eq('user_id', user_id)
      .in('id', ids)

    if (fetchError) {
      console.error('Error fetching clips for deletion:', fetchError)
      return c.json({ error: 'Failed to fetch clips' }, 500)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('clips')
      .delete()
      .eq('user_id', user_id)
      .in('id', ids)

    if (deleteError) {
      console.error('Error bulk deleting clips:', deleteError)
      return c.json({ error: 'Failed to delete clips' }, 500)
    }

    // Delete associated files from storage (fire and forget)
    for (const clip of clips || []) {
      if (clip.video_path) {
        clipsStorage.delete(clip.video_path).catch(err =>
          console.error('Error deleting video file:', err)
        )
      }
      if (clip.thumbnail_path) {
        clipsStorage.delete(clip.thumbnail_path).catch(err =>
          console.error('Error deleting thumbnail file:', err)
        )
      }
    }

    return c.json({ deleted: clips?.length || 0 })
  } catch (error: Error | unknown) {
    console.error('Unexpected error bulk deleting clips:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

clipsRoutes.post('/bulk/export', zValidator('json', z.object({
  ids: z.array(z.string()),
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
  caption: z.string().optional(),
  shareToFeed: z.boolean().optional(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    privacyStatus: z.enum(['public', 'private', 'unlisted']).optional(),
  }).optional(),
})), async (c) => {
  const user_id = c.get('user_id')
  const { ids, platform, caption, shareToFeed, metadata } = c.req.valid('json')

  try {
    // Fetch clips that are ready for export with their video paths
    const { data: clips, error: fetchError } = await supabase
      .from('clips')
      .select('id, title, status, exported_to, video_path')
      .eq('user_id', user_id)
      .eq('status', 'ready')
      .in('id', ids)

    if (fetchError) {
      console.error('Error fetching clips for export:', fetchError)
      return c.json({ error: 'Failed to fetch clips' }, 500)
    }

    if (!clips || clips.length === 0) {
      return c.json({ error: 'No clips found ready for export' }, 404)
    }

    const exported: string[] = []
    const errors: Array<{ clipId: string; error: string }> = []

    // Process each clip
    for (const clip of clips) {
      const exportedTo = clip.exported_to || []

      // Skip if already exported to this platform
      if (exportedTo.includes(platform)) {
        continue
      }

      try {
        // Handle YouTube export
        if (platform === 'youtube') {
          // Get platform tokens
          const tokens = await getPlatformTokens(user_id, platform)

          if (!tokens) {
            errors.push({ clipId: clip.id, error: 'YouTube not connected or token expired' })
            continue
          }

          // Download clip file to temporary location for upload
          if (!clip.video_path) {
            errors.push({ clipId: clip.id, error: 'No video file found' })
            continue
          }

          const signedUrl = await clipsStorage.getSignedUrl(clip.video_path)
          if (!signedUrl) {
            errors.push({ clipId: clip.id, error: 'Failed to get video URL' })
            continue
          }

          // Download file to temp location
          const response = await fetch(signedUrl)
          if (!response.ok) {
            errors.push({ clipId: clip.id, error: 'Failed to download video' })
            continue
          }

          const videoBuffer = await response.arrayBuffer()
          const tempPath = `/tmp/${clip.id}.mp4`
          await Bun.write(tempPath, videoBuffer)

          // Upload to YouTube
          const youtubeClient = new YouTubeClient(tokens.accessToken)

          await youtubeClient.uploadVideo(tempPath, {
            title: metadata?.title || clip.title,
            description: metadata?.description || `Clip from ${clip.title}`,
            tags: metadata?.tags || ['#Shorts'],
            categoryId: '20', // Gaming
            privacyStatus: metadata?.privacyStatus || 'public',
          })

          // Clean up temp file
          await Bun.write(tempPath, '')

          // Update clip with export status
          exportedTo.push(platform)

          const { error: updateError } = await supabase
            .from('clips')
            .update({
              status: 'exported',
              exported_to: exportedTo,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clip.id)
            .eq('user_id', user_id)

          if (!updateError) {
            exported.push(clip.id)
          } else {
            console.error('Error updating clip export status:', updateError)
            errors.push({ clipId: clip.id, error: 'Failed to update clip status' })
          }
        } else if (platform === 'instagram') {
          // Get user's Instagram connection
          const { data: user, error: userError } = await supabase.auth.admin.getUserById(user_id)

          if (userError || !user) {
            errors.push({ clipId: clip.id, error: 'Failed to get user data' })
            continue
          }

          const instagramData = user.user.user_metadata?.instagram

          if (!instagramData?.access_token || !instagramData?.ig_user_id) {
            errors.push({ clipId: clip.id, error: 'Instagram not connected' })
            continue
          }

          if (!clip.video_path) {
            errors.push({ clipId: clip.id, error: 'Video not available' })
            continue
          }

          // Create Instagram client
          const igClient = new InstagramClient(instagramData.access_token, instagramData.ig_user_id)

          // Generate long-lived signed URL (24 hours) for Instagram
          const signedUrlResult = await clipsStorage.getSignedUrl(clip.video_path, 86400)

          if (!signedUrlResult.success || !signedUrlResult.url) {
            errors.push({ clipId: clip.id, error: 'Failed to generate video URL' })
            continue
          }

          // Upload to Instagram
          const uploadResult = await igClient.uploadReels({
            videoUrl: signedUrlResult.url,
            caption: caption || clip.title,
            shareToFeed: shareToFeed ?? true,
          })

          // Update clip with Instagram media ID
          exportedTo.push('instagram')

          const { error: updateError } = await supabase
            .from('clips')
            .update({
              status: 'exported',
              exported_to: exportedTo,
              instagram_media_id: uploadResult.mediaId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clip.id)
            .eq('user_id', user_id)

          if (!updateError) {
            exported.push(clip.id)
          } else {
            console.error('Error updating clip export status:', updateError)
            errors.push({ clipId: clip.id, error: 'Failed to update clip status' })
          }
        } else if (platform === 'tiktok') {
          // Get TikTok connection for user
          const { data: connection, error: connError } = await supabase
            .from('platform_connections')
            .select('access_token, refresh_token, token_expires_at')
            .eq('user_id', user_id)
            .eq('platform', 'tiktok')
            .single()

          if (connError || !connection) {
            errors.push({ clipId: clip.id, error: 'TikTok not connected' })
            continue
          }

          // Check if token is expired and refresh if needed
          let accessToken = connection.access_token
          const expiresAt = new Date(connection.token_expires_at)

          if (expiresAt < new Date()) {
            const refreshedToken = await refreshTikTokToken(user_id)
            if (!refreshedToken) {
              errors.push({ clipId: clip.id, error: 'Failed to refresh TikTok token' })
              continue
            }
            accessToken = refreshedToken
          }

          // Download video from storage
          const videoBlob = await clipsStorage.download(clip.video_path)
          if (!videoBlob) {
            errors.push({ clipId: clip.id, error: 'Failed to download video' })
            continue
          }

          // Save video to temporary file
          const fs = await import('fs/promises')
          const path = await import('path')
          const os = await import('os')

          const tmpDir = os.tmpdir()
          const tmpFilePath = path.join(tmpDir, `${clip.id}.mp4`)

          const buffer = await videoBlob.arrayBuffer()
          await fs.writeFile(tmpFilePath, new Uint8Array(buffer))

          try {
            // Upload to TikTok
            const tiktokClient = new TikTokClient(accessToken)
            const publishId = await tiktokClient.uploadVideo({
              videoPath: tmpFilePath,
              title: clip.title,
              videoDescription: clip.title,
              privacyLevel: 'PUBLIC_TO_EVERYONE',
            })

            // Update clip record with TikTok publish ID
            exportedTo.push(platform)

            const { error: updateError } = await supabase
              .from('clips')
              .update({
                status: 'exported',
                exported_to: exportedTo,
                updated_at: new Date().toISOString(),
              })
              .eq('id', clip.id)
              .eq('user_id', user_id)

            if (!updateError) {
              exported.push(clip.id)
              console.log(`Successfully exported clip ${clip.id} to TikTok with publish ID: ${publishId}`)
            } else {
              console.error('Error updating clip export status:', updateError)
              errors.push({ clipId: clip.id, error: 'Failed to update clip status' })
            }
          } finally {
            // Clean up temporary file
            try {
              await fs.unlink(tmpFilePath)
            } catch (unlinkError) {
              console.error('Error deleting temporary file:', unlinkError)
            }
          }
        }
      } catch (clipError) {
        console.error(`Error exporting clip ${clip.id} to ${platform}:`, clipError)
        errors.push({
          clipId: clip.id,
          error: clipError instanceof Error ? clipError.message : 'Unknown error'
        })
      }
    }

    return c.json({
      exported,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully exported ${exported.length} clips to ${platform}`
    })
  } catch (error: Error | unknown) {
    console.error('Unexpected error bulk exporting clips:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
