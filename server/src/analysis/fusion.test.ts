/**
 * Tests for Signal Fusion Module with Transcript Support
 */

import { describe, it, expect } from 'vitest'
import {
  fuseSignals,
  estimateClipQuality,
  type SignalMoment,
  type FusionConfig,
} from './fusion'
import type { ChatMoment } from './chat'
import type { AudioMoment } from './audio'
import type { TranscriptMoment } from './transcript'

describe('Signal Fusion with Transcript', () => {
  const mockChatMoments: ChatMoment[] = [
    {
      timestamp: 10,
      velocity: 8,
      emoteScore: 1.5,
      hydeScore: 75,
      peakMessages: ['POGGERS', 'LUL', 'LETSGO'],
    },
  ]

  const mockAudioMoments: AudioMoment[] = [
    {
      timestamp: 12,
      amplitude: 0.9,
      rmsLevel: 0.6,
      hydeScore: 80,
      type: 'peak',
    },
  ]

  const mockTranscriptMoments: TranscriptMoment[] = [
    {
      timestamp: 11,
      duration: 8,
      hydeScore: 85,
      type: 'funny',
      excerpt: 'That was insane!',
      reasoning: 'Excited reaction to gameplay',
      confidence: 0.9,
    },
  ]

  describe('fuseSignals with transcript', () => {
    it('should include transcript signal in fusion', () => {
      const moments = fuseSignals(
        mockChatMoments,
        mockAudioMoments,
        [],
        mockTranscriptMoments
      )

      expect(moments.length).toBeGreaterThan(0)
      const moment = moments.find(m => m.signals.transcript)
      expect(moment).toBeDefined()
      expect(moment?.signals.transcript?.score).toBe(85)
      expect(moment?.signals.transcript?.type).toBe('funny')
      expect(moment?.signals.transcript?.excerpt).toBe('That was insane!')
    })

    it('should apply convergence bonus with transcript', () => {
      const moments = fuseSignals(
        mockChatMoments,
        mockAudioMoments,
        [],
        mockTranscriptMoments
      )

      // All three signals should converge around timestamp 10-12
      const convergentMoment = moments.find(
        m => m.signals.chat && m.signals.audio && m.signals.transcript
      )

      expect(convergentMoment).toBeDefined()
      expect(convergentMoment?.confidence).toBeGreaterThan(0.5) // 3 out of 4 signals
    })

    it('should use transcript duration for clip length', () => {
      const transcriptWithLongDuration: TranscriptMoment[] = [
        {
          timestamp: 10,
          duration: 25,
          hydeScore: 80,
          type: 'narrative',
          excerpt: 'Long story being told',
          reasoning: 'Important narrative moment',
          confidence: 0.85,
        },
      ]

      const moments = fuseSignals([], [], [], transcriptWithLongDuration)

      const moment = moments[0]
      expect(moment.duration).toBeGreaterThan(20)
    })

    it('should calculate correct weights with transcript', () => {
      const customConfig: Partial<FusionConfig> = {
        weights: {
          chat: 0.25,
          audio: 0.25,
          transcript: 0.4,
          clips: 0.1,
        },
      }

      const moments = fuseSignals(
        mockChatMoments,
        mockAudioMoments,
        [],
        mockTranscriptMoments,
        customConfig
      )

      expect(moments.length).toBeGreaterThan(0)
      // Transcript has highest weight, so should influence score significantly
      const moment = moments.find(m => m.signals.transcript)
      expect(moment?.score).toBeGreaterThan(50)
    })

    it('should work with only transcript signal', () => {
      const moments = fuseSignals([], [], [], mockTranscriptMoments)

      expect(moments.length).toBeGreaterThan(0)
      expect(moments[0].signals.transcript).toBeDefined()
      expect(moments[0].confidence).toBeCloseTo(0.25, 1) // 1 out of 4 signals
    })

    it('should handle multiple transcript moments', () => {
      const multipleTranscripts: TranscriptMoment[] = [
        {
          timestamp: 5,
          duration: 8,
          hydeScore: 70,
          type: 'funny',
          excerpt: 'First funny moment',
          reasoning: 'Joke',
          confidence: 0.8,
        },
        {
          timestamp: 20,
          duration: 10,
          hydeScore: 80,
          type: 'intense',
          excerpt: 'Clutch play',
          reasoning: 'Exciting',
          confidence: 0.9,
        },
        {
          timestamp: 35,
          duration: 7,
          hydeScore: 75,
          type: 'quotable',
          excerpt: 'Memorable quote',
          reasoning: 'Catchy',
          confidence: 0.85,
        },
      ]

      const moments = fuseSignals([], [], [], multipleTranscripts)

      expect(moments.length).toBeGreaterThanOrEqual(3)
      expect(moments.some(m => m.signals.transcript?.type === 'funny')).toBe(true)
      expect(moments.some(m => m.signals.transcript?.type === 'intense')).toBe(true)
      expect(moments.some(m => m.signals.transcript?.type === 'quotable')).toBe(true)
    })

    it('should use transcript excerpt for title generation', () => {
      const transcriptWithGoodExcerpt: TranscriptMoment[] = [
        {
          timestamp: 10,
          duration: 8,
          hydeScore: 85,
          type: 'quotable',
          excerpt: 'This is the best quote ever',
          reasoning: 'Very memorable',
          confidence: 0.95,
        },
      ]

      const moments = fuseSignals([], [], [], transcriptWithGoodExcerpt)

      expect(moments[0].suggestedTitle).toContain('This is the best quote ever')
    })

    it('should truncate long excerpts in titles', () => {
      const transcriptWithLongExcerpt: TranscriptMoment[] = [
        {
          timestamp: 10,
          duration: 8,
          hydeScore: 85,
          type: 'quotable',
          excerpt: 'This is an extremely long excerpt that should be truncated because it exceeds the maximum length',
          reasoning: 'Too long',
          confidence: 0.9,
        },
      ]

      const moments = fuseSignals([], [], [], transcriptWithLongExcerpt)

      expect(moments[0].suggestedTitle).toBeDefined()
      expect(moments[0].suggestedTitle!.length).toBeLessThanOrEqual(50)
      expect(moments[0].suggestedTitle).toContain('...')
    })

    it('should handle all signal types together', () => {
      const viewerClips = [
        {
          timestamp: 11,
          duration: 15,
          viewCount: 1000,
          title: 'Epic moment',
        },
      ]

      const moments = fuseSignals(
        mockChatMoments,
        mockAudioMoments,
        viewerClips,
        mockTranscriptMoments
      )

      const fullMoment = moments.find(
        m =>
          m.signals.chat &&
          m.signals.audio &&
          m.signals.transcript &&
          m.signals.clips
      )

      expect(fullMoment).toBeDefined()
      expect(fullMoment?.confidence).toBe(1.0) // All 4 signals present
      expect(fullMoment?.score).toBeGreaterThan(80) // High convergence
    })
  })

  describe('estimateClipQuality with transcript', () => {
    it('should rate transcript-heavy moments appropriately', () => {
      const transcriptMoment: SignalMoment = {
        timestamp: 10,
        duration: 15,
        score: 85,
        confidence: 0.75,
        signals: {
          transcript: {
            score: 90,
            type: 'funny',
            excerpt: 'Hilarious moment',
          },
          chat: {
            score: 80,
            velocity: 7,
          },
          audio: {
            score: 75,
            type: 'peak',
          },
        },
      }

      const quality = estimateClipQuality(transcriptMoment)
      expect(quality.quality).toBe('high')
      expect(quality.reasons.length).toBeGreaterThan(0)
    })

    it('should handle moments with only transcript signal', () => {
      const transcriptOnlyMoment: SignalMoment = {
        timestamp: 10,
        duration: 15,
        score: 70,
        confidence: 0.25,
        signals: {
          transcript: {
            score: 70,
            type: 'quotable',
            excerpt: 'Good quote',
          },
        },
      }

      const quality = estimateClipQuality(transcriptOnlyMoment)
      // With score 70 and confidence 0.25, should be medium (needs confidence >= 0.5 for high)
      expect(quality.quality).toBe('medium')
      expect(quality.reasons).toContain('High combined score')
    })
  })

  describe('default config weights', () => {
    it('should use balanced weights including transcript', () => {
      const moments = fuseSignals(
        mockChatMoments,
        mockAudioMoments,
        [],
        mockTranscriptMoments
      )

      // Default weights are: chat 0.3, audio 0.3, transcript 0.3, clips 0.1
      expect(moments.length).toBeGreaterThan(0)
      // All signals should contribute meaningfully
      const moment = moments.find(
        m => m.signals.chat && m.signals.audio && m.signals.transcript
      )
      expect(moment).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty transcript moments array', () => {
      const moments = fuseSignals(mockChatMoments, mockAudioMoments, [], [])

      expect(moments.length).toBeGreaterThan(0)
      expect(moments[0].signals.transcript).toBeUndefined()
    })

    it('should handle transcript moment with low confidence', () => {
      const lowConfidenceTranscript: TranscriptMoment[] = [
        {
          timestamp: 10,
          duration: 8,
          hydeScore: 75, // Increased to pass minScore threshold (75 * 0.3 = 22.5 > 20)
          type: 'quotable',
          excerpt: 'Uncertain moment',
          reasoning: 'Not sure',
          confidence: 0.2,
        },
      ]

      const moments = fuseSignals([], [], [], lowConfidenceTranscript)

      expect(moments.length).toBeGreaterThan(0)
      // Score should still be included despite low confidence
      expect(moments[0].signals.transcript?.score).toBe(75)
      expect(moments[0].confidence).toBeCloseTo(0.25, 2) // 1 out of 4 signals
    })

    it('should prioritize transcript type in title when available', () => {
      const moments = fuseSignals([], [], [], [
        {
          timestamp: 10,
          duration: 8,
          hydeScore: 85,
          type: 'funny',
          excerpt: '',
          reasoning: 'Hilarious',
          confidence: 0.9,
        },
      ])

      expect(moments[0].suggestedTitle).toContain('Hilarious')
    })
  })
})
