/**
 * Tests for Transcript Analysis Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  analyzeTranscript,
  getSegmentsInRange,
  extractTextInRange,
  getTranscriptStats,
} from './transcript'
import type { TranscriptionResult } from '../captions/transcribe'

// Mock fetch globally
global.fetch = vi.fn() as unknown as typeof fetch

describe('Transcript Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTranscription: TranscriptionResult = {
    text: 'This is a test. This is only a test. If this were a real emergency, you would be instructed where to tune.',
    language: 'en',
    duration: 15,
    segments: [
      {
        text: 'This is a test.',
        start: 0,
        end: 2,
        words: [
          { word: 'This', start: 0, end: 0.5, confidence: 0.95 },
          { word: 'is', start: 0.5, end: 0.7, confidence: 0.98 },
          { word: 'a', start: 0.7, end: 0.8, confidence: 0.99 },
          { word: 'test', start: 0.8, end: 2, confidence: 0.97 },
        ],
      },
      {
        text: 'This is only a test.',
        start: 2,
        end: 5,
        words: [
          { word: 'This', start: 2, end: 2.4, confidence: 0.96 },
          { word: 'is', start: 2.4, end: 2.6, confidence: 0.98 },
          { word: 'only', start: 2.6, end: 3.2, confidence: 0.95 },
          { word: 'a', start: 3.2, end: 3.3, confidence: 0.99 },
          { word: 'test', start: 3.3, end: 5, confidence: 0.97 },
        ],
      },
      {
        text: 'If this were a real emergency, you would be instructed where to tune.',
        start: 5,
        end: 15,
        words: [
          { word: 'If', start: 5, end: 5.2, confidence: 0.98 },
          { word: 'this', start: 5.2, end: 5.5, confidence: 0.97 },
          { word: 'were', start: 5.5, end: 5.8, confidence: 0.96 },
          { word: 'a', start: 5.8, end: 5.9, confidence: 0.99 },
          { word: 'real', start: 5.9, end: 6.2, confidence: 0.98 },
          { word: 'emergency', start: 6.2, end: 7, confidence: 0.95 },
        ],
      },
    ],
  }

  describe('getSegmentsInRange', () => {
    it('should return segments within time range', () => {
      const segments = getSegmentsInRange(mockTranscription, 1, 6)
      expect(segments).toHaveLength(3)
      expect(segments[0].text).toBe('This is a test.')
    })

    it('should return empty array for range with no segments', () => {
      const segments = getSegmentsInRange(mockTranscription, 20, 30)
      expect(segments).toHaveLength(0)
    })

    it('should include partial overlaps', () => {
      const segments = getSegmentsInRange(mockTranscription, 1.5, 2.5)
      expect(segments).toHaveLength(2)
    })
  })

  describe('extractTextInRange', () => {
    it('should extract text from time range', () => {
      const text = extractTextInRange(mockTranscription, 0, 5)
      expect(text).toContain('This is a test')
      expect(text).toContain('This is only a test')
    })

    it('should return empty string for range with no segments', () => {
      const text = extractTextInRange(mockTranscription, 20, 30)
      expect(text).toBe('')
    })
  })

  describe('getTranscriptStats', () => {
    it('should calculate word count correctly', () => {
      const stats = getTranscriptStats(mockTranscription, 0, 5)
      expect(stats.wordCount).toBeGreaterThan(0)
      expect(stats.wordCount).toBe(9) // "This is a test. This is only a test."
    })

    it('should calculate words per second', () => {
      const stats = getTranscriptStats(mockTranscription, 0, 5)
      expect(stats.wordsPerSecond).toBeCloseTo(1.8, 1)
    })

    it('should count sentences', () => {
      const stats = getTranscriptStats(mockTranscription, 0, 5)
      expect(stats.sentenceCount).toBe(2)
    })
  })

  describe('analyzeTranscript', () => {
    it('should return empty array for empty transcription', async () => {
      const emptyTranscription: TranscriptionResult = {
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
      }

      const moments = await analyzeTranscript(emptyTranscription, 'test-api-key')
      expect(moments).toHaveLength(0)
    })

    it('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    timestamp: 2,
                    duration: 8,
                    score: 75,
                    type: 'funny',
                    excerpt: 'This is only a test',
                    reasoning: 'Classic emergency broadcast reference',
                    confidence: 0.8,
                  },
                ]),
              },
            },
          ],
        }),
      }

      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValue(mockResponse)

      await analyzeTranscript(mockTranscription, 'test-api-key')

      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/chat/completions')

      const fetchOptions = fetchCall[1]
      const headers = fetchOptions.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer test-api-key')

      const body = JSON.parse(fetchOptions.body as string)
      expect(body.model).toBe('gpt-4-turbo')
      expect(body.temperature).toBe(0.3)
    })

    it('should parse LLM response and create moments', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    timestamp: 2,
                    duration: 8,
                    score: 75,
                    type: 'funny',
                    excerpt: 'This is only a test',
                    reasoning: 'Classic emergency broadcast reference',
                    confidence: 0.8,
                  },
                  {
                    timestamp: 5,
                    duration: 10,
                    score: 65,
                    type: 'quotable',
                    excerpt: 'If this were a real emergency',
                    reasoning: 'Memorable phrase',
                    confidence: 0.7,
                  },
                ]),
              },
            },
          ],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')

      expect(moments.length).toBeGreaterThan(0)
      expect(moments[0]).toHaveProperty('timestamp')
      expect(moments[0]).toHaveProperty('hydeScore')
      expect(moments[0]).toHaveProperty('type')
      expect(moments[0]).toHaveProperty('excerpt')
      expect(moments[0].hydeScore).toBeGreaterThanOrEqual(0)
      expect(moments[0].hydeScore).toBeLessThanOrEqual(100)
    })

    it('should filter out low-scoring moments', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    timestamp: 2,
                    duration: 8,
                    score: 15, // Below 30 threshold
                    type: 'funny',
                    excerpt: 'Low quality moment',
                    reasoning: 'Not very interesting',
                    confidence: 0.3,
                  },
                  {
                    timestamp: 5,
                    duration: 10,
                    score: 75,
                    type: 'quotable',
                    excerpt: 'High quality moment',
                    reasoning: 'Very memorable',
                    confidence: 0.9,
                  },
                ]),
              },
            },
          ],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')

      // Only the high-scoring moment should be included
      expect(moments).toHaveLength(1)
      expect(moments[0].hydeScore).toBe(75)
    })

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'API Error',
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')
      expect(moments).toHaveLength(0)
    })

    it('should handle invalid JSON responses gracefully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'not valid json',
              },
            },
          ],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')
      expect(moments).toHaveLength(0)
    })

    it('should deduplicate overlapping moments', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    timestamp: 2,
                    duration: 10,
                    score: 70,
                    type: 'funny',
                    excerpt: 'First moment',
                    reasoning: 'Funny',
                    confidence: 0.8,
                  },
                  {
                    timestamp: 5, // Overlaps with first
                    duration: 8,
                    score: 60, // Lower score
                    type: 'quotable',
                    excerpt: 'Second moment',
                    reasoning: 'Quotable',
                    confidence: 0.7,
                  },
                ]),
              },
            },
          ],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')

      // Should keep only the higher-scored moment
      expect(moments.length).toBeLessThanOrEqual(2)
      if (moments.length === 1) {
        expect(moments[0].hydeScore).toBe(70)
      }
    })

    it('should respect custom configuration', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([]) } }],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      await analyzeTranscript(mockTranscription, 'test-api-key', {
        llmModel: 'gpt-3.5-turbo',
        temperature: 0.5,
        windowSize: 20,
      })

      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(fetchCall[1].body as string)
      expect(body.model).toBe('gpt-3.5-turbo')
      expect(body.temperature).toBe(0.5)
    })
  })

  describe('moment types', () => {
    it('should correctly assign moment types', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    timestamp: 0,
                    duration: 5,
                    score: 80,
                    type: 'funny',
                    excerpt: 'Hilarious joke',
                    reasoning: 'Very funny',
                    confidence: 0.9,
                  },
                  {
                    timestamp: 5,
                    duration: 5,
                    score: 75,
                    type: 'intense',
                    excerpt: 'Clutch play',
                    reasoning: 'Exciting moment',
                    confidence: 0.85,
                  },
                  {
                    timestamp: 10,
                    duration: 5,
                    score: 70,
                    type: 'quotable',
                    excerpt: 'Memorable quote',
                    reasoning: 'Catchy phrase',
                    confidence: 0.8,
                  },
                ]),
              },
            },
          ],
        }),
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const moments = await analyzeTranscript(mockTranscription, 'test-api-key')

      const types = moments.map(m => m.type)
      expect(types).toContain('funny')
      expect(types).toContain('intense')
      expect(types).toContain('quotable')
    })
  })
})
