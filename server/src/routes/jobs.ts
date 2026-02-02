import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

export const jobsRoutes = new Hono()

// Apply auth middleware to all routes
jobsRoutes.use('*', requireAuth)

// Job types
export type JobStatus = 'queued' | 'downloading' | 'analyzing' | 'extracting' | 'reframing' | 'captioning' | 'completed' | 'failed'

export interface ProcessingJob {
  id: string
  user_id: string
  vodId: string // DB UUID FK to vods table
  twitchVodId: string // Twitch's video ID string
  vodUrl: string
  title: string
  channelLogin: string
  duration: number
  status: JobStatus
  progress: number // 0-100
  currentStep: string
  clipsFound: number
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  settings: {
    minDuration: number
    maxDuration: number
    sensitivity: 'low' | 'medium' | 'high'
    chatAnalysis: boolean
    audioPeaks: boolean
    faceReactions: boolean
    autoCaptions: boolean
    outputFormat: 'vertical' | 'square' | 'horizontal'
  }
}

// Database row type (snake_case)
interface JobRow {
  id: string
  user_id: string
  vod_id: string
  twitch_vod_id: string
  vod_url: string
  title: string
  channel_login: string
  vod_duration: number
  status: JobStatus
  progress: number
  current_step: string
  clips_found: number
  error?: string
  created_at: string
  updated_at: string
  completed_at?: string
  settings: ProcessingJob['settings']
}

// Convert database row to API response
function rowToJob(row: JobRow): ProcessingJob {
  return {
    id: row.id,
    user_id: row.user_id,
    vodId: row.vod_id,
    twitchVodId: row.twitch_vod_id,
    vodUrl: row.vod_url,
    title: row.title,
    channelLogin: row.channel_login,
    duration: row.vod_duration,
    status: row.status,
    progress: row.progress,
    currentStep: row.current_step,
    clipsFound: row.clips_found,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    settings: row.settings,
  }
}

// Schemas
const createJobSchema = z.object({
  vodId: z.string(),
  vodUrl: z.string().url(),
  title: z.string(),
  channelLogin: z.string(),
  duration: z.number(),
  settings: z.object({
    minDuration: z.number().min(5).max(180).default(15),
    maxDuration: z.number().min(10).max(300).default(60),
    sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
    chatAnalysis: z.boolean().default(true),
    audioPeaks: z.boolean().default(true),
    faceReactions: z.boolean().default(true),
    autoCaptions: z.boolean().default(true),
    outputFormat: z.enum(['vertical', 'square', 'horizontal']).default('vertical'),
  }).default({}),
})

// List all jobs
jobsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const { status } = c.req.query()

  let query = supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching jobs:', error)
    return c.json({ error: 'Failed to fetch jobs' }, 500)
  }

  const jobs = (data as JobRow[]).map(rowToJob)
  return c.json({ jobs })
})

// Get single job
jobsRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return c.json({ error: 'Job not found' }, 404)
  }

  return c.json(rowToJob(data as JobRow))
})

// Create new processing job
jobsRoutes.post('/', zValidator('json', createJobSchema), async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')

  // vodId is now the DB UUID - lookup the vod to get twitch_vod_id
  const { data: vodData, error: vodError } = await supabase
    .from('vods')
    .select('twitch_vod_id')
    .eq('id', input.vodId)
    .single()

  if (vodError || !vodData) {
    return c.json({ error: 'VOD not found' }, 404)
  }

  // Check for duplicate VOD being processed
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('vod_id', input.vodId)
    .not('status', 'in', '(completed,failed)')

  if (existingJobs && existingJobs.length > 0) {
    const existingJob = existingJobs[0] as JobRow
    return c.json({
      error: 'This VOD is already being processed',
      existingJobId: existingJob.id,
    }, 409)
  }

  const jobId = crypto.randomUUID()
  const now = new Date().toISOString()

  const jobRow: JobRow = {
    id: jobId,
    user_id: userId,
    vod_id: input.vodId, // DB UUID FK
    twitch_vod_id: vodData.twitch_vod_id,
    vod_url: input.vodUrl,
    title: input.title,
    channel_login: input.channelLogin,
    vod_duration: input.duration,
    status: 'queued',
    progress: 0,
    current_step: 'Waiting in queue...',
    clips_found: 0,
    created_at: now,
    updated_at: now,
    settings: {
      minDuration: input.settings?.minDuration ?? 15,
      maxDuration: input.settings?.maxDuration ?? 60,
      sensitivity: input.settings?.sensitivity ?? 'medium',
      chatAnalysis: input.settings?.chatAnalysis ?? true,
      audioPeaks: input.settings?.audioPeaks ?? true,
      faceReactions: input.settings?.faceReactions ?? true,
      autoCaptions: input.settings?.autoCaptions ?? true,
      outputFormat: input.settings?.outputFormat ?? 'vertical',
    },
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(jobRow)
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating job:', error)
    return c.json({ error: 'Failed to create job' }, 500)
  }

  // Add to BullMQ queue for processing
  const { processingQueue } = await import('../queue/processingQueue')
  await processingQueue.add('process-vod', {
    jobId,
    vodId: input.vodId, // Pass DB UUID to pipeline
    vodUrl: input.vodUrl,
    title: input.title,
    channelLogin: input.channelLogin,
    duration: input.duration,
    settings: jobRow.settings,
  })

  return c.json(rowToJob(data as JobRow), 201)
})

