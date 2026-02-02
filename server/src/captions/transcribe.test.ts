/**
 * Tests for transcription and filler word removal
 */

import { describe, test, expect } from 'bun:test'
import {
  removeFillerWords,
  type TranscriptionResult,
  type TranscribeConfig,
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
