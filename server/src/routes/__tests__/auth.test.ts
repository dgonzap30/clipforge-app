import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Hono } from 'hono'

// Mock the Supabase module before importing routes
const mockVerifySupabaseToken = mock()

mock.module('../../lib/supabase', () => ({
  verifySupabaseToken: mockVerifySupabaseToken,
  supabase: {}, // Mock the supabase client
}))

// Mock the env module to avoid errors
mock.module('../../lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}))

const { authRoutes } = await import('../auth')

describe('Auth Routes', () => {
  const app = new Hono()
  app.route('/auth', authRoutes)

  beforeEach(() => {
    mockVerifySupabaseToken.mockReset()
  })

  describe('GET /auth/me', () => {
    test('returns unauthenticated when no Authorization header', async () => {
      const res = await app.request('/auth/me')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ user: null, authenticated: false })
    })

    test('returns unauthenticated when Authorization header is malformed', async () => {
      const res = await app.request('/auth/me', {
        headers: {
          Authorization: 'InvalidFormat',
        },
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ user: null, authenticated: false })
    })

    test('returns unauthenticated when token verification fails', async () => {
      mockVerifySupabaseToken.mockResolvedValue({
        user: null,
        error: { message: 'Invalid token' },
      })

      const res = await app.request('/auth/me', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ user: null, authenticated: false })
    })

    test('returns user data when token is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { username: 'testuser' },
        app_metadata: {},
        created_at: '2024-01-01T00:00:00.000Z',
      }

      mockVerifySupabaseToken.mockResolvedValue({
        user: mockUser,
        error: null,
      })

      const res = await app.request('/auth/me', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({
        user: mockUser,
        authenticated: true,
      })
    })

    test('handles verification errors gracefully', async () => {
      mockVerifySupabaseToken.mockRejectedValue(new Error('Network error'))

      const res = await app.request('/auth/me', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ user: null, authenticated: false })
    })
  })

  describe('GET /auth/health', () => {
    test('returns health check status', async () => {
      const res = await app.request('/auth/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({
        status: 'ok',
        message: 'Auth service is running with Supabase JWT verification',
      })
    })
  })
})
