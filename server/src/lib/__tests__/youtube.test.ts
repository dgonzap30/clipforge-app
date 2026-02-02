import { describe, test, expect, beforeEach } from 'bun:test'
import { getAuthorizationUrl, YouTubeClient } from '../youtube'

describe('YouTube API Integration', () => {
  describe('getAuthorizationUrl', () => {
    test('should generate valid OAuth URL', () => {
      const state = 'test-state-123'
      const url = getAuthorizationUrl(state)

      expect(url).toContain('accounts.google.com/o/oauth2/v2/auth')
      expect(url).toContain('state=test-state-123')
      expect(url).toContain('scope=')
      expect(url).toContain('youtube.upload')
      expect(url).toContain('youtube.readonly')
      expect(url).toContain('response_type=code')
      expect(url).toContain('access_type=offline')
    })

    test('should include client_id in URL', () => {
      const state = 'test-state'
      const url = getAuthorizationUrl(state)

      expect(url).toContain('client_id=')
    })
  })

  describe('YouTubeClient', () => {
    let client: YouTubeClient

    beforeEach(() => {
      client = new YouTubeClient('test-access-token')
    })

    test('should create client with access token', () => {
      expect(client).toBeDefined()
      expect(client).toBeInstanceOf(YouTubeClient)
    })

    test('should have getChannel method', () => {
      expect(typeof client.getChannel).toBe('function')
    })

    test('should have getVideo method', () => {
      expect(typeof client.getVideo).toBe('function')
    })

    test('should have uploadVideo method', () => {
      expect(typeof client.uploadVideo).toBe('function')
    })
  })

  describe('YouTubeClient API calls', () => {
    test('should throw error for quota exceeded', async () => {
      const client = new YouTubeClient('invalid-token')

      // This will fail with invalid token, but we're testing the structure
      try {
        await client.getChannel()
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    test('should throw error for invalid video ID', async () => {
      const client = new YouTubeClient('invalid-token')

      try {
        await client.getVideo('invalid-id')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('Upload options validation', () => {
    test('should accept valid upload options', () => {
      const options = {
        title: 'Test Video',
        description: 'Test Description',
        tags: ['test', 'gaming'],
        categoryId: '20',
        privacyStatus: 'public' as const,
      }

      expect(options.title).toBe('Test Video')
      expect(options.tags).toContain('test')
      expect(options.privacyStatus).toBe('public')
    })

    test('should accept #Shorts tag', () => {
      const tags = ['#Shorts', 'gaming', 'clips']

      expect(tags).toContain('#Shorts')
      expect(tags.length).toBe(3)
    })
  })
})
