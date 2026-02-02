/**
 * Visual Scene Analysis Module
 *
 * Uses vision models to analyze video keyframes and detect visual moments
 * that may not be captured by audio or chat signals alone.
 */

import { $ } from 'bun'
import * as fs from 'fs/promises'
import * as path from 'path'
import { env } from '../lib/env'

export interface VisualMoment {
  timestamp: number
  type: 'action' | 'victory' | 'defeat' | 'reaction' | 'alert' | 'neutral'
  hydeScore: number // 0-100 score for moment quality
  description: string
  confidence: number // 0-1 confidence in detection
  metadata?: {
    eventType?: string
    colorChange?: boolean
    onScreenText?: boolean
    emotionalIntensity?: number
  }
}

export interface VisualAnalysisConfig {
  fps: number // frames per second to extract
  minScore: number // minimum score to consider
  useClaudeVision: boolean // use Claude Vision API
  gameSpecificDetection: boolean // enable game-specific event detection
  tmpDir?: string // temporary directory for frames
}

const DEFAULT_CONFIG: VisualAnalysisConfig = {
  fps: 1, // 1 frame per second
  minScore: 30,
  useClaudeVision: true,
  gameSpecificDetection: false,
}

/**
 * Analyze video for visual moments using vision model
 */
export async function analyzeVisualMoments(
  videoPath: string,
  config: Partial<VisualAnalysisConfig> = {}
): Promise<VisualMoment[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Create temporary directory for frames
  const tmpDir = cfg.tmpDir ?? await fs.mkdtemp('/tmp/visual-analysis-')

  try {
    // Extract keyframes
    console.log('[Visual] Extracting keyframes at', cfg.fps, 'fps')
    await extractKeyframes(videoPath, tmpDir, cfg.fps)

    // Get list of extracted frames
    const frames = await fs.readdir(tmpDir)
    const framePaths = frames
      .filter(f => f.endsWith('.jpg'))
      .sort()
      .map(f => path.join(tmpDir, f))

    console.log('[Visual] Analyzing', framePaths.length, 'frames')

    // Analyze frames
    const moments: VisualMoment[] = []

    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i]
      const timestamp = i / cfg.fps // timestamp in seconds

      // Analyze frame using vision model
      const moment = await analyzeFrame(framePath, timestamp, cfg)

      if (moment && moment.hydeScore >= cfg.minScore) {
        moments.push(moment)
      }
    }

    console.log('[Visual] Found', moments.length, 'visual moments')

    return moments
  } finally {
    // Cleanup temporary directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Extract keyframes from video using FFmpeg
 */
async function extractKeyframes(
  videoPath: string,
  outputDir: string,
  fps: number
): Promise<void> {
  await $`ffmpeg -i ${videoPath} -vf fps=${fps} ${outputDir}/frame-%04d.jpg -hide_banner -loglevel error`
}

/**
 * Analyze a single frame using vision model
 */
async function analyzeFrame(
  framePath: string,
  timestamp: number,
  config: VisualAnalysisConfig
): Promise<VisualMoment | null> {
  if (config.useClaudeVision && env.ANTHROPIC_API_KEY) {
    return analyzeFrameWithClaude(framePath, timestamp)
  }

  // Fallback to basic visual analysis
  return analyzeFrameBasic(framePath, timestamp)
}

/**
 * Analyze frame using Claude Vision API
 */
async function analyzeFrameWithClaude(
  framePath: string,
  timestamp: number
): Promise<VisualMoment | null> {
  try {
    // Read frame as base64
    const imageData = await fs.readFile(framePath)
    const base64Image = imageData.toString('base64')

    // Call Claude Vision API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this gaming/streaming moment. Identify:
- Event type: action, victory, defeat, reaction, alert, or neutral
- Emotional intensity (0-10)
- Notable visual elements (kills, deaths, victories, alerts, reactions)
- Brief description (1 sentence)

Respond in JSON format:
{
  "eventType": "action|victory|defeat|reaction|alert|neutral",
  "score": 0-100,
  "emotionalIntensity": 0-10,
  "description": "brief description",
  "colorChange": true/false,
  "onScreenText": true/false
}`
            }
          ]
        }],
      }),
    })

    if (!response.ok) {
      console.error('[Visual] Claude API error:', response.statusText)
      return null
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> }
    const textContent = data.content.find((c) => c.type === 'text')?.text

    if (!textContent) {
      return null
    }

    // Parse JSON response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    const analysis = JSON.parse(jsonMatch[0])

    return {
      timestamp,
      type: analysis.eventType,
      hydeScore: analysis.score,
      description: analysis.description,
      confidence: analysis.score / 100,
      metadata: {
        eventType: analysis.eventType,
        colorChange: analysis.colorChange,
        onScreenText: analysis.onScreenText,
        emotionalIntensity: analysis.emotionalIntensity,
      },
    }
  } catch {
    // Silently fail and return null
    return null
  }
}

/**
 * Basic visual analysis without AI (fallback)
 * Detects sudden color changes and brightness shifts
 */
async function analyzeFrameBasic(
  framePath: string,
  timestamp: number
): Promise<VisualMoment | null> {
  try {
    // Use FFmpeg to get basic stats about the frame
    const stats = await $`ffmpeg -i ${framePath} -vf "signalstats" -f null - 2>&1`.text()

    // Parse brightness and saturation from stats
    // This is a simplified implementation - real version would track changes over time
    const brightnessMatch = stats.match(/YAVG:\s*([\d.]+)/)
    const brightness = brightnessMatch ? parseFloat(brightnessMatch[1]) : 128

    // Score based on brightness extremes (very bright or very dark = potential event)
    let score = 50
    if (brightness > 200 || brightness < 50) {
      score = 70 // Potential victory screen or defeat screen
    }

    return {
      timestamp,
      type: 'neutral',
      hydeScore: score,
      description: 'Visual moment detected',
      confidence: 0.5,
      metadata: {
        colorChange: brightness > 200 || brightness < 50,
      },
    }
  } catch {
    // Silently fail for basic analysis
    return null
  }
}

/**
 * Detect game-specific events based on visual patterns
 */
export async function detectGameEvents(
  _framePath: string,
  _gameTitle?: string
): Promise<string | null> {
  // This would contain game-specific detection logic
  // For now, return null as a placeholder
  // Future: implement OCR or template matching for specific games
  return null
}

/**
 * Estimate visual quality of a moment
 */
export function estimateVisualQuality(moment: VisualMoment): {
  quality: 'high' | 'medium' | 'low'
  reasons: string[]
} {
  const reasons: string[] = []

  // High quality indicators
  if (moment.type === 'victory' || moment.type === 'action') {
    reasons.push('High-energy visual event')
  }
  if (moment.metadata?.emotionalIntensity && moment.metadata.emotionalIntensity >= 7) {
    reasons.push('Strong emotional intensity')
  }
  if (moment.metadata?.onScreenText) {
    reasons.push('On-screen alert or notification')
  }
  if (moment.confidence >= 0.7) {
    reasons.push('High confidence detection')
  }

  // Determine quality
  let quality: 'high' | 'medium' | 'low'
  if (moment.hydeScore >= 70 && moment.confidence >= 0.6) {
    quality = 'high'
  } else if (moment.hydeScore >= 50 || moment.confidence >= 0.5) {
    quality = 'medium'
  } else {
    quality = 'low'
  }

  return { quality, reasons }
}
