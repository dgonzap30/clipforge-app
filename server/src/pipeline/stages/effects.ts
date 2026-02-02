/**
 * Effects Stage
 *
 * Applies transitions and effects to multi-clip compilations.
 * This stage compiles multiple clips with transitions into a single video.
 */

import { PipelineContext, PipelineStage, TransitionType } from '../types'
import { concatenateClipsWithTransitions, TransitionOptions } from '../../extraction/clipper'
import { existsSync } from 'fs'

export interface EffectsStageConfig {
  defaultTransition?: TransitionType
  transitionDuration?: number
  transitions?: TransitionOptions[]
  outputFileName?: string
}

/**
 * Effects Stage Implementation
 */
export class EffectsStage implements PipelineStage {
  name = 'effects'

  constructor(private config: EffectsStageConfig = {}) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { outputDir, captionedClips, reframedClips } = context

    // Validate required context
    if (!outputDir) {
      throw new Error('Effects stage requires outputDir in context')
    }

    // Determine which clips to use (captioned if available, otherwise reframed)
    const clipsToCompile = captionedClips || reframedClips

    if (!clipsToCompile || clipsToCompile.length === 0) {
      throw new Error('Effects stage requires captionedClips or reframedClips in context')
    }

    // If only one clip, skip compilation
    if (clipsToCompile.length === 1) {
      return {
        ...context,
        compiledClipPath: clipsToCompile[0].path,
      }
    }

    // Validate all clip paths exist
    const clipPaths = clipsToCompile.map(c => c.path)
    for (const path of clipPaths) {
      if (!existsSync(path)) {
        throw new Error(`Clip file not found: ${path}`)
      }
    }

    // Generate output path
    const outputFileName = this.config.outputFileName || `compilation-${Date.now()}.mp4`
    const outputPath = `${outputDir}/${outputFileName}`

    // Get transition configuration
    const defaultTransition = this.config.defaultTransition || 'cut'
    const transitionDuration = this.config.transitionDuration || 0.3

    // Build transitions array
    let transitions = this.config.transitions
    if (!transitions) {
      // Generate default transitions for each clip boundary
      transitions = Array(clipPaths.length - 1).fill(null).map(() => ({
        type: defaultTransition,
        duration: transitionDuration,
      }))
    }

    // Concatenate clips with transitions
    await concatenateClipsWithTransitions({
      clipPaths,
      outputPath,
      transitions,
      defaultTransition,
      transitionDuration,
    })

    // Verify output was created
    if (!existsSync(outputPath)) {
      throw new Error(`Failed to create compiled video at ${outputPath}`)
    }

    // Return updated context with compiled clip path
    return {
      ...context,
      compiledClipPath: outputPath,
      tempFiles: [...(context.tempFiles || []), outputPath],
    }
  }

  async validate(context: PipelineContext): Promise<boolean> {
    const { captionedClips, reframedClips } = context
    const clipsToCompile = captionedClips || reframedClips
    return !!(clipsToCompile && clipsToCompile.length > 0)
  }

  async cleanup(context: PipelineContext): Promise<void> {
    // Clean up temporary files if needed
    if (context.compiledClipPath && existsSync(context.compiledClipPath)) {
      const { unlink } = await import('fs/promises')
      await unlink(context.compiledClipPath)
    }
  }
}
