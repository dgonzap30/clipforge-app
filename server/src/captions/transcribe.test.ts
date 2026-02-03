/**
 * Tests for transcription, filler word removal, animations, and caption style presets
 */

import { describe, test, expect } from 'bun:test'
import {
  removeFillerWords,
  generateTikTokASS,
  CAPTION_PRESETS,
  type TranscriptionResult,
  type TranscribeConfig,
  type TranscriptionSegment,
  type CaptionAnimations,
} from './transcribe'

describe('removeFillerWords', () => {
  test('should return original result when removeFillers is false', () => {
    const input: TranscriptionResult = {
      text: 'um hello world',
      segments: [
        {
          text: 'um hello world',
          start: 0,
          end: 1.5,
          words: [
            { word: 'um', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello', start: 0.3, end: 0.8, confidence: 0.95 },
            { word: 'world', start: 0.9, end: 1.5, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 1.5,
    }

    const config: TranscribeConfig = { removeFillers: false }
    const result = removeFillerWords(input, config)

    expect(result).toEqual(input)
  })

  test('should return original result when config is empty', () => {
    const input: TranscriptionResult = {
      text: 'um hello world',
      segments: [
        {
          text: 'um hello world',
          start: 0,
          end: 1.5,
          words: [
            { word: 'um', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello', start: 0.3, end: 0.8, confidence: 0.95 },
            { word: 'world', start: 0.9, end: 1.5, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 1.5,
    }

    const result = removeFillerWords(input, {})

    expect(result).toEqual(input)
  })

  test('should remove default filler words', () => {
    const input: TranscriptionResult = {
      text: 'um hello like world uh',
      segments: [
        {
          text: 'um hello like world uh',
          start: 0,
          end: 2.0,
          words: [
            { word: 'um', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello', start: 0.3, end: 0.8, confidence: 0.95 },
            { word: 'like', start: 0.9, end: 1.1, confidence: 0.88 },
            { word: 'world', start: 1.2, end: 1.7, confidence: 0.96 },
            { word: 'uh', start: 1.8, end: 2.0, confidence: 0.85 },
          ],
        },
      ],
      language: 'en',
      duration: 2.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0].words).toHaveLength(2)
    expect(result.segments[0].words[0].word).toBe('hello')
    expect(result.segments[0].words[1].word).toBe('world')
    expect(result.text).toBe('hello world')
  })

  test('should adjust timestamps after removing fillers', () => {
    const input: TranscriptionResult = {
      text: 'um hello world',
      segments: [
        {
          text: 'um hello world',
          start: 0,
          end: 1.5,
          words: [
            { word: 'um', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello', start: 0.3, end: 0.8, confidence: 0.95 },
            { word: 'world', start: 0.9, end: 1.5, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 1.5,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // "um" takes 0.2s, so subsequent words should be shifted by 0.2s
    expect(result.segments[0].words[0].start).toBeCloseTo(0.1, 5) // 0.3 - 0.2
    expect(result.segments[0].words[0].end).toBeCloseTo(0.6, 5) // 0.8 - 0.2
    expect(result.segments[0].words[1].start).toBeCloseTo(0.7, 5) // 0.9 - 0.2
    expect(result.segments[0].words[1].end).toBeCloseTo(1.3, 5) // 1.5 - 0.2
  })

  test('should preserve natural pauses (>1s gaps)', () => {
    const input: TranscriptionResult = {
      text: 'hello um world',
      segments: [
        {
          text: 'hello um world',
          start: 0,
          end: 3.0,
          words: [
            { word: 'hello', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'um', start: 0.6, end: 0.8, confidence: 0.9 },
            // 1.2 second gap after "um" (natural pause)
            { word: 'world', start: 2.0, end: 3.0, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 3.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // "um" should be removed, but the gap should be preserved
    // "world" should not be adjusted because gap > 1s
    expect(result.segments[0].words).toHaveLength(2)
    expect(result.segments[0].words[0].word).toBe('hello')
    expect(result.segments[0].words[1].word).toBe('world')
    expect(result.segments[0].words[1].start).toBe(2.0) // Unchanged
  })

  test('should keep filler words at the start of sentences', () => {
    const input: TranscriptionResult = {
      text: 'hello. um how are you',
      segments: [
        {
          text: 'hello. um how are you',
          start: 0,
          end: 2.5,
          words: [
            { word: 'hello.', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'um', start: 0.6, end: 0.8, confidence: 0.9 },
            { word: 'how', start: 0.9, end: 1.2, confidence: 0.94 },
            { word: 'are', start: 1.3, end: 1.6, confidence: 0.93 },
            { word: 'you', start: 1.7, end: 2.5, confidence: 0.95 },
          ],
        },
      ],
      language: 'en',
      duration: 2.5,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // "um" should be kept because it's after a period (sentence start)
    expect(result.segments[0].words.map(w => w.word)).toEqual([
      'hello.',
      'um',
      'how',
      'are',
      'you',
    ])
  })

  test('should keep emphasized filler words (high confidence >= 0.95)', () => {
    const input: TranscriptionResult = {
      text: 'I LIKE this',
      segments: [
        {
          text: 'I LIKE this',
          start: 0,
          end: 1.5,
          words: [
            { word: 'I', start: 0, end: 0.2, confidence: 0.94 },
            { word: 'LIKE', start: 0.3, end: 0.8, confidence: 0.97 }, // Emphasized
            { word: 'this', start: 0.9, end: 1.5, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 1.5,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // "LIKE" should be kept because confidence >= 0.95 (emphasized)
    expect(result.segments[0].words.map(w => w.word)).toEqual(['I', 'LIKE', 'this'])
  })

  test('should use custom filler words when provided', () => {
    const input: TranscriptionResult = {
      text: 'hello foo world bar',
      segments: [
        {
          text: 'hello foo world bar',
          start: 0,
          end: 2.0,
          words: [
            { word: 'hello', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'foo', start: 0.6, end: 0.8, confidence: 0.9 },
            { word: 'world', start: 0.9, end: 1.4, confidence: 0.96 },
            { word: 'bar', start: 1.5, end: 2.0, confidence: 0.88 },
          ],
        },
      ],
      language: 'en',
      duration: 2.0,
    }

    const config: TranscribeConfig = {
      removeFillers: true,
      customFillerWords: ['foo', 'bar'],
    }
    const result = removeFillerWords(input, config)

    expect(result.segments[0].words.map(w => w.word)).toEqual(['hello', 'world'])
    expect(result.text).toBe('hello world')
  })

  test('should handle multiple segments', () => {
    const input: TranscriptionResult = {
      text: 'um hello. like world.',
      segments: [
        {
          text: 'um hello.',
          start: 0,
          end: 1.0,
          words: [
            { word: 'um', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello.', start: 0.3, end: 1.0, confidence: 0.95 },
          ],
        },
        {
          text: 'like world.',
          start: 1.5,
          end: 2.5,
          words: [
            { word: 'like', start: 1.5, end: 1.7, confidence: 0.88 },
            { word: 'world.', start: 1.8, end: 2.5, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 2.5,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].words.map(w => w.word)).toEqual(['hello.'])
    expect(result.segments[1].words.map(w => w.word)).toEqual(['world.'])
    expect(result.text).toBe('hello. world.')
  })

  test('should remove empty segments after filler removal', () => {
    const input: TranscriptionResult = {
      text: 'um uh like',
      segments: [
        {
          text: 'um uh like',
          start: 0,
          end: 1.0,
          words: [
            { word: 'um', start: 0, end: 0.3, confidence: 0.9 },
            { word: 'uh', start: 0.4, end: 0.6, confidence: 0.88 },
            { word: 'like', start: 0.7, end: 1.0, confidence: 0.87 },
          ],
        },
      ],
      language: 'en',
      duration: 1.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // All words are fillers, so segment should be removed
    expect(result.segments).toHaveLength(0)
    expect(result.text).toBe('')
  })

  test('should handle segments without word-level timestamps', () => {
    const input: TranscriptionResult = {
      text: 'hello world',
      segments: [
        {
          text: 'hello world',
          start: 0,
          end: 1.5,
          words: [], // No word-level timing
        },
      ],
      language: 'en',
      duration: 1.5,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // Should return segment unchanged when no word-level timing
    expect(result.segments[0]).toEqual(input.segments[0])
  })

  test('should handle case-insensitive filler word matching', () => {
    const input: TranscriptionResult = {
      text: 'UM hello LIKE world',
      segments: [
        {
          text: 'UM hello LIKE world',
          start: 0,
          end: 2.0,
          words: [
            { word: 'UM', start: 0, end: 0.2, confidence: 0.9 },
            { word: 'hello', start: 0.3, end: 0.8, confidence: 0.95 },
            { word: 'LIKE', start: 0.9, end: 1.1, confidence: 0.88 },
            { word: 'world', start: 1.2, end: 2.0, confidence: 0.96 },
          ],
        },
      ],
      language: 'en',
      duration: 2.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    expect(result.segments[0].words.map(w => w.word)).toEqual(['hello', 'world'])
  })

  test('should handle multi-word filler phrases', () => {
    const input: TranscriptionResult = {
      text: 'hello you know I like you know programming',
      segments: [
        {
          text: 'hello you know I like you know programming',
          start: 0,
          end: 4.0,
          words: [
            { word: 'hello', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'you know', start: 0.6, end: 1.0, confidence: 0.9 },
            { word: 'I', start: 1.1, end: 1.2, confidence: 0.94 },
            { word: 'like', start: 1.3, end: 1.5, confidence: 0.88 },
            { word: 'you know', start: 1.6, end: 2.0, confidence: 0.89 },
            { word: 'programming', start: 2.1, end: 4.0, confidence: 0.97 },
          ],
        },
      ],
      language: 'en',
      duration: 4.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // "you know" and "like" should be removed
    expect(result.segments[0].words.map(w => w.word)).toEqual(['hello', 'I', 'programming'])
  })

  test('should update segment end time after removing last word', () => {
    const input: TranscriptionResult = {
      text: 'hello world um',
      segments: [
        {
          text: 'hello world um',
          start: 0,
          end: 2.0,
          words: [
            { word: 'hello', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'world', start: 0.6, end: 1.2, confidence: 0.96 },
            { word: 'um', start: 1.3, end: 2.0, confidence: 0.9 },
          ],
        },
      ],
      language: 'en',
      duration: 2.0,
    }

    const config: TranscribeConfig = { removeFillers: true }
    const result = removeFillerWords(input, config)

    // Segment end should be updated to last word's end time
    expect(result.segments[0].end).toBe(result.segments[0].words[result.segments[0].words.length - 1].end)
  })
})

const mockSegments: TranscriptionSegment[] = [
  {
    text: 'Hello world',
    start: 0,
    end: 1.5,
    words: [
      { word: 'Hello', start: 0, end: 0.5, confidence: 0.99 },
      { word: 'world', start: 0.6, end: 1.5, confidence: 0.98 },
    ],
  },
  {
    text: 'this is a test',
    start: 1.6,
    end: 3.0,
    words: [
      { word: 'this', start: 1.6, end: 1.8, confidence: 0.97 },
      { word: 'is', start: 1.9, end: 2.0, confidence: 0.99 },
      { word: 'a', start: 2.1, end: 2.2, confidence: 0.98 },
      { word: 'test', start: 2.3, end: 3.0, confidence: 0.96 },
    ],
  },
]

describe('generateTikTokASS - Animations', () => {
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

describe('CAPTION_PRESETS', () => {
  test('should have all 5 presets defined', () => {
    expect(CAPTION_PRESETS['bold-pop']).toBeDefined()
    expect(CAPTION_PRESETS['clean-minimal']).toBeDefined()
    expect(CAPTION_PRESETS['hormozi']).toBeDefined()
    expect(CAPTION_PRESETS['neon-glow']).toBeDefined()
    expect(CAPTION_PRESETS['comic']).toBeDefined()
  })

  test('bold-pop preset should have correct values', () => {
    const preset = CAPTION_PRESETS['bold-pop']
    expect(preset.fontName).toBe('Arial Black')
    expect(preset.fontSize).toBe(48)
    expect(preset.primaryColor).toBe('&HFFFFFF')
    expect(preset.highlightColor).toBe('&H00FFFF')
    expect(preset.outlineColor).toBe('&H000000')
    expect(preset.outlineWidth).toBe(3)
    expect(preset.position).toBe('bottom')
    expect(preset.borderStyle).toBe(1)
    expect(preset.textTransform).toBe('none')
  })

  test('clean-minimal preset should have correct values', () => {
    const preset = CAPTION_PRESETS['clean-minimal']
    expect(preset.fontName).toBe('Helvetica')
    expect(preset.fontSize).toBe(42)
    expect(preset.primaryColor).toBe('&HFFFFFF')
    expect(preset.highlightColor).toBe('&HFFFF00')
    expect(preset.outlineColor).toBe('&H808080')
    expect(preset.outlineWidth).toBe(2)
    expect(preset.position).toBe('bottom')
  })

  test('hormozi preset should have correct values', () => {
    const preset = CAPTION_PRESETS['hormozi']
    expect(preset.fontName).toBe('Impact')
    expect(preset.fontSize).toBe(52)
    expect(preset.primaryColor).toBe('&HFFFFFF')
    expect(preset.highlightColor).toBe('&H0080FF')
    expect(preset.outlineColor).toBe('&H000000')
    expect(preset.outlineWidth).toBe(4)
    expect(preset.position).toBe('center')
    expect(preset.textTransform).toBe('uppercase')
  })

  test('neon-glow preset should have correct values', () => {
    const preset = CAPTION_PRESETS['neon-glow']
    expect(preset.fontName).toBe('Arial')
    expect(preset.fontSize).toBe(46)
    expect(preset.primaryColor).toBe('&HFFFF00')
    expect(preset.highlightColor).toBe('&HFF00FF')
    expect(preset.outlineColor).toBe('&HFF00FF')
    expect(preset.outlineWidth).toBe(5)
    expect(preset.borderStyle).toBe(3)
  })

  test('comic preset should have correct values', () => {
    const preset = CAPTION_PRESETS['comic']
    expect(preset.fontName).toBe('Comic Sans MS')
    expect(preset.fontSize).toBe(44)
    expect(preset.primaryColor).toBe('&HFFFFFF')
    expect(preset.highlightColor).toBe('&H00FF00')
    expect(preset.outlineColor).toBe('&H000000')
    expect(preset.outlineWidth).toBe(3)
  })
})

describe('generateTikTokASS with presets', () => {
  test('should use bold-pop preset by default', () => {
    const ass = generateTikTokASS(mockSegments)

    expect(ass).toContain('[Script Info]')
    expect(ass).toContain('ClipForge Captions')
    expect(ass).toContain('Arial Black')
    expect(ass).toContain('48') // Font size
    expect(ass).toContain('&HFFFFFF') // White
    expect(ass).toContain('&H00FFFF') // Yellow
    expect(ass).toContain('&H000000') // Black
  })

  test('should apply bold-pop preset when specified', () => {
    const ass = generateTikTokASS(mockSegments, { preset: 'bold-pop' })

    expect(ass).toContain('Arial Black')
    expect(ass).toContain('48')
    expect(ass).toContain('&HFFFFFF')
  })

  test('should apply clean-minimal preset', () => {
    const ass = generateTikTokASS(mockSegments, { preset: 'clean-minimal' })

    expect(ass).toContain('Helvetica')
    expect(ass).toContain('42')
    expect(ass).toContain('&HFFFFFF')
    expect(ass).toContain('&HFFFF00') // Cyan
    expect(ass).toContain('&H808080') // Gray
  })

  test('should apply hormozi preset with uppercase transformation', () => {
    const ass = generateTikTokASS(mockSegments, { preset: 'hormozi' })

    expect(ass).toContain('Impact')
    expect(ass).toContain('52')
    expect(ass).toContain('&H0080FF') // Orange
    expect(ass).toContain('HELLO') // Uppercase
    expect(ass).toContain('WORLD')
    expect(ass).toContain('THIS')
    expect(ass).toContain('TEST')
  })

  test('should apply neon-glow preset with glow border', () => {
    const ass = generateTikTokASS(mockSegments, { preset: 'neon-glow' })

    expect(ass).toContain('Arial')
    expect(ass).toContain('46')
    expect(ass).toContain('&HFFFF00') // Cyan
    expect(ass).toContain('&HFF00FF') // Magenta
    // Check for border style 3 (glow)
    const styleLines = ass.split('\n').filter(line => line.startsWith('Style:'))
    expect(styleLines.some(line => line.includes(',3,'))).toBe(true)
  })

  test('should apply comic preset', () => {
    const ass = generateTikTokASS(mockSegments, { preset: 'comic' })

    expect(ass).toContain('Comic Sans MS')
    expect(ass).toContain('44')
    expect(ass).toContain('&H00FF00') // Lime
  })

  test('should override preset values with custom options', () => {
    const ass = generateTikTokASS(mockSegments, {
      preset: 'bold-pop',
      fontSize: 60,
      primaryColor: '&HFF0000',
    })

    expect(ass).toContain('Arial Black') // From preset
    expect(ass).toContain('60') // Overridden
    expect(ass).toContain('&HFF0000') // Overridden
  })

  test('should handle segments without word-level timing', () => {
    const segmentsWithoutWords: TranscriptionSegment[] = [
      {
        text: 'Complete segment',
        start: 0,
        end: 2.0,
        words: [],
      },
    ]

    const ass = generateTikTokASS(segmentsWithoutWords, { preset: 'bold-pop' })

    expect(ass).toContain('Complete segment')
    expect(ass).toContain('Arial Black')
  })

  test('should correctly position captions based on preset', () => {
    const bottomAss = generateTikTokASS(mockSegments, { preset: 'bold-pop' })
    const centerAss = generateTikTokASS(mockSegments, { preset: 'hormozi' })

    // Check Y position in style definitions
    expect(bottomAss).toContain(',800,') // Bottom position
    expect(centerAss).toContain(',540,') // Center position
  })

  test('should apply correct outline width from preset', () => {
    const boldPopAss = generateTikTokASS(mockSegments, { preset: 'bold-pop' })
    const hormoziAss = generateTikTokASS(mockSegments, { preset: 'hormozi' })
    const neonGlowAss = generateTikTokASS(mockSegments, { preset: 'neon-glow' })

    // Each preset should use its specified outline width
    const boldPopStyles = boldPopAss.split('\n').filter(line => line.startsWith('Style:'))
    const hormoziStyles = hormoziAss.split('\n').filter(line => line.startsWith('Style:'))
    const neonGlowStyles = neonGlowAss.split('\n').filter(line => line.startsWith('Style:'))

    expect(boldPopStyles.some(line => line.includes(',3,0,'))).toBe(true) // Outline 3
    expect(hormoziStyles.some(line => line.includes(',4,0,'))).toBe(true) // Outline 4
    expect(neonGlowStyles.some(line => line.includes(',5,0,'))).toBe(true) // Outline 5
  })
})

describe('generateTikTokASS text transformation', () => {
  test('should apply uppercase transformation', () => {
    const ass = generateTikTokASS(mockSegments, { textTransform: 'uppercase' })

    expect(ass).toContain('HELLO')
    expect(ass).toContain('WORLD')
    expect(ass).not.toContain('Hello')
  })

  test('should apply lowercase transformation', () => {
    const ass = generateTikTokASS(mockSegments, { textTransform: 'lowercase' })

    expect(ass).toContain('hello')
    expect(ass).toContain('world')
    expect(ass).not.toContain('Hello')
  })

  test('should not transform text when set to none', () => {
    const ass = generateTikTokASS(mockSegments, { textTransform: 'none' })

    expect(ass).toContain('Hello')
    expect(ass).toContain('world')
  })
})
