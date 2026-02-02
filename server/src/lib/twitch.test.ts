/**
 * Tests for Twitch API client
 */

import { describe, test, expect, mock } from 'bun:test'
import { TwitchClient, type TwitchClip, type TwitchVideo, parseTwitchDuration } from './twitch'

describe('TwitchClient', () => {
  describe('getClipsForVOD', () => {
    test('should fetch clips for a specific VOD', async () => {
      const mockVideo: TwitchVideo = {
        id: '123456789',
        stream_id: 'stream-123',
        user_id: 'broadcaster-456',
        user_login: 'testuser',
        user_name: 'TestUser',
        title: 'Test Stream',
        description: 'Test description',
        created_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        url: 'https://twitch.tv/videos/123456789',
        thumbnail_url: 'https://example.com/thumb.jpg',
        viewable: 'public',
        view_count: 1000,
        language: 'en',
        type: 'archive',
        duration: '1h30m0s',
        muted_segments: null,
      }

      const mockClips: TwitchClip[] = [
        {
          id: 'clip-1',
          url: 'https://twitch.tv/clip1',
          embed_url: 'https://clips.twitch.tv/embed?clip=clip-1',
          broadcaster_id: 'broadcaster-456',
          broadcaster_name: 'TestUser',
          creator_id: 'viewer-1',
          creator_name: 'Viewer1',
          video_id: '123456789',
          game_id: 'game-123',
          language: 'en',
          title: 'Epic moment',
          view_count: 5000,
          created_at: '2024-01-01T00:30:00Z',
          thumbnail_url: 'https://example.com/clip1.jpg',
          duration: 30,
          vod_offset: 1800, // 30 minutes into VOD
        },
        {
          id: 'clip-2',
          url: 'https://twitch.tv/clip2',
          embed_url: 'https://clips.twitch.tv/embed?clip=clip-2',
          broadcaster_id: 'broadcaster-456',
          broadcaster_name: 'TestUser',
          creator_id: 'viewer-2',
          creator_name: 'Viewer2',
          video_id: '123456789',
          game_id: 'game-123',
          language: 'en',
          title: 'Funny fail',
          view_count: 3000,
          created_at: '2024-01-01T01:00:00Z',
          thumbnail_url: 'https://example.com/clip2.jpg',
          duration: 25,
          vod_offset: 3600, // 60 minutes into VOD
        },
        {
          id: 'clip-3',
          url: 'https://twitch.tv/clip3',
          embed_url: 'https://clips.twitch.tv/embed?clip=clip-3',
          broadcaster_id: 'broadcaster-456',
          broadcaster_name: 'TestUser',
          creator_id: 'viewer-3',
          creator_name: 'Viewer3',
          video_id: 'different-video', // Different VOD
          game_id: 'game-123',
          language: 'en',
          title: 'Should be filtered out',
          view_count: 2000,
          created_at: '2024-01-01T00:45:00Z',
          thumbnail_url: 'https://example.com/clip3.jpg',
          duration: 20,
          vod_offset: 2700,
        },
      ]

      // Mock the client methods
      const client = new TwitchClient('fake-token')
      client.getVideo = mock(async () => mockVideo)
      client.request = mock(async () => ({
        data: mockClips,
        pagination: {},
      }))

      const result = await client.getClipsForVOD('123456789')

      // Should only return clips from the specific VOD
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('clip-1')
      expect(result[0].vod_offset).toBe(1800)
      expect(result[1].id).toBe('clip-2')
      expect(result[1].vod_offset).toBe(3600)
    })

    test('should return empty array if video not found', async () => {
      const client = new TwitchClient('fake-token')
      client.getVideo = mock(async () => null)

      const result = await client.getClipsForVOD('nonexistent')

      expect(result).toEqual([])
    })

    test('should handle pagination correctly', async () => {
      const mockVideo: TwitchVideo = {
        id: '123',
        stream_id: null,
        user_id: 'user-1',
        user_login: 'test',
        user_name: 'Test',
        title: 'Test',
        description: '',
        created_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        url: 'https://twitch.tv/videos/123',
        thumbnail_url: 'thumb.jpg',
        viewable: 'public',
        view_count: 100,
        language: 'en',
        type: 'archive',
        duration: '1h0m0s',
        muted_segments: null,
      }

      const client = new TwitchClient('fake-token')
      client.getVideo = mock(async () => mockVideo)

      let callCount = 0
      client.request = mock(async () => {
        callCount++
        if (callCount === 1) {
          // First page
          return {
            data: [
              {
                id: 'clip-1',
                video_id: '123',
                vod_offset: 100,
                url: '',
                embed_url: '',
                broadcaster_id: 'user-1',
                broadcaster_name: 'Test',
                creator_id: 'c1',
                creator_name: 'C1',
                game_id: 'g1',
                language: 'en',
                title: 'Clip 1',
                view_count: 100,
                created_at: '2024-01-01T00:10:00Z',
                thumbnail_url: 'thumb1.jpg',
                duration: 20,
              },
            ],
            pagination: { cursor: 'next-page' },
          }
        } else {
          // Second page
          return {
            data: [
              {
                id: 'clip-2',
                video_id: '123',
                vod_offset: 200,
                url: '',
                embed_url: '',
                broadcaster_id: 'user-1',
                broadcaster_name: 'Test',
                creator_id: 'c2',
                creator_name: 'C2',
                game_id: 'g1',
                language: 'en',
                title: 'Clip 2',
                view_count: 200,
                created_at: '2024-01-01T00:20:00Z',
                thumbnail_url: 'thumb2.jpg',
                duration: 25,
              },
            ],
            pagination: {},
          }
        }
      })

      const result = await client.getClipsForVOD('123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('clip-1')
      expect(result[1].id).toBe('clip-2')
    })
  })

  describe('parseTwitchDuration', () => {
    test('should parse hours, minutes, and seconds', () => {
      expect(parseTwitchDuration('1h30m15s')).toBe(5415)
      expect(parseTwitchDuration('2h0m0s')).toBe(7200)
      expect(parseTwitchDuration('0h45m30s')).toBe(2730)
    })

    test('should handle missing components', () => {
      expect(parseTwitchDuration('1h')).toBe(3600)
      expect(parseTwitchDuration('30m')).toBe(1800)
      expect(parseTwitchDuration('45s')).toBe(45)
      expect(parseTwitchDuration('1h30s')).toBe(3630)
    })

    test('should return 0 for invalid format', () => {
      expect(parseTwitchDuration('')).toBe(0)
      expect(parseTwitchDuration('invalid')).toBe(0)
    })
  })
})
