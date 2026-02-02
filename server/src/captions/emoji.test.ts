/**
 * Tests for Emoji Insertion in Captions
 */

import { describe, test, expect } from 'bun:test'
import { generateTikTokASS, type TranscriptionSegment } from './transcribe'

describe('Emoji Insertion', () => {
  const mockSegmentWithEmoji: TranscriptionSegment = {
    text: 'This is fire and crazy',
    start: 0,
    end: 3.0,
    words: [
      { word: 'This', start: 0, end: 0.3, confidence: 0.99 },
      { word: 'is', start: 0.4, end: 0.6, confidence: 0.99 },
      { word: 'fire', start: 0.7, end: 1.0, confidence: 0.98 },
      { word: 'and', start: 1.1, end: 1.3, confidence: 0.99 },
      { word: 'crazy', start: 1.4, end: 1.8, confidence: 0.97 },
    ],
  }

  const mockSegmentWithLaughter: TranscriptionSegment = {
    text: 'haha that was funny',
    start: 0,
    end: 2.0,
    words: [
      { word: 'haha', start: 0, end: 0.5, confidence: 0.99 },
      { word: 'that', start: 0.6, end: 0.8, confidence: 0.99 },
      { word: 'was', start: 0.9, end: 1.1, confidence: 0.98 },
      { word: 'funny', start: 1.2, end: 1.5, confidence: 0.97 },
    ],
  }

  const mockSegmentWithMultiWord: TranscriptionSegment = {
    text: 'no way lets go',
    start: 0,
    end: 2.0,
    words: [
      { word: 'no', start: 0, end: 0.3, confidence: 0.99 },
      { word: 'way', start: 0.4, end: 0.7, confidence: 0.99 },
      { word: 'lets', start: 0.8, end: 1.1, confidence: 0.98 },
      { word: 'go', start: 1.2, end: 1.5, confidence: 0.97 },
    ],
  }

  const mockSegmentNoEmoji: TranscriptionSegment = {
    text: 'This is normal text',
    start: 0,
    end: 2.0,
    words: [
      { word: 'This', start: 0, end: 0.3, confidence: 0.99 },
      { word: 'is', start: 0.4, end: 0.6, confidence: 0.99 },
      { word: 'normal', start: 0.7, end: 1.0, confidence: 0.98 },
      { word: 'text', start: 1.1, end: 1.5, confidence: 0.97 },
    ],
  }

  test('should insert emojis when enabled', () => {
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      emojis: true,
    })

    // Check for emoji style definition
    expect(ass).toContain('Style: Emoji')

    // Check for fire emoji (🔥)
    expect(ass).toContain('🔥')

    // Check for crazy emoji (😱)
    expect(ass).toContain('😱')

    // Check that emojis are in separate Dialogue lines with Layer 1
    expect(ass).toContain('Dialogue: 1,')
  })

  test('should not insert emojis when disabled', () => {
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      emojis: false,
    })

    // Should not contain emoji style
    expect(ass).not.toContain('Style: Emoji')

    // Should not contain emojis
    expect(ass).not.toContain('🔥')
    expect(ass).not.toContain('😱')
  })

  test('should detect laughter and insert laugh emoji', () => {
    const ass = generateTikTokASS([mockSegmentWithLaughter], {
      emojis: true,
    })

    // Check for laugh emoji (😂)
    expect(ass).toContain('😂')
  })

  test('should handle multi-word emoji phrases', () => {
    const ass = generateTikTokASS([mockSegmentWithMultiWord], {
      emojis: true,
    })

    // Check for "no way" emoji (😲)
    expect(ass).toContain('😲')

    // Check for "lets go" emoji (🚀)
    expect(ass).toContain('🚀')
  })

  test('should not insert emojis for normal text without keywords', () => {
    const ass = generateTikTokASS([mockSegmentNoEmoji], {
      emojis: true,
    })

    // Should still have emoji style defined
    expect(ass).toContain('Style: Emoji')

    // But should not have any emoji dialogue lines
    const lines = ass.split('\n')
    const emojiDialogueLines = lines.filter(line => line.startsWith('Dialogue: 1,'))
    expect(emojiDialogueLines.length).toBe(0)
  })

  test('should include animation tags when emoji animation enabled', () => {
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      emojis: true,
      emojiAnimation: true,
    })

    // Check for animation tags (scale transformation)
    expect(ass).toContain('\\t(')
    expect(ass).toContain('\\fscx')
    expect(ass).toContain('\\fscy')
  })

  test('should not include animation tags when emoji animation disabled', () => {
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      emojis: true,
      emojiAnimation: false,
    })

    // Should still have emojis
    expect(ass).toContain('🔥')

    // But no animation tags in emoji dialogue lines
    const lines = ass.split('\n')
    const emojiDialogueLines = lines.filter(line => line.startsWith('Dialogue: 1,'))

    for (const line of emojiDialogueLines) {
      expect(line).not.toContain('\\t(')
    }
  })

  test('should position emojis with pos tags', () => {
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      emojis: true,
    })

    // Check for position tags
    expect(ass).toContain('\\pos(')
  })

  test('should handle segments without word-level timing', () => {
    const segmentNoWords: TranscriptionSegment = {
      text: 'This is fire',
      start: 0,
      end: 2.0,
      words: [],
    }

    const ass = generateTikTokASS([segmentNoWords], {
      emojis: true,
    })

    // Should not crash and should generate basic dialogue
    expect(ass).toContain('Dialogue: 0,')
    // Should not have emoji dialogue since no word timing
    expect(ass).not.toContain('🔥')
  })

  test('should handle multiple emoji keywords in same segment', () => {
    const multiEmojiSegment: TranscriptionSegment = {
      text: 'lol this is fire gg',
      start: 0,
      end: 3.0,
      words: [
        { word: 'lol', start: 0, end: 0.4, confidence: 0.99 },
        { word: 'this', start: 0.5, end: 0.7, confidence: 0.99 },
        { word: 'is', start: 0.8, end: 1.0, confidence: 0.99 },
        { word: 'fire', start: 1.1, end: 1.4, confidence: 0.98 },
        { word: 'gg', start: 1.5, end: 1.8, confidence: 0.97 },
      ],
    }

    const ass = generateTikTokASS([multiEmojiSegment], {
      emojis: true,
    })

    // Should contain all three emojis
    expect(ass).toContain('😂') // lol
    expect(ass).toContain('🔥') // fire
    expect(ass).toContain('🎮') // gg

    // Should have 3 emoji dialogue lines
    const lines = ass.split('\n')
    const emojiDialogueLines = lines.filter(line => line.startsWith('Dialogue: 1,'))
    expect(emojiDialogueLines.length).toBe(3)
  })

  test('should use emoji style with larger font size', () => {
    const baseFontSize = 48
    const ass = generateTikTokASS([mockSegmentWithEmoji], {
      fontSize: baseFontSize,
      emojis: true,
    })

    // Emoji font size should be ~1.25x base font size
    const expectedEmojiFontSize = Math.floor(baseFontSize * 1.25)
    expect(ass).toContain(`Style: Emoji,Arial,${expectedEmojiFontSize}`)
  })

  test('should handle case-insensitive emoji matching', () => {
    const caseInsensitiveSegment: TranscriptionSegment = {
      text: 'FIRE Crazy LoL',
      start: 0,
      end: 2.0,
      words: [
        { word: 'FIRE', start: 0, end: 0.4, confidence: 0.99 },
        { word: 'Crazy', start: 0.5, end: 0.9, confidence: 0.98 },
        { word: 'LoL', start: 1.0, end: 1.3, confidence: 0.97 },
      ],
    }

    const ass = generateTikTokASS([caseInsensitiveSegment], {
      emojis: true,
    })

    // Should match regardless of case
    expect(ass).toContain('🔥') // FIRE
    expect(ass).toContain('😱') // Crazy
    expect(ass).toContain('😂') // LoL
  })

  test('should set correct Y position based on caption position', () => {
    const positions = [
      { pos: 'bottom' as const, expectedY: 800 },
      { pos: 'center' as const, expectedY: 540 },
      { pos: 'top' as const, expectedY: 200 },
    ]

    for (const { pos, expectedY } of positions) {
      const ass = generateTikTokASS([mockSegmentWithEmoji], {
        position: pos,
        emojis: true,
      })

      // Check that emoji dialogue contains the correct Y position
      const lines = ass.split('\n')
      const emojiDialogueLines = lines.filter(line => line.startsWith('Dialogue: 1,'))

      for (const line of emojiDialogueLines) {
        expect(line).toContain(`,${expectedY})`)
      }
    }
  })
})

describe('Emoji default settings', () => {
  test('should default to emojis disabled', () => {
    const mockSegment: TranscriptionSegment = {
      text: 'fire',
      start: 0,
      end: 1.0,
      words: [{ word: 'fire', start: 0, end: 1.0, confidence: 0.99 }],
    }

    const ass = generateTikTokASS([mockSegment])

    // Default should be emojis off
    expect(ass).not.toContain('🔥')
  })

  test('should default to emoji animation enabled when emojis are on', () => {
    const mockSegment: TranscriptionSegment = {
      text: 'fire',
      start: 0,
      end: 1.0,
      words: [{ word: 'fire', start: 0, end: 1.0, confidence: 0.99 }],
    }

    const ass = generateTikTokASS([mockSegment], { emojis: true })

    // Should have animation by default
    expect(ass).toContain('\\t(')
  })
})
