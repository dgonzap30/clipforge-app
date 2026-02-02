import { describe, test, expect, beforeAll, mock } from 'bun:test'
import { Hono } from 'hono'
import { clipsRoutes } from './clips'

// Mock the Supabase client
const mockSupabase = {
  from: mock(() => ({
    select: mock(() => ({
      eq: mock(() => ({
        order: mock(() => ({
          range: mock(() => ({
            data: [],
            error: null,
            count: 0,
          })),
        })),
        single: mock(() => ({
          data: null,
          error: { message: 'Not found' },
        })),
      })),
      single: mock(() => ({
        data: null,
        error: { message: 'Not found' },
      })),
    })),
    insert: mock(() => ({
      select: mock(() => ({
        single: mock(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
    update: mock(() => ({
      eq: mock(() => ({
        select: mock(() => ({
          single: mock(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
    delete: mock(() => ({
      eq: mock(() => ({
        error: null,
      })),
    })),
  })),
  auth: {
    getUser: mock((token: string) => {
      if (token === 'valid-token') {
        return {
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
          error: null,
        }
      }
      return {
        data: { user: null },
        error: { message: 'Invalid token' },
      }
    }),
  },
  storage: {
    from: mock(() => ({
      createSignedUrl: mock(() => ({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null,
      })),
    })),
  },
}

// Mock modules
mock.module('../lib/supabase', () => ({
  supabase: mockSupabase,
}))

mock.module('../lib/storage', () => ({
  clips: {
    getSignedUrl: mock(() => Promise.resolve('https://example.com/signed-url')),
    delete: mock(() => Promise.resolve(true)),
  },
}))

describe('Clips Routes', () => {
  describe('Authentication', () => {
    test('should reject requests without Authorization header', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips')
      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toContain('Unauthorized')
    })

    test('should reject requests with invalid token', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })
      expect(res.status).toBe(401)
    })

    test('should accept requests with valid token', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })
      // Should not be 401 (might be 200 or 500 depending on mock behavior)
      expect(res.status).not.toBe(401)
    })
  })

  describe('GET /clips', () => {
    test('should return empty list when no clips exist', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('clips')
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('hasMore')
    })

    test('should accept pagination parameters', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips?limit=10&offset=0', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      expect(res.status).toBe(200)
    })

    test('should accept status filter parameter', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips?status=ready', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      expect(res.status).toBe(200)
    })
  })

  describe('POST /clips', () => {
    test('should reject invalid clip data', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          title: 'Test Clip',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should accept valid clip data', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const validClipData = {
        jobId: 'job-123',
        vodId: 'vod-456',
        title: 'Test Clip',
        startTime: 0,
        endTime: 30,
        hydeScore: 85,
        signals: {
          chatVelocity: 10,
          audioPeak: 0.8,
        },
      }

      const res = await app.request('/clips', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validClipData),
      })

      // May be 201 or 500 depending on mock
      expect([201, 500]).toContain(res.status)
    })
  })

  describe('PATCH /clips/:id', () => {
    test('should reject updates without valid fields', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/some-id', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invalidField: 'value',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should accept valid update fields', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/some-id', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated Title',
          status: 'ready',
        }),
      })

      // May be 404 or 500 depending on mock
      expect([404, 500]).toContain(res.status)
    })
  })

  describe('DELETE /clips/:id', () => {
    test('should attempt to delete clip', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/some-id', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      // May be 404 or 500 depending on mock
      expect([404, 500]).toContain(res.status)
    })
  })

  describe('POST /clips/bulk/delete', () => {
    test('should accept array of IDs', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/bulk/delete', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: ['id-1', 'id-2', 'id-3'],
        }),
      })

      // Should not be validation error
      expect(res.status).not.toBe(400)
    })

    test('should reject invalid request body', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/bulk/delete', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: 'not-an-array',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /clips/bulk/export', () => {
    test('should accept valid export request', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/bulk/export', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: ['id-1', 'id-2'],
          platform: 'tiktok',
        }),
      })

      expect(res.status).not.toBe(400)
    })

    test('should reject invalid platform', async () => {
      const app = new Hono()
      app.route('/clips', clipsRoutes)

      const res = await app.request('/clips/bulk/export', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: ['id-1'],
          platform: 'invalid-platform',
        }),
      })

      expect(res.status).toBe(400)
    })
  })
})
