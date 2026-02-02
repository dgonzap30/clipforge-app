import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { supabase } from '../lib/supabase'
import { clips as clipsStorage } from '../lib/storage'
import { requireAuth, type AuthContext } from '../middleware/auth'

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
  } catch (error) {
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
  } catch (error) {
    console.error('Unexpected error fetching clip:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get signed URL for clip video
clipsRoutes.get('/:id/signed-url', (c) => {
  const id = c.req.param('id')
  const clip = clips.get(id)

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404)
  }

  if (clip.status !== 'ready') {
    return c.json({ error: 'Clip not ready for playback' }, 400)
  }

  // TODO: Generate actual signed URL from S3/R2/storage
  // For now, return the videoUrl directly (in production this would be a time-limited signed URL)
  const signedUrl = clip.videoUrl || null
  const expiresIn = 3600 // 1 hour in seconds

  if (!signedUrl) {
    return c.json({ error: 'Video URL not available' }, 404)
  }

  return c.json({
    url: signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    expiresIn,
  })
})

// Create clip (called by processing pipeline)
clipsRoutes.post('/', zValidator('json', createClipSchema), async (c) => {
  const user_id = c.get('user_id')
  const data = c.req.valid('json')

  try {
    const clipId = nanoid()
    const duration = data.endTime - data.startTime

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
        duration,
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('Unexpected error bulk deleting clips:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

clipsRoutes.post('/bulk/export', zValidator('json', z.object({
  ids: z.array(z.string()),
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
})), async (c) => {
  const user_id = c.get('user_id')
  const { ids, platform } = c.req.valid('json')

  try {
    // Fetch clips that are ready for export
    const { data: clips, error: fetchError } = await supabase
      .from('clips')
      .select('id, status, exported_to')
      .eq('user_id', user_id)
      .eq('status', 'ready')
      .in('id', ids)

    if (fetchError) {
      console.error('Error fetching clips for export:', fetchError)
      return c.json({ error: 'Failed to fetch clips' }, 500)
    }

    const exported: string[] = []

    // Update each clip with the new export platform
    for (const clip of clips || []) {
      const exportedTo = clip.exported_to || []
      if (!exportedTo.includes(platform)) {
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
        }
      }
    }

    // TODO: Queue export jobs for actual platform upload

    return c.json({ exported })
  } catch (error) {
    console.error('Unexpected error bulk exporting clips:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
