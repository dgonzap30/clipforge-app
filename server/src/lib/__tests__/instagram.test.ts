import { describe, test, expect, mock } from 'bun:test'
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getLongLivedToken,
  refreshLongLivedToken,
  validateToken,
  getInstagramBusinessAccount,
  InstagramClient,
} from '../instagram'

// Mock environment variables
const mockEnv = {
  INSTAGRAM_APP_ID: 'test-app-id',
  INSTAGRAM_APP_SECRET: 'test-app-secret',
  INSTAGRAM_REDIRECT_URI: 'http://localhost:8787/api/platforms/instagram/callback',
}

describe('Instagram Graph API', () => {
  describe('OAuth Functions', () => {
    describe('getAuthorizationUrl', () => {
      test('should generate correct authorization URL', () => {
        const state = 'test-state-123'
        const url = getAuthorizationUrl(state)

        expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth')
        expect(url).toContain(`client_id=${mockEnv.INSTAGRAM_APP_ID}`)
        expect(url).toContain('redirect_uri=')
        expect(url).toContain('response_type=code')
        expect(url).toContain('scope=instagram_basic')
        expect(url).toContain('instagram_content_publish')
        expect(url).toContain('pages_read_engagement')
        expect(url).toContain(`state=${state}`)
      })
    })

    describe('exchangeCodeForTokens', () => {
      test('should exchange authorization code for access token', async () => {
        const mockResponse = {
          access_token: 'short-lived-token',
          token_type: 'bearer',
          expires_in: 5400,
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await exchangeCodeForTokens('test-code')

        expect(result.access_token).toBe('short-lived-token')
        expect(result.token_type).toBe('bearer')
        expect(result.expires_in).toBe(5400)
      })

      test('should handle token exchange errors', async () => {
        global.fetch = mock(async () => ({
          ok: false,
          text: async () => 'Invalid code',
        })) as any

        await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow(
          'Token exchange failed'
        )
      })
    })

    describe('getLongLivedToken', () => {
      test('should exchange short-lived token for long-lived token', async () => {
        const mockResponse = {
          access_token: 'long-lived-token',
          token_type: 'bearer',
          expires_in: 5184000, // 60 days
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await getLongLivedToken('short-lived-token')

        expect(result.access_token).toBe('long-lived-token')
        expect(result.expires_in).toBe(5184000)
      })

      test('should handle long-lived token exchange errors', async () => {
        global.fetch = mock(async () => ({
          ok: false,
          text: async () => 'Invalid token',
        })) as any

        await expect(getLongLivedToken('invalid-token')).rejects.toThrow(
          'Long-lived token exchange failed'
        )
      })
    })

    describe('refreshLongLivedToken', () => {
      test('should refresh long-lived token', async () => {
        const mockResponse = {
          access_token: 'refreshed-token',
          token_type: 'bearer',
          expires_in: 5184000,
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await refreshLongLivedToken('current-token')

        expect(result.access_token).toBe('refreshed-token')
      })
    })

    describe('validateToken', () => {
      test('should validate a valid token', async () => {
        const mockResponse = {
          data: {
            is_valid: true,
            user_id: '123456',
            expires_at: 1234567890,
          },
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await validateToken('valid-token')

        expect(result.valid).toBe(true)
        expect(result.user_id).toBe('123456')
        expect(result.expires_at).toBe(1234567890)
      })

      test('should return false for invalid token', async () => {
        global.fetch = mock(async () => ({
          ok: false,
        })) as any

        const result = await validateToken('invalid-token')

        expect(result.valid).toBe(false)
      })
    })

    describe('getInstagramBusinessAccount', () => {
      test('should get Instagram Business Account from Facebook Pages', async () => {
        const mockPagesResponse = {
          data: [
            {
              id: 'page-123',
              name: 'Test Page',
              instagram_business_account: {
                id: 'ig-123',
              },
            },
          ],
        }

        const mockIgResponse = {
          id: 'ig-123',
          username: 'testuser',
        }

        let callCount = 0
        global.fetch = mock(async () => {
          callCount++
          if (callCount === 1) {
            return { ok: true, json: async () => mockPagesResponse }
          }
          return { ok: true, json: async () => mockIgResponse }
        }) as any

        const result = await getInstagramBusinessAccount('access-token')

        expect(result).not.toBeNull()
        expect(result?.id).toBe('ig-123')
        expect(result?.username).toBe('testuser')
      })

      test('should return null if no Instagram Business Account found', async () => {
        const mockResponse = {
          data: [
            {
              id: 'page-123',
              name: 'Test Page',
            },
          ],
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await getInstagramBusinessAccount('access-token')

        expect(result).toBeNull()
      })
    })
  })

  describe('InstagramClient', () => {
    const mockAccessToken = 'test-access-token'
    const mockIgUserId = '123456789'
    let client: InstagramClient

      // @ts-ignore
    beforeEach(() => {
      client = new InstagramClient(mockAccessToken, mockIgUserId)
    })

    describe('getUser', () => {
      test('should get Instagram user details', async () => {
        const mockResponse = {
          id: mockIgUserId,
          username: 'testuser',
          account_type: 'BUSINESS',
          media_count: 100,
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.getUser()

        expect(result.id).toBe(mockIgUserId)
        expect(result.username).toBe('testuser')
        expect(result.account_type).toBe('BUSINESS')
        expect(result.media_count).toBe(100)
      })
    })

    describe('createMediaContainer', () => {
      test('should create media container for Reels', async () => {
        const mockResponse = {
          id: 'container-123',
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.createMediaContainer({
          videoUrl: 'https://example.com/video.mp4',
          caption: 'Test caption',
          shareToFeed: true,
        })

        expect(result.id).toBe('container-123')
      })

      test('should handle media container creation errors', async () => {
        global.fetch = mock(async () => ({
          ok: false,
          status: 400,
          text: async () => 'Invalid video URL',
        })) as any

        await expect(
          client.createMediaContainer({
            videoUrl: 'invalid-url',
          })
        ).rejects.toThrow('Instagram API error')
      })
    })

    describe('getMediaContainerStatus', () => {
      test('should get media container status', async () => {
        const mockResponse = {
          status: 'IN_PROGRESS',
          status_code: 'IN_PROGRESS',
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.getMediaContainerStatus('container-123')

        expect(result.status).toBe('IN_PROGRESS')
        expect(result.status_code).toBe('IN_PROGRESS')
      })
    })

    describe('publishMedia', () => {
      test('should publish media container', async () => {
        const mockResponse = {
          id: 'media-123',
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.publishMedia('container-123')

        expect(result.id).toBe('media-123')
      })
    })

    describe('getMedia', () => {
      test('should get media details', async () => {
        const mockResponse = {
          id: 'media-123',
          media_type: 'VIDEO',
          media_url: 'https://example.com/video.mp4',
          permalink: 'https://instagram.com/p/abc123',
          caption: 'Test caption',
          timestamp: '2024-01-01T00:00:00Z',
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.getMedia('media-123')

        expect(result.id).toBe('media-123')
        expect(result.permalink).toBe('https://instagram.com/p/abc123')
      })
    })

    describe('getUserMedia', () => {
      test('should get user media list', async () => {
        const mockResponse = {
          data: [
            {
              id: 'media-1',
              media_type: 'VIDEO',
              media_url: 'https://example.com/video1.mp4',
              permalink: 'https://instagram.com/p/abc1',
              timestamp: '2024-01-01T00:00:00Z',
            },
          ],
          paging: {
            cursors: {
              after: 'cursor-123',
            },
          },
        }

        global.fetch = mock(async () => ({
          ok: true,
          json: async () => mockResponse,
        })) as any

        const result = await client.getUserMedia({ limit: 10 })

        expect(result.data).toHaveLength(1)
        expect(result.paging?.cursors?.after).toBe('cursor-123')
      })
    })

    describe('uploadReels', () => {
      test('should upload Reels with complete flow', async () => {
        let callCount = 0
        global.fetch = mock(async () => {
          callCount++
          if (callCount === 1) {
            // createMediaContainer
            return { ok: true, json: async () => ({ id: 'container-123' }) }
          } else if (callCount === 2) {
            // getMediaContainerStatus
            return {
              ok: true,
              json: async () => ({ status: 'FINISHED', status_code: 'FINISHED' }),
            }
          } else if (callCount === 3) {
            // publishMedia
            return { ok: true, json: async () => ({ id: 'media-123' }) }
          } else {
            // getMedia
            return {
              ok: true,
              json: async () => ({
                id: 'media-123',
                media_type: 'VIDEO',
                media_url: 'https://example.com/video.mp4',
                permalink: 'https://instagram.com/p/abc123',
                timestamp: '2024-01-01T00:00:00Z',
              }),
            }
          }
        }) as any

        const result = await client.uploadReels({
          videoUrl: 'https://example.com/video.mp4',
          caption: 'Test caption',
          pollInterval: 10,
          maxAttempts: 5,
        })

        expect(result.mediaId).toBe('media-123')
        expect(result.permalink).toBe('https://instagram.com/p/abc123')
      })

      test('should handle processing timeout', async () => {
        let callCount = 0
        global.fetch = mock(async () => {
          callCount++
          if (callCount === 1) {
            return { ok: true, json: async () => ({ id: 'container-123' }) }
          } else {
            // Always return IN_PROGRESS
            return {
              ok: true,
              json: async () => ({ status: 'IN_PROGRESS', status_code: 'IN_PROGRESS' }),
            }
          }
        }) as any

        await expect(
          client.uploadReels({
            videoUrl: 'https://example.com/video.mp4',
            pollInterval: 10,
            maxAttempts: 2,
          })
        ).rejects.toThrow('Media container processing timeout')
      })

      test('should handle processing error', async () => {
        let callCount = 0
        global.fetch = mock(async () => {
          callCount++
          if (callCount === 1) {
            return { ok: true, json: async () => ({ id: 'container-123' }) }
          } else {
            return {
              ok: true,
              json: async () => ({ status: 'ERROR', status_code: 'ERROR' }),
            }
          }
        }) as any

        await expect(
          client.uploadReels({
            videoUrl: 'https://example.com/video.mp4',
            pollInterval: 10,
          })
        ).rejects.toThrow('Media container processing failed')
      })
    })
  })
})
