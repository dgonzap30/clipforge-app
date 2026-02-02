/**
 * Download Stage
 *
 * Downloads VODs using yt-dlp with progress tracking.
 * Supports Twitch VODs and other platforms.
 */

import { $ } from 'bun'
import path from 'path'
import { PipelineStage, PipelineContext, ProgressCallback } from '../types'

export interface DownloadStageOptions {
  format?: string // yt-dlp format selector (default: best)
  maxFileSize?: number // max file size in MB (optional)
  onProgress?: ProgressCallback
}

export class DownloadStage implements PipelineStage {
  name = 'download'

  constructor(private options: DownloadStageOptions = {}) {}

  async validate(context: PipelineContext): Promise<boolean> {
    // Check if yt-dlp is available
    try {
      await $`yt-dlp --version`.quiet()
      return true
    } catch {
      throw new Error('yt-dlp is not installed or not in PATH')
    }
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { vodUrl, workDir } = context
    const { format = 'best', onProgress } = this.options

    if (!vodUrl) {
      throw new Error('VOD URL is required')
    }

    if (!workDir) {
      throw new Error('Working directory is required')
    }

    // Output file path
    const outputTemplate = path.join(workDir, 'vod.%(ext)s')

    // Build yt-dlp command
    const args = [
      'yt-dlp',
      '--format', format,
      '--output', outputTemplate,
      '--no-playlist', // Don't download playlists
      '--no-part', // Don't use .part files
      '--newline', // Output progress on new lines for parsing
      '--progress', // Show progress
    ]

    // Add file size limit if specified
    if (this.options.maxFileSize) {
      args.push('--max-filesize', `${this.options.maxFileSize}M`)
    }

    args.push(vodUrl)

    // Track download progress
    let downloadedPath: string | null = null
    let lastProgress = 0

    try {
      // Execute yt-dlp and parse output
      const proc = Bun.spawn(args, {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Parse progress from stdout
      const decoder = new TextDecoder()
      const reader = proc.stdout.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const output = decoder.decode(value)
        const lines = output.split('\n')

        for (const line of lines) {
          // Parse download progress
          const progress = this.parseProgress(line)
          if (progress && onProgress && progress.percent > lastProgress) {
            lastProgress = progress.percent
            onProgress(
              progress.percent,
              'downloading',
              {
                downloadedBytes: progress.downloadedBytes,
                totalBytes: progress.totalBytes,
                speed: progress.speed,
                eta: progress.eta,
              }
            )
          }

          // Check for destination file
          const destinationMatch = line.match(/\[download\] Destination: (.+)/)
          if (destinationMatch) {
            downloadedPath = destinationMatch[1].trim()
          }

          // Check for already downloaded
          const alreadyDownloadedMatch = line.match(/\[download\] (.+) has already been downloaded/)
          if (alreadyDownloadedMatch) {
            downloadedPath = alreadyDownloadedMatch[1].trim()
          }

          // Merge format detection
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
          if (mergeMatch) {
            downloadedPath = mergeMatch[1].trim()
          }
        }
      }

      // Wait for process to complete
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        // Read stderr for error message
        const stderrReader = proc.stderr.getReader()
        const { value } = await stderrReader.read()
        const errorOutput = value ? decoder.decode(value) : 'Unknown error'
        throw new Error(`yt-dlp failed with exit code ${exitCode}: ${errorOutput}`)
      }

      // Verify file was downloaded
      if (!downloadedPath) {
        // Try to find the downloaded file
        downloadedPath = await this.findDownloadedFile(workDir)
      }

      if (!downloadedPath) {
        throw new Error('Download completed but output file not found')
      }

      // Final progress callback
      if (onProgress) {
        onProgress(100, 'downloaded', { path: downloadedPath })
      }

      // Update context
      return {
        ...context,
        downloadedVideoPath: downloadedPath,
        tempFiles: [...context.tempFiles, downloadedPath],
      }
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async cleanup(context: PipelineContext): Promise<void> {
    // Clean up downloaded file if exists
    if (context.downloadedVideoPath) {
      try {
        await $`rm -f ${context.downloadedVideoPath}`.quiet()
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Parse yt-dlp progress output
   * Example: [download]  45.2% of 1.23GiB at 2.34MiB/s ETA 00:15
   */
  private parseProgress(line: string): {
    percent: number
    downloadedBytes: number
    totalBytes: number
    speed: string
    eta: string
  } | null {
    const match = line.match(
      /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?([\d.]+)([KMG]iB)\s+at\s+([\d.]+[KMG]iB\/s)\s+ETA\s+([\d:]+)/
    )

    if (!match) {
      return null
    }

    const [, percentStr, sizeStr, sizeUnit, speed, eta] = match
    const percent = Math.min(99, Math.floor(parseFloat(percentStr)))

    // Convert size to bytes
    const sizeMultipliers: Record<string, number> = {
      KiB: 1024,
      MiB: 1024 * 1024,
      GiB: 1024 * 1024 * 1024,
    }

    const totalBytes = parseFloat(sizeStr) * (sizeMultipliers[sizeUnit] || 1)
    const downloadedBytes = (totalBytes * percent) / 100

    return {
      percent,
      downloadedBytes: Math.floor(downloadedBytes),
      totalBytes: Math.floor(totalBytes),
      speed,
      eta,
    }
  }

  /**
   * Find the downloaded file in the work directory
   */
  private async findDownloadedFile(workDir: string): Promise<string | null> {
    try {
      const result = await $`find ${workDir} -maxdepth 1 -type f \\( -name "vod.*" -o -name "*.mp4" -o -name "*.mkv" -o -name "*.webm" \\) | head -1`.text()
      const file = result.trim()
      return file || null
    } catch {
      return null
    }
  }
}

/**
 * Factory function for creating download stage
 */
export function createDownloadStage(options?: DownloadStageOptions): DownloadStage {
  return new DownloadStage(options)
}

/**
 * Standalone download function for testing
 */
export async function downloadVod(
  vodUrl: string,
  outputDir: string,
  options?: DownloadStageOptions
): Promise<string> {
  const stage = new DownloadStage(options)

  const context: PipelineContext = {
    job: {} as any, // Not used in standalone mode
    workDir: outputDir,
    vodUrl,
    vodTitle: '',
    tempFiles: [],
    metadata: {},
  }

  const result = await stage.execute(context)

  if (!result.downloadedVideoPath) {
    throw new Error('Download failed: no video path in result')
  }

  return result.downloadedVideoPath
}
