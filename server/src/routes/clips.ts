import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'

export const clipsRoutes = new Hono()

// In-memory store for now (replace with DB later)
const clips = new Map<string, any>()

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

// List all clips
clipsRoutes.get('/', (c) => {
  const { status, limit = '50', offset = '0' } = c.req.query()
  
  let allClips = Array.from(clips.values())
  
  // Filter by status
  if (status) {
    allClips = allClips.filter(clip => clip.status === status)
  }
  
  // Sort by creation date (newest first)
  allClips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  // Paginate
  const start = parseInt(offset)
  const end = start + parseInt(limit)
  const paginatedClips = allClips.slice(start, end)
  
  return c.json({
    clips: paginatedClips,
    total: allClips.length,
    hasMore: end < allClips.length,
  })
})

// Get single clip
clipsRoutes.get('/:id', (c) => {
  const id = c.req.param('id')
  const clip = clips.get(id)
  
  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404)
  }
  
  return c.json(clip)
})

// Create clip (called by processing pipeline)
clipsRoutes.post('/', zValidator('json', createClipSchema), (c) => {
  const data = c.req.valid('json')
  
  const clip = {
    id: nanoid(),
    ...data,
    status: 'processing' as const,
    duration: data.endTime - data.startTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  clips.set(clip.id, clip)
  
  return c.json(clip, 201)
})

// Update clip
clipsRoutes.patch('/:id', zValidator('json', updateClipSchema), (c) => {
  const id = c.req.param('id')
  const updates = c.req.valid('json')
  
  const clip = clips.get(id)
  
  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404)
  }
  
  const updatedClip = {
    ...clip,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  
  clips.set(id, updatedClip)
  
  return c.json(updatedClip)
})

// Delete clip
clipsRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  
  if (!clips.has(id)) {
    return c.json({ error: 'Clip not found' }, 404)
  }
  
  clips.delete(id)
  
  return c.json({ success: true })
})

// Bulk actions
clipsRoutes.post('/bulk/delete', zValidator('json', z.object({
  ids: z.array(z.string()),
})), (c) => {
  const { ids } = c.req.valid('json')
  
  let deleted = 0
  for (const id of ids) {
    if (clips.delete(id)) {
      deleted++
    }
  }
  
  return c.json({ deleted })
})

clipsRoutes.post('/bulk/export', zValidator('json', z.object({
  ids: z.array(z.string()),
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
})), (c) => {
  const { ids, platform } = c.req.valid('json')
  
  // TODO: Queue export jobs
  // For now, just mark as exported
  
  const exported = []
  for (const id of ids) {
    const clip = clips.get(id)
    if (clip && clip.status === 'ready') {
      clip.status = 'exported'
      clip.exportedTo = [...(clip.exportedTo || []), platform]
      clip.updatedAt = new Date().toISOString()
      exported.push(id)
    }
  }
  
  return c.json({ exported })
})
