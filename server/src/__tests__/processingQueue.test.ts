import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { processingQueue } from '../queue/processingQueue'

describe('Processing Queue', () => {
  afterAll(async () => {
    // Clean up: close queue connection
    await processingQueue.close()
  })

  test('should be defined', () => {
    expect(processingQueue).toBeDefined()
  })

  test('should have correct queue name', () => {
    expect(processingQueue.name).toBe('vod-processing')
  })

  test('should add a job to the queue', async () => {
    const jobData = { jobId: 'test-job-123' }
    const job = await processingQueue.add('process-vod', jobData)

    expect(job).toBeDefined()
    expect(job.id).toBeDefined()
    expect(job.data).toEqual(jobData)
    expect(job.name).toBe('process-vod')

    // Clean up
    await job.remove()
  })

  test('should have default job options configured', async () => {
    const jobData = { jobId: 'test-job-456' }
    const job = await processingQueue.add('process-vod', jobData)

    expect(job.opts.attempts).toBe(3)
    expect(job.opts.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    })

    // Clean up
    await job.remove()
  })
})
