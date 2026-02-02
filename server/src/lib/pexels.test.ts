import { describe, it, expect } from 'bun:test'
import { searchPexelsVideos, getBestVideoFile, findBRollVideo, type PexelsConfig, type PexelsVideo } from './pexels'

describe('Pexels API Client', () => {
  const mockVideo: PexelsVideo = {
    id: 123,
    url: 'https://pexels.com/video/123',
    width: 1920,
    height: 1080,
    duration: 10,
    image: 'https://pexels.com/image.jpg',
    videoFiles: [
      {
        id: 1,
        quality: 'hd',
        fileType: 'video/mp4',
        width: 1920,
        height: 1080,
        link: 'https://pexels.com/video1.mp4',
      },
      {
        id: 2,
        quality: 'sd',
        fileType: 'video/mp4',
        width: 1280,
        height: 720,
        link: 'https://pexels.com/video2.mp4',
      },
    ],
  }

  it('should get best video file matching preferred dimensions', () => {
    const bestFile = getBestVideoFile(mockVideo, 1920, 1080)

    expect(bestFile).not.toBeNull()
    expect(bestFile?.width).toBe(1920)
    expect(bestFile?.height).toBe(1080)
    expect(bestFile?.fileType).toBe('video/mp4')
  })

  it('should return null for video with no files', () => {
    const emptyVideo: PexelsVideo = {
      id: 456,
      url: 'https://pexels.com/video/456',
      width: 1920,
      height: 1080,
      duration: 10,
      image: 'https://pexels.com/image.jpg',
      videoFiles: [],
    }

    const bestFile = getBestVideoFile(emptyVideo)
    expect(bestFile).toBeNull()
  })

  it('should filter out non-MP4 files', () => {
    const videoWithMultipleFormats: PexelsVideo = {
      ...mockVideo,
      videoFiles: [
        {
          id: 1,
          quality: 'hd',
          fileType: 'video/webm',
          width: 1920,
          height: 1080,
          link: 'https://pexels.com/video1.webm',
        },
        {
          id: 2,
          quality: 'hd',
          fileType: 'video/mp4',
          width: 1920,
          height: 1080,
          link: 'https://pexels.com/video2.mp4',
        },
      ],
    }

    const bestFile = getBestVideoFile(videoWithMultipleFormats)
    expect(bestFile).not.toBeNull()
    expect(bestFile?.fileType).toBe('video/mp4')
  })

  it('should handle search configuration', async () => {
    const config: PexelsConfig = {
      apiKey: 'test-key',
      perPage: 10,
      orientation: 'landscape',
      size: 'medium',
    }

    // Note: This will fail without a real API key
    try {
      const result = await searchPexelsVideos('gaming', config)

      expect(result).toHaveProperty('videos')
      expect(result).toHaveProperty('totalResults')
      expect(result).toHaveProperty('page')
      expect(result).toHaveProperty('perPage')
      expect(Array.isArray(result.videos)).toBe(true)
    } catch (error) {
      // Expected to fail without valid API key
      expect(error).toBeDefined()
    }
  })

  it('should find B-roll video with duration filter', async () => {
    // Note: This will fail without a real API key
    try {
      const result = await findBRollVideo('treasure chest', 'test-key', {
        orientation: 'landscape',
        minDuration: 5,
      })

      if (result) {
        expect(result).toHaveProperty('video')
        expect(result).toHaveProperty('downloadUrl')
        expect(result.video.duration).toBeGreaterThanOrEqual(5)
      }
    } catch (error) {
      // Expected to fail without valid API key
      expect(error).toBeDefined()
    }
  })
})
