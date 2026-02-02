/**
 * Tests for Transcription and ASS Generation
 */

import { describe, test, expect } from 'bun:test'
import { generateTikTokASS, type TranscriptionSegment, type CaptionAnimations } from './transcribe'

const mockSegments: TranscriptionSegment[] = [
  {
    text: 'Hello world',
    start: 0,
    end: 1.0,
    words: [
      { word: 'Hello', start: 0, end: 0.5, confidence: 0.99 },
      { word: 'world', start: 0.6, end: 1.0, confidence: 0.98 },
    ],
  },
  {
    text: 'This is a test',
    start: 1.5,
    end: 3.0,
    words: [
      { word: 'This', start: 1.5, end: 1.8, confidence: 0.97 },
      { word: 'is', start: 1.9, end: 2.2, confidence: 0.99 },
      { word: 'a', start: 2.3, end: 2.5, confidence: 0.98 },
      { word: 'test', start: 2.6, end: 3.0, confidence: 0.96 },
    ],
  },
]

describe('generateTikTokASS', () => {
  test('should generate valid ASS file with default options', () => {
    const ass = generateTikTokASS(mockSegments)

    expect(ass).toContain('[Script Info]')
    expect(ass).toContain('[V4+ Styles]')
    expect(ass).toContain('[Events]')
    expect(ass).toContain('Dialogue:')
  })

  test('should generate ASS with custom styling', () => {
    const ass = generateTikTokASS(mockSegments, {
      fontSize: 64,
      fontName: 'Impact',
      primaryColor: '&HFFFFFF',
      highlightColor: '&HFF00FF',
      position: 'top',
    })

    expect(ass).toContain('Impact')
    expect(ass).toContain('64')
    expect(ass).toContain('200') // Top position Y coordinate
  })

  test('should include bounce animation when enabled', () => {
    const ass = generateTikTokASS(mockSegments, {
      animations: {
        bounce: true,
        glow: false,
        fadeIn: false,
        intensity: 'medium',
      },
    })

    // Check for scale transform tags
    expect(ass).toContain('\\fscx110')
    expect(ass).toContain('\\fscy110')
    expect(ass).toContain('\\t(')
  })

  test('should include glow animation when enabled', () => {
    const ass = generateTikTokASS(mockSegments, {
      animations: {
        bounce: false,
        glow: true,
        fadeIn: false,
        intensity: 'medium',
      },
    })

    // Check for outline transform tags
    expect(ass).toContain('\\bord5')
    expect(ass).toContain('\\t(')
  })

  test('should include fade-in animation when enabled', () => {
    const ass = generateTikTokASS(mockSegments, {
      animations: {
        bounce: false,
        glow: false,
        fadeIn: true,
        intensity: 'medium',
      },
    })

    // Check for fade effect
    expect(ass).toContain('\\fade(')
  })

  test('should include all animations when all enabled', () => {
    const ass = generateTikTokASS(mockSegments, {
      animations: {
        bounce: true,
        glow: true,
        fadeIn: true,
        intensity: 'medium',
      },
    })

    // Check for all animation tags
    expect(ass).toContain('\\fscx110') // bounce
    expect(ass).toContain('\\bord5') // glow
    expect(ass).toContain('\\fade(') // fade-in
  })

  test('should respect intensity levels', () => {
    const subtleAss = generateTikTokASS(mockSegments, {
      animations: {
        bounce: true,
        glow: true,
        fadeIn: true,
        intensity: 'subtle',
      },
    })

    const strongAss = generateTikTokASS(mockSegments, {
      animations: {
        bounce: true,
        glow: true,
        fadeIn: true,
        intensity: 'strong',
      },
    })

    // Subtle should have lower scale (105%)
    expect(subtleAss).toContain('\\fscx105')

    // Strong should have higher scale (120%)
    expect(strongAss).toContain('\\fscx120')
  })

  test('should work with segments without word-level timing', () => {
    const segmentsNoWords: TranscriptionSegment[] = [
      {
        text: 'No word timing',
        start: 0,
        end: 2.0,
        words: [],
      },
    ]

    const ass = generateTikTokASS(segmentsNoWords)

    expect(ass).toContain('[Events]')
    expect(ass).toContain('Dialogue:')
    expect(ass).toContain('No word timing')
  })

  test('should escape special ASS characters', () => {
    const specialSegments: TranscriptionSegment[] = [
      {
        text: 'Test with {braces}',
        start: 0,
        end: 1.0,
        words: [
          { word: 'Test', start: 0, end: 0.3, confidence: 0.99 },
          { word: 'with', start: 0.3, end: 0.6, confidence: 0.98 },
          { word: '{braces}', start: 0.6, end: 0.8, confidence: 0.97 },
        ],
      },
    ]

    const ass = generateTikTokASS(specialSegments)

    // Check that special characters are escaped
    expect(ass).toContain('\\{')
    expect(ass).toContain('\\}')
  })

  test('should generate word-by-word highlighting', () => {
    const ass = generateTikTokASS(mockSegments)

    // Should have multiple dialogue events (one per word)
    const dialogueCount = (ass.match(/Dialogue:/g) || []).length
    const totalWords = mockSegments.reduce((sum, seg) => sum + seg.words.length, 0)

    expect(dialogueCount).toBe(totalWords)
  })

  test('should use correct position Y coordinates', () => {
    const bottomAss = generateTikTokASS(mockSegments, { position: 'bottom' })
    const centerAss = generateTikTokASS(mockSegments, { position: 'center' })
    const topAss = generateTikTokASS(mockSegments, { position: 'top' })

    expect(bottomAss).toContain('800') // Bottom position
    expect(centerAss).toContain('540') // Center position
    expect(topAss).toContain('200') // Top position
  })

  test('should handle animations with different intensities correctly', () => {
    const animations: CaptionAnimations[] = [
      { bounce: true, glow: true, fadeIn: true, intensity: 'subtle' },
      { bounce: true, glow: true, fadeIn: true, intensity: 'medium' },
      { bounce: true, glow: true, fadeIn: true, intensity: 'strong' },
    ]

    animations.forEach((anim) => {
      const ass = generateTikTokASS(mockSegments, { animations: anim })

      // Verify that animation tags are present
      expect(ass).toContain('\\t(')

      // Verify intensity-specific values
      if (anim.intensity === 'subtle') {
        expect(ass).toContain('\\fscx105')
        expect(ass).toContain('\\bord4')
      } else if (anim.intensity === 'medium') {
        expect(ass).toContain('\\fscx110')
        expect(ass).toContain('\\bord5')
      } else if (anim.intensity === 'strong') {
        expect(ass).toContain('\\fscx120')
        expect(ass).toContain('\\bord6')
      }
    })
  })

  test('should not include animations when all disabled', () => {
    const ass = generateTikTokASS(mockSegments, {
      animations: {
        bounce: false,
        glow: false,
        fadeIn: false,
        intensity: 'medium',
      },
    })

    // Should not have animation tags
    expect(ass).not.toContain('\\fscx110')
    expect(ass).not.toContain('\\bord5')
    expect(ass).not.toContain('\\fade(')
  })
})
