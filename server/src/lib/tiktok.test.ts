import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { TikTokClient, getAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken, validateToken } from './tiktok'

describe('TikTok OAuth', () => {
  describe('getAuthorizationUrl', () => {
    it('should generate valid authorization URL', () => {
      const state = 'test-state-123'
      const url = getAuthorizationUrl(state)

      expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/')
      expect(url).toContain('client_key=')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=video.upload%2Cvideo.publish')
      expect(url).toContain(`state=${state}`)
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 86400,
          token_type: 'Bearer',
          scope: 'video.upload,video.publish',
          open_id: 'test-open-id',
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      const result = await exchangeCodeForTokens('test-code')

      expect(result.access_token).toBe('test-access-token')
      expect(result.refresh_token).toBe('test-refresh-token')
      expect(result.expires_in).toBe(86400)
    })

    it('should throw error on failed token exchange', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        text: async () => 'Invalid code',
      })) as typeof fetch

      await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow('TikTok token exchange failed')
    })

    it('should throw error on API error response', async () => {
      const mockResponse = {
        error: {
          code: 'invalid_request',
          message: 'Invalid authorization code',
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow('Invalid authorization code')
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 86400,
          token_type: 'Bearer',
          scope: 'video.upload,video.publish',
          open_id: 'test-open-id',
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      const result = await refreshAccessToken('old-refresh-token')

      expect(result.access_token).toBe('new-access-token')
      expect(result.refresh_token).toBe('new-refresh-token')
    })

    it('should throw error on failed refresh', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        text: async () => 'Invalid refresh token',
      })) as typeof fetch

      await expect(refreshAccessToken('invalid-token')).rejects.toThrow('TikTok token refresh failed')
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      global.fetch = mock(async () => ({
        ok: true,
      })) as typeof fetch

      const result = await validateToken('valid-token')
      expect(result).toBe(true)
    })

    it('should return false for invalid token', async () => {
      global.fetch = mock(async () => ({
        ok: false,
      })) as typeof fetch

      const result = await validateToken('invalid-token')
      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      global.fetch = mock(async () => {
        throw new Error('Network error')
      }) as typeof fetch

      const result = await validateToken('any-token')
      expect(result).toBe(false)
    })
  })
})

describe('TikTokClient', () => {
  let client: TikTokClient

  beforeEach(() => {
    client = new TikTokClient('test-access-token')
  })

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockResponse = {
        data: {
          user: {
            open_id: 'test-open-id',
            union_id: 'test-union-id',
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
          },
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      const userInfo = await client.getUserInfo()

      expect(userInfo.open_id).toBe('test-open-id')
      expect(userInfo.union_id).toBe('test-union-id')
      expect(userInfo.display_name).toBe('Test User')
    })

    it('should throw error on API error', async () => {
      global.fetch = mock(async () => ({
        ok: false,
        text: async () => 'Unauthorized',
      })) as typeof fetch

      await expect(client.getUserInfo()).rejects.toThrow('TikTok API error')
    })
  })

  describe('getPublishStatus', () => {
    it('should fetch publish status successfully', async () => {
      const mockResponse = {
        data: {
          status: 'PUBLISH_COMPLETE',
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      const status = await client.getPublishStatus('test-publish-id')

      expect(status.status).toBe('PUBLISH_COMPLETE')
    })

    it('should return failed status', async () => {
      const mockResponse = {
        data: {
          status: 'FAILED',
          fail_reason: 'Video too large',
        },
      }

      global.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse,
      })) as typeof fetch

      const status = await client.getPublishStatus('test-publish-id')

      expect(status.status).toBe('FAILED')
      expect(status.fail_reason).toBe('Video too large')
    })
  })
})
