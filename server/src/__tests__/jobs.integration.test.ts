import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { Hono } from 'hono'
import { jobsRoutes } from '../routes/jobs'
import { processingQueue } from '../queue/processingQueue'

describe('Jobs Route Integration', () => {
  const app = new Hono()
  app.route('/jobs', jobsRoutes)

  afterAll(async () => {
    // Clean up queue connection
    await processingQueue.close()
  })

  test('POST /jobs should add job to processing queue', async () => {
    const jobData = {
      vodId: 'test-vod-123',
      vodUrl: 'https://twitch.tv/videos/123456789',
      title: 'Test VOD',
      channelLogin: 'testchannel',
      duration: 3600,
      settings: {
        minDuration: 15,
        maxDuration: 60,
        sensitivity: 'medium' as const,
        chatAnalysis: true,
        audioPeaks: true,
        faceReactions: true,
        autoCaptions: true,
        outputFormat: 'vertical' as const,
      },
    }

    const response = await app.request('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    })

    expect(response.status).toBe(201)
    const job = await response.json()

    expect(job.id).toBeDefined()
    expect(job.vodId).toBe(jobData.vodId)
    expect(job.status).toBe('queued')
    expect(job.progress).toBe(0)
    expect(job.currentStep).toBe('Waiting in queue...')

    // Verify job was added to queue
    const queueJobs = await processingQueue.getJobs(['waiting', 'active'])
    const addedJob = queueJobs.find((qj) => qj.data.jobId === job.id)

    expect(addedJob).toBeDefined()
    expect(addedJob?.name).toBe('process-vod')
    expect(addedJob?.data.jobId).toBe(job.id)

    // Clean up
    if (addedJob) {
      await addedJob.remove()
    }
  })

  test('POST /jobs should not add duplicate VOD to queue', async () => {
    const jobData = {
      vodId: 'duplicate-vod',
      vodUrl: 'https://twitch.tv/videos/999999999',
      title: 'Duplicate Test VOD',
      channelLogin: 'testchannel',
      duration: 1800,
    }

    // Create first job
    const response1 = await app.request('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    })

    expect(response1.status).toBe(201)
    const job1 = await response1.json()

    // Try to create duplicate
    const response2 = await app.request('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    })

    expect(response2.status).toBe(409)
    const error = await response2.json()

    expect(error.error).toBe('This VOD is already being processed')
    expect(error.existingJobId).toBe(job1.id)

    // Clean up
    const queueJobs = await processingQueue.getJobs(['waiting', 'active'])
    const addedJob = queueJobs.find((qj) => qj.data.jobId === job1.id)
    if (addedJob) {
      await addedJob.remove()
    }
  })
})
