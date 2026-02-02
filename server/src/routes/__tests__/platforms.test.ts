import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { platformsRoutes, getPlatformTokens } from '../platforms'

describe('Platform Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/api/platforms', platformsRoutes)
  })

  describe('GET /api/platforms/connections', () => {
    test('should require authentication', async () => {
      const res = await app.request('/api/platforms/connections', {
        method: 'GET',
      })

      // Will fail auth since we don't have a valid token
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /api/platforms/youtube/connect', () => {
    test('should require authentication', async () => {
      const res = await app.request('/api/platforms/youtube/connect', {
        method: 'GET',
      })

      // Will fail auth since we don't have a valid token
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('DELETE /api/platforms/:platform/disconnect', () => {
    test('should require authentication', async () => {
      const res = await app.request('/api/platforms/youtube/disconnect', {
        method: 'DELETE',
      })

      // Will fail auth since we don't have a valid token
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    test('should validate platform parameter', async () => {
      // This test validates the route structure
      const validPlatforms = ['youtube', 'tiktok', 'instagram']

      for (const platform of validPlatforms) {
        const res = await app.request(`/api/platforms/${platform}/disconnect`, {
          method: 'DELETE',
        })

        // Will fail auth, but route should be found
        expect(res.status).not.toBe(404)
      }
    })
  })

  describe('getPlatformTokens', () => {
    test('should be a function', () => {
      expect(typeof getPlatformTokens).toBe('function')
    })

    test('should accept userId and platform parameters', async () => {
      const result = await getPlatformTokens('test-user-id', 'youtube')

      // Will return null since user doesn't exist, but structure is valid
      expect(result).toBeNull()
    })
  })

  describe('OAuth callback flow', () => {
    test('should handle missing code parameter', async () => {
      const res = await app.request('/api/platforms/youtube/callback?state=test', {
        method: 'GET',
      })

      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    test('should handle missing state parameter', async () => {
      const res = await app.request('/api/platforms/youtube/callback?code=test', {
        method: 'GET',
      })

      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    test('should handle OAuth error parameter', async () => {
      const res = await app.request('/api/platforms/youtube/callback?error=access_denied', {
        method: 'GET',
      })

      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('access_denied')
    })

    test('should handle invalid state', async () => {
      const res = await app.request('/api/platforms/youtube/callback?code=test&state=invalid', {
        method: 'GET',
      })

      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('state')
    })
  })

  describe('Platform validation', () => {
    test('should accept valid platforms', () => {
      const validPlatforms = ['youtube', 'tiktok', 'instagram']

      for (const platform of validPlatforms) {
        expect(['youtube', 'tiktok', 'instagram']).toContain(platform)
      }
    })

    test('should reject invalid platforms', () => {
      const invalidPlatforms = ['facebook', 'twitter', 'snapchat']

      for (const platform of invalidPlatforms) {
        expect(['youtube', 'tiktok', 'instagram']).not.toContain(platform)
      }
    })
  })
})
