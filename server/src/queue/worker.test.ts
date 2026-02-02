import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { processingQueue } from './processingQueue'
import { vodWorker, closeWorker } from './worker'
import { closeRedisConnection } from './connection'

describe('BullMQ Worker', () => {
  afterAll(async () => {
    // Cleanup
    await closeWorker()
    await processingQueue.close()
    await closeRedisConnection()
  })

  test('worker should be defined', () => {
    expect(vodWorker).toBeDefined()
    expect(vodWorker.name).toBe('vod-processing')
  })

  test('worker should have concurrency of 1', () => {
    expect(vodWorker.opts.concurrency).toBe(1)
  })

  test('processingQueue should be defined', () => {
    expect(processingQueue).toBeDefined()
    expect(processingQueue.name).toBe('vod-processing')
  })

  test('can add a job to the queue', async () => {
    const job = await processingQueue.add('test-job', {
      jobId: 'test-job-123',
    })

    expect(job).toBeDefined()
    expect(job.data.jobId).toBe('test-job-123')

    // Clean up test job
    await job.remove()
  })
})
