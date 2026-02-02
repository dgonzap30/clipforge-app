/**
 * Download Stage
 *
 * Downloads VOD using yt-dlp with progress parsing
 */

import { $ } from 'bun'
import { PipelineContext, PipelineStage } from '../types'
import path from 'path'

export const downloadStage: PipelineStage = {
  name: 'download',
  retryable: true,
  maxRetries: 3,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    const outputPath = path.join(ctx.workDir, `${ctx.vodId}.mp4`)

    console.log(`[download] Downloading VOD ${ctx.vodId} from ${ctx.vodUrl}`)

    // Download with yt-dlp
    // Format: best video + best audio, merge to mp4
    const proc = Bun.spawn(
      [
        'yt-dlp',
        '--format', 'best[ext=mp4]/best',
        '--output', outputPath,
        '--progress',
        '--newline',
        ctx.vodUrl
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )

    // Parse progress from stdout
    const decoder = new TextDecoder()
    let lastProgress = 0

    for await (const chunk of proc.stdout) {
      const text = decoder.decode(chunk)
      const lines = text.split('\n')

      for (const line of lines) {
        // yt-dlp outputs: [download]  45.2% of 1.23GiB at 5.67MiB/s ETA 00:12
        const match = line.match(/\[download\]\s+(\d+\.?\d*)%/)
        if (match) {
          const progress = parseFloat(match[1])
          if (progress > lastProgress) {
            lastProgress = progress
            // Scale download to 0-15% of total progress
            ctx.progress = Math.floor(progress * 0.15)
          }
        }
      }
    }

    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`yt-dlp failed with code ${exitCode}: ${stderr}`)
    }

    // Verify file exists
    const file = Bun.file(outputPath)
    if (!(await file.exists())) {
      throw new Error(`Downloaded file not found: ${outputPath}`)
    }

    console.log(`[download] VOD downloaded successfully: ${outputPath}`)

    ctx.vodPath = outputPath
    ctx.filesToCleanup.push(outputPath)
    ctx.progress = 15

    return ctx
  },
}
