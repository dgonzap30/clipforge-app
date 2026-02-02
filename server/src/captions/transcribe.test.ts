/**
 * Tests for Caption Style Presets
 */

import { describe, test, expect } from 'bun:test'
import { generateTikTokASS, CAPTION_PRESETS, type TranscriptionSegment } from './transcribe'

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
