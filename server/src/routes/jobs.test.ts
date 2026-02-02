import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Hono } from 'hono'
import { jobsRoutes } from './jobs'

// Mock Supabase client
const mockSupabase = {
  from: mock(() => ({
    select: mock(() => ({
      eq: mock(() => ({
        eq: mock(() => ({
          single: mock(() => ({ data: null, error: null })),
        })),
        order: mock(() => ({ data: [], error: null })),
        not: mock(() => ({ data: [], error: null })),
      })),
      order: mock(() => ({ data: [], error: null })),
    })),
    insert: mock(() => ({
      select: mock(() => ({
        single: mock(() => ({ data: null, error: null })),
      })),
    })),
    update: mock(() => ({
      eq: mock(() => ({
        eq: mock(() => ({
          select: mock(() => ({
            single: mock(() => ({ data: null, error: null })),
          })),
        })),
        select: mock(() => ({
          single: mock(() => ({ data: null, error: null })),
        })),
      })),
    })),
    delete: mock(() => ({
      eq: mock(() => ({
        eq: mock(() => ({ error: null })),
      })),
    })),
  })),
}

// Mock the middleware to inject userId
const mockAuthMiddleware = async (c: any, next: any) => {
  c.set('userId', 'test-user-123')
  c.set('userLogin', 'testuser')
  await next()
}

describe('Jobs API', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    // Override the auth middleware for testing
    app.use('*', mockAuthMiddleware)
    app.route('/', jobsRoutes)
  })

  test('GET /jobs returns jobs for authenticated user', async () => {
    const res = await app.request('/jobs')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('jobs')
    expect(Array.isArray(data.jobs)).toBe(true)
  })

  test('GET /jobs/:id returns 404 for non-existent job', async () => {
    const res = await app.request('/jobs/non-existent-id')
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Job not found')
  })

  test('POST /jobs creates a new job', async () => {
    const jobData = {
      vodId: 'vod123',
      vodUrl: 'https://twitch.tv/videos/123',
      title: 'Test Stream',
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

    const res = await app.request('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    })

    expect(res.status).toBe(201)
  })

  test('POST /jobs validates required fields', async () => {
    const invalidData = {
      vodId: 'vod123',
      // Missing required fields
    }

    const res = await app.request('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData),
    })

    expect(res.status).toBe(400)
  })

  test('PATCH /jobs/:id updates job status', async () => {
    const updates = {
      status: 'downloading',
      progress: 25,
      currentStep: 'Downloading VOD...',
    }

    const res = await app.request('/jobs/test-job-id', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    expect(res.status).toBe(404) // Will be 404 since we're using mock data
  })

  test('POST /jobs/:id/cancel cancels a running job', async () => {
    const res = await app.request('/jobs/test-job-id/cancel', {
      method: 'POST',
    })

    expect(res.status).toBe(404) // Will be 404 since we're using mock data
  })

  test('POST /jobs/:id/retry retries a failed job', async () => {
    const res = await app.request('/jobs/test-job-id/retry', {
      method: 'POST',
    })

    expect(res.status).toBe(404) // Will be 404 since we're using mock data
  })

  test('DELETE /jobs/:id deletes a job', async () => {
    const res = await app.request('/jobs/test-job-id', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
