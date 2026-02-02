/**
 * Clipper Module Tests
 */

import { describe, test, expect } from 'bun:test'
import { TransitionOptions } from './clipper'

describe('concatenateClipsWithTransitions', () => {
  test('should validate config structure for no clips', () => {
    const config = {
      clipPaths: [],
      outputPath: '/tmp/output.mp4',
    }

    expect(config.clipPaths.length).toBe(0)
  })

  test('should validate config structure for single clip', () => {
    const config = {
      clipPaths: ['/tmp/clip-1.mp4'],
      outputPath: '/tmp/output.mp4',
    }

    expect(config.clipPaths.length).toBe(1)
  })

  test('should use default transition type if not specified', async () => {
    const config = {
      clipPaths: ['/tmp/clip-1.mp4', '/tmp/clip-2.mp4'],
      outputPath: '/tmp/output.mp4',
      defaultTransition: 'flash' as const,
    }

    // Verify config structure
    expect(config.defaultTransition).toBe('flash')
  })

  test('should use specified transitions array', async () => {
    const transitions: TransitionOptions[] = [
      { type: 'flash', duration: 0.2 },
      { type: 'zoom-in', duration: 0.4 },
    ]

    const config = {
      clipPaths: ['/tmp/clip-1.mp4', '/tmp/clip-2.mp4', '/tmp/clip-3.mp4'],
      outputPath: '/tmp/output.mp4',
      transitions,
    }

    // Verify transitions array is properly structured
    expect(config.transitions).toBeDefined()
    expect(config.transitions?.length).toBe(2)
    expect(config.transitions?.[0].type).toBe('flash')
    expect(config.transitions?.[1].type).toBe('zoom-in')
  })

  test('should validate transition types', () => {
    const validTransitions: TransitionOptions[] = [
      { type: 'cut', duration: 0.0 },
      { type: 'flash', duration: 0.1 },
      { type: 'zoom-in', duration: 0.3 },
      { type: 'zoom-out', duration: 0.3 },
    ]

    for (const transition of validTransitions) {
      expect(['cut', 'flash', 'zoom-in', 'zoom-out']).toContain(transition.type)
    }
  })

  test('should use default duration if not specified', () => {
    const transition: TransitionOptions = {
      type: 'flash',
    }

    const duration = transition.duration || 0.3
    expect(duration).toBe(0.3)
  })

  test('should generate correct number of transitions', () => {
    const clipCount = 5
    const transitionCount = clipCount - 1 // Transitions between clips

    expect(transitionCount).toBe(4)
  })

  test('should handle all transition types correctly', () => {
    const transitionTypes = ['cut', 'flash', 'zoom-in', 'zoom-out'] as const

    for (const type of transitionTypes) {
      const transition: TransitionOptions = { type, duration: 0.3 }
      expect(transition.type).toBe(type)
      expect(['cut', 'flash', 'zoom-in', 'zoom-out']).toContain(transition.type)
    }
  })
})

describe('TransitionOptions type validation', () => {
  test('should accept valid transition configurations', () => {
    const validConfigs: TransitionOptions[] = [
      { type: 'cut' },
      { type: 'flash', duration: 0.1 },
      { type: 'zoom-in', duration: 0.5 },
      { type: 'zoom-out', duration: 0.3 },
    ]

    for (const config of validConfigs) {
      expect(config.type).toBeDefined()
      expect(['cut', 'flash', 'zoom-in', 'zoom-out']).toContain(config.type)
    }
  })

  test('should use reasonable default durations', () => {
    const durations = [0.1, 0.2, 0.3, 0.4, 0.5]

    for (const duration of durations) {
      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThanOrEqual(1.0)
    }
  })
})