// Update job status (called by worker)
jobsRoutes.patch('/:id', zValidator('json', z.object({
  status: z.enum(['queued', 'downloading', 'analyzing', 'extracting', 'reframing', 'captioning', 'completed', 'failed']).optional(),
  progress: z.number().min(0).max(100).optional(),
  currentStep: z.string().optional(),
  clipsFound: z.number().optional(),
  error: z.string().optional(),
})), async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = c.req.valid('json')

  // First check if job exists and belongs to user
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existingJob) {
    return c.json({ error: 'Job not found' }, 404)
  }

  const now = new Date().toISOString()
  const updateData: Partial<JobRow> = {
    updated_at: now,
  }

  if (updates.status !== undefined) {
    updateData.status = updates.status
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completed_at = now
    }
  }
  if (updates.progress !== undefined) updateData.progress = updates.progress
  if (updates.currentStep !== undefined) updateData.current_step = updates.currentStep
  if (updates.clipsFound !== undefined) updateData.clips_found = updates.clipsFound
  if (updates.error !== undefined) updateData.error = updates.error

  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating job:', error)
    return c.json({ error: 'Failed to update job' }, 500)
  }

  return c.json(rowToJob(data as JobRow))
})

// Cancel job
jobsRoutes.post('/:id/cancel', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  // Check if job exists and belongs to user
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existingJob) {
    return c.json({ error: 'Job not found' }, 404)
  }

  const job = existingJob as JobRow

  if (['completed', 'failed'].includes(job.status)) {
    return c.json({ error: 'Cannot cancel finished job' }, 400)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'failed' as JobStatus,
      error: 'Cancelled by user',
      updated_at: now,
      completed_at: now,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error cancelling job:', error)
    return c.json({ error: 'Failed to cancel job' }, 500)
  }

  // Cancel actual processing in BullMQ
  try {
    const { processingQueue } = await import('../queue/processingQueue')

    // Find the BullMQ job by searching through active/waiting/delayed jobs
    const jobs = await processingQueue.getJobs(['active', 'waiting', 'delayed', 'paused'])
    const bullmqJob = jobs.find(j => j.data.jobId === id)

    if (bullmqJob) {
      await bullmqJob.remove()
      console.log(`[jobs] Cancelled BullMQ job for jobId: ${id}`)
    } else {
      console.warn(`[jobs] BullMQ job not found for jobId: ${id} (may have already completed)`)
    }
  } catch (bullmqError) {
    console.error('[jobs] Failed to cancel BullMQ job:', bullmqError)
    // Continue anyway since DB is already updated
  }

  return c.json(rowToJob(data as JobRow))
})

// Retry failed job
jobsRoutes.post('/:id/retry', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  // Check if job exists and belongs to user
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existingJob) {
    return c.json({ error: 'Job not found' }, 404)
  }

  const job = existingJob as JobRow

  if (job.status !== 'failed') {
    return c.json({ error: 'Can only retry failed jobs' }, 400)
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'queued' as JobStatus,
      progress: 0,
      current_step: 'Waiting in queue (retry)...',
      error: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error retrying job:', error)
    return c.json({ error: 'Failed to retry job' }, 500)
  }

  // Re-add to BullMQ queue
  try {
    const { processingQueue } = await import('../queue/processingQueue')
    await processingQueue.add('process-vod', {
      jobId: id,
      vodId: job.vod_id,
      vodUrl: job.vod_url,
      title: job.title,
      channelLogin: job.channel_login,
      duration: job.vod_duration,
      settings: job.settings,
    })
    console.log(`[jobs] Re-queued job ${id} to BullMQ`)
  } catch (bullmqError) {
    console.error('[jobs] Failed to re-queue job to BullMQ:', bullmqError)
    // Rollback DB status
    await supabase
      .from('jobs')
      .update({
        status: 'failed' as JobStatus,
        error: 'Failed to re-queue job',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return c.json({ error: 'Failed to re-queue job for processing' }, 500)
  }

  return c.json(rowToJob(data as JobRow))
})

// Delete job
jobsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting job:', error)
    return c.json({ error: 'Job not found' }, 404)
  }

  return c.json({ success: true })
})
