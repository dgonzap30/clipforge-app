import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'

export const jobsRoutes = new Hono()

// Job types
export type JobStatus = 'queued' | 'downloading' | 'analyzing' | 'extracting' | 'reframing' | 'captioning' | 'completed' | 'failed'

export interface ProcessingJob {
  id: string
  vodId: string
  vodUrl: string
  title: string
  channelLogin: string
  duration: number
  status: JobStatus
  progress: number // 0-100
  currentStep: string
  clipsFound: number
  clipIds: string[]
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

// In-memory store (replace with Redis/DB later)
const jobs = new Map<string, ProcessingJob>()

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
jobsRoutes.get('/', (c) => {
  const { status } = c.req.query()
  
  let allJobs = Array.from(jobs.values())
  
  if (status) {
    allJobs = allJobs.filter(job => job.status === status)
  }
  
  // Sort by creation date (newest first)
  allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  return c.json({ jobs: allJobs })
})

// Get single job
jobsRoutes.get('/:id', (c) => {
  const id = c.req.param('id')
  const job = jobs.get(id)
  
  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }
  
  return c.json(job)
})

// Create new processing job
jobsRoutes.post('/', zValidator('json', createJobSchema), async (c) => {
  const data = c.req.valid('json')
  
  // Check for duplicate VOD being processed
  const existingJob = Array.from(jobs.values()).find(
    j => j.vodId === data.vodId && !['completed', 'failed'].includes(j.status)
  )
  
  if (existingJob) {
    return c.json({ 
      error: 'This VOD is already being processed',
      existingJobId: existingJob.id,
    }, 409)
  }
  
  const job: ProcessingJob = {
    id: nanoid(),
    vodId: data.vodId,
    vodUrl: data.vodUrl,
    title: data.title,
    channelLogin: data.channelLogin,
    duration: data.duration,
    status: 'queued',
    progress: 0,
    currentStep: 'Waiting in queue...',
    clipsFound: 0,
    clipIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      minDuration: data.settings?.minDuration ?? 15,
      maxDuration: data.settings?.maxDuration ?? 60,
      sensitivity: data.settings?.sensitivity ?? 'medium',
      chatAnalysis: data.settings?.chatAnalysis ?? true,
      audioPeaks: data.settings?.audioPeaks ?? true,
      faceReactions: data.settings?.faceReactions ?? true,
      autoCaptions: data.settings?.autoCaptions ?? true,
      outputFormat: data.settings?.outputFormat ?? 'vertical',
    },
  }
  
  jobs.set(job.id, job)
  
  // TODO: Add to BullMQ queue for processing
  // await processingQueue.add('process-vod', { jobId: job.id })
  
  // For now, simulate processing start
  setTimeout(() => {
    const j = jobs.get(job.id)
    if (j && j.status === 'queued') {
      j.status = 'downloading'
      j.progress = 5
      j.currentStep = 'Downloading VOD...'
      j.updatedAt = new Date().toISOString()
    }
  }, 1000)
  
  return c.json(job, 201)
})

// Update job status (called by worker)
jobsRoutes.patch('/:id', zValidator('json', z.object({
  status: z.enum(['queued', 'downloading', 'analyzing', 'extracting', 'reframing', 'captioning', 'completed', 'failed']).optional(),
  progress: z.number().min(0).max(100).optional(),
  currentStep: z.string().optional(),
  clipsFound: z.number().optional(),
  clipIds: z.array(z.string()).optional(),
  error: z.string().optional(),
})), (c) => {
  const id = c.req.param('id')
  const updates = c.req.valid('json')
  
  const job = jobs.get(id)
  
  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }
  
  Object.assign(job, {
    ...updates,
    updatedAt: new Date().toISOString(),
    ...(updates.status === 'completed' || updates.status === 'failed' 
      ? { completedAt: new Date().toISOString() } 
      : {}
    ),
  })
  
  return c.json(job)
})

// Cancel job
jobsRoutes.post('/:id/cancel', (c) => {
  const id = c.req.param('id')
  const job = jobs.get(id)
  
  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }
  
  if (['completed', 'failed'].includes(job.status)) {
    return c.json({ error: 'Cannot cancel finished job' }, 400)
  }
  
  job.status = 'failed'
  job.error = 'Cancelled by user'
  job.updatedAt = new Date().toISOString()
  job.completedAt = new Date().toISOString()
  
  // TODO: Cancel actual processing in BullMQ
  
  return c.json(job)
})

// Retry failed job
jobsRoutes.post('/:id/retry', (c) => {
  const id = c.req.param('id')
  const job = jobs.get(id)
  
  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }
  
  if (job.status !== 'failed') {
    return c.json({ error: 'Can only retry failed jobs' }, 400)
  }
  
  job.status = 'queued'
  job.progress = 0
  job.currentStep = 'Waiting in queue (retry)...'
  job.error = undefined
  job.completedAt = undefined
  job.updatedAt = new Date().toISOString()
  
  // TODO: Re-add to BullMQ queue
  
  return c.json(job)
})

// Delete job
jobsRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  
  if (!jobs.has(id)) {
    return c.json({ error: 'Job not found' }, 404)
  }
  
  jobs.delete(id)
  
  return c.json({ success: true })
})
