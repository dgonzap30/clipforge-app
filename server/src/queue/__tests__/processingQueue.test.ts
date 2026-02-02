import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { processingQueue } from '../processingQueue'
import { redisConnection } from '../connection'
import type { VodProcessingJobData } from '../processingQueue'

describe('processingQueue', () => {
  beforeAll(async () => {
    // Clean up any existing jobs before tests
    await processingQueue.drain()
    await processingQueue.clean(0, 1000, 'completed')
    await processingQueue.clean(0, 1000, 'failed')
  })

  afterAll(async () => {
    // Clean up after tests
    await processingQueue.drain()
    await processingQueue.close()
    await redisConnection.quit()
  })

  test('queue is initialized with correct name', () => {
    expect(processingQueue.name).toBe('vod-processing')
  })

  test('can add a job to the queue', async () => {
    const jobData: VodProcessingJobData = {
      jobId: 'test-job-1',
      vodId: 'v12345',
      vodUrl: 'https://twitch.tv/videos/12345',
      title: 'Test VOD',
      channelLogin: 'testchannel',
      duration: 3600,
      settings: {
        minDuration: 15,
        maxDuration: 60,
        sensitivity: 'medium',
        chatAnalysis: true,
        audioPeaks: true,
        faceReactions: true,
        autoCaptions: true,
        outputFormat: 'vertical',
      },
    }

    const job = await processingQueue.add('process-vod', jobData)

    expect(job).toBeDefined()
    expect(job.id).toBeDefined()
    expect(job.data).toEqual(jobData)
    expect(job.name).toBe('process-vod')

    // Clean up
    await job.remove()
  })

  test('job has correct default options', async () => {
    const jobData: VodProcessingJobData = {
      jobId: 'test-job-2',
      vodId: 'v67890',
      vodUrl: 'https://twitch.tv/videos/67890',
      title: 'Test VOD 2',
      channelLogin: 'testchannel2',
      duration: 1800,
      settings: {
        minDuration: 10,
        maxDuration: 30,
        sensitivity: 'high',
        chatAnalysis: false,
        audioPeaks: true,
        faceReactions: false,
        autoCaptions: true,
        outputFormat: 'square',
      },
    }

    const job = await processingQueue.add('process-vod', jobData)

    expect(job.opts.attempts).toBe(3)
    expect(job.opts.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    })

    // Clean up
    await job.remove()
  })

  test('can retrieve job from queue', async () => {
    const jobData: VodProcessingJobData = {
      jobId: 'test-job-3',
      vodId: 'v11111',
      vodUrl: 'https://twitch.tv/videos/11111',
      title: 'Test VOD 3',
      channelLogin: 'testchannel3',
      duration: 7200,
      settings: {
        minDuration: 20,
        maxDuration: 90,
        sensitivity: 'low',
        chatAnalysis: true,
        audioPeaks: false,
        faceReactions: true,
        autoCaptions: false,
        outputFormat: 'horizontal',
      },
    }

    const addedJob = await processingQueue.add('process-vod', jobData)
    const retrievedJob = await processingQueue.getJob(addedJob.id!)

    expect(retrievedJob).toBeDefined()
    expect(retrievedJob?.data).toEqual(jobData)

    // Clean up
    await addedJob.remove()
  })

  test('can get waiting jobs count', async () => {
    const initialCount = await processingQueue.getWaitingCount()

    const jobData: VodProcessingJobData = {
      jobId: 'test-job-4',
      vodId: 'v22222',
      vodUrl: 'https://twitch.tv/videos/22222',
      title: 'Test VOD 4',
      channelLogin: 'testchannel4',
      duration: 4500,
      settings: {
        minDuration: 15,
        maxDuration: 60,
        sensitivity: 'medium',
        chatAnalysis: true,
        audioPeaks: true,
        faceReactions: true,
        autoCaptions: true,
        outputFormat: 'vertical',
      },
    }

    const job = await processingQueue.add('process-vod', jobData)
    const newCount = await processingQueue.getWaitingCount()

    expect(newCount).toBe(initialCount + 1)

    // Clean up
    await job.remove()
  })

  test('can remove a job from queue', async () => {
    const jobData: VodProcessingJobData = {
      jobId: 'test-job-5',
      vodId: 'v33333',
      vodUrl: 'https://twitch.tv/videos/33333',
      title: 'Test VOD 5',
      channelLogin: 'testchannel5',
      duration: 2400,
      settings: {
        minDuration: 15,
        maxDuration: 60,
        sensitivity: 'medium',
        chatAnalysis: true,
        audioPeaks: true,
        faceReactions: true,
        autoCaptions: true,
        outputFormat: 'vertical',
      },
    }

    const job = await processingQueue.add('process-vod', jobData)
    const jobId = job.id!

    await job.remove()

    const removedJob = await processingQueue.getJob(jobId)
    expect(removedJob).toBeUndefined()
  })
})
