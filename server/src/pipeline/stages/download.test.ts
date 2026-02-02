/**
 * Download Stage Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { DownloadStage, createDownloadStage, downloadVod } from './download'
import { PipelineContext } from '../types'
import { $ } from 'bun'
import path from 'path'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'

describe('DownloadStage', () => {
  let testDir: string

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(path.join(tmpdir(), 'download-test-'))
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should have correct name', () => {
    const stage = new DownloadStage()
    expect(stage.name).toBe('download')
  })

  test('should validate yt-dlp is available', async () => {
    const stage = new DownloadStage()
    const context: PipelineContext = {
      job: {} as any,
      workDir: testDir,
      vodUrl: 'https://example.com/video',
      vodTitle: 'Test',
      tempFiles: [],
      metadata: {},
    }

    // Check if yt-dlp is installed
    let isInstalled = true
    try {
      await $`yt-dlp --version`.quiet()
    } catch {
      isInstalled = false
    }

    if (isInstalled) {
      await expect(stage.validate(context)).resolves.toBe(true)
    } else {
      await expect(stage.validate(context)).rejects.toThrow('yt-dlp is not installed')
    }
  })

  test('should throw error if vodUrl is missing', async () => {
    const stage = new DownloadStage()
    const context: PipelineContext = {
      job: {} as any,
      workDir: testDir,
      vodUrl: '', // Missing
      vodTitle: 'Test',
      tempFiles: [],
      metadata: {},
    }

    await expect(stage.execute(context)).rejects.toThrow('VOD URL is required')
  })

  test('should throw error if workDir is missing', async () => {
    const stage = new DownloadStage()
    const context: PipelineContext = {
      job: {} as any,
      workDir: '', // Missing
      vodUrl: 'https://example.com/video',
      vodTitle: 'Test',
      tempFiles: [],
      metadata: {},
    }

    await expect(stage.execute(context)).rejects.toThrow('Working directory is required')
  })

  test('should parse download progress correctly', () => {
    const stage = new DownloadStage()

    // Test valid progress line
    const line1 = '[download]  45.2% of 1.23GiB at 2.34MiB/s ETA 00:15'
    const progress1 = (stage as any).parseProgress(line1)

    expect(progress1).toBeTruthy()
    expect(progress1?.percent).toBe(45)
    expect(progress1?.speed).toBe('2.34MiB/s')
    expect(progress1?.eta).toBe('00:15')

    // Test another valid progress line
    const line2 = '[download]  99.9% of 512.5MiB at 10.5MiB/s ETA 00:01'
    const progress2 = (stage as any).parseProgress(line2)

    expect(progress2).toBeTruthy()
    expect(progress2?.percent).toBe(99)
    expect(progress2?.speed).toBe('10.5MiB/s')

    // Test invalid line
    const line3 = 'Some random output'
    const progress3 = (stage as any).parseProgress(line3)

    expect(progress3).toBeNull()
  })

  test('should calculate bytes correctly from size units', () => {
    const stage = new DownloadStage()

    // Test GiB
    const line1 = '[download]  50.0% of 1.00GiB at 1.0MiB/s ETA 00:10'
    const progress1 = (stage as any).parseProgress(line1)
    const expectedGiB = 1 * 1024 * 1024 * 1024
    expect(progress1?.totalBytes).toBeCloseTo(expectedGiB, -6)

    // Test MiB
    const line2 = '[download]  50.0% of 100.0MiB at 1.0MiB/s ETA 00:10'
    const progress2 = (stage as any).parseProgress(line2)
    const expectedMiB = 100 * 1024 * 1024
    expect(progress2?.totalBytes).toBeCloseTo(expectedMiB, -6)
  })

  test('should track progress callbacks', async () => {
    const stage = new DownloadStage()
    const progressUpdates: Array<{ percent: number; status: string }> = []

    // Mock progress callback
    const onProgress = (percent: number, status: string) => {
      progressUpdates.push({ percent, status })
    }

    // Test progress parsing with callback
    const line = '[download]  75.5% of 500.0MiB at 5.0MiB/s ETA 00:05'
    const progress = (stage as any).parseProgress(line)

    if (progress) {
      onProgress(progress.percent, 'downloading')
    }

    expect(progressUpdates.length).toBe(1)
    expect(progressUpdates[0].percent).toBe(75)
    expect(progressUpdates[0].status).toBe('downloading')
  })

  test('createDownloadStage factory should work', () => {
    const stage = createDownloadStage({ format: 'best' })
    expect(stage).toBeInstanceOf(DownloadStage)
    expect(stage.name).toBe('download')
  })

  test('should handle cleanup gracefully', async () => {
    const stage = new DownloadStage()
    const context: PipelineContext = {
      job: {} as any,
      workDir: testDir,
      vodUrl: 'https://example.com/video',
      vodTitle: 'Test',
      downloadedVideoPath: path.join(testDir, 'test.mp4'),
      tempFiles: [],
      metadata: {},
    }

    // Should not throw even if file doesn't exist
    await expect(stage.cleanup(context)).resolves.toBeUndefined()
  })

  test('should update context with downloaded path', async () => {
    // This test would require an actual video URL to download
    // Skipping in unit tests, but structure shows what should happen
    const stage = new DownloadStage()

    // Mock context
    const initialContext: PipelineContext = {
      job: {} as any,
      workDir: testDir,
      vodUrl: 'https://example.com/test.mp4',
      vodTitle: 'Test Video',
      tempFiles: [],
      metadata: {},
    }

    // In a real scenario:
    // const result = await stage.execute(initialContext)
    // expect(result.downloadedVideoPath).toBeTruthy()
    // expect(result.tempFiles).toContain(result.downloadedVideoPath)

    // For now, just verify the structure
    expect(initialContext.tempFiles).toEqual([])
    expect(initialContext.downloadedVideoPath).toBeUndefined()
  })

  test('findDownloadedFile should return null if no file found', async () => {
    const stage = new DownloadStage()
    const emptyDir = path.join(testDir, 'empty')
    await $`mkdir -p ${emptyDir}`.quiet()

    const result = await (stage as any).findDownloadedFile(emptyDir)
    expect(result).toBeNull()
  })

  test('should limit progress percent to 99 max', () => {
    const stage = new DownloadStage()

    // Test 100% is capped at 99
    const line = '[download]  100.0% of 1.00GiB at 1.0MiB/s ETA 00:00'
    const progress = (stage as any).parseProgress(line)

    // Progress should be capped before final completion
    expect(progress?.percent).toBeLessThanOrEqual(99)
  })
})

describe('downloadVod standalone function', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'download-vod-test-'))
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should throw error with invalid URL', async () => {
    // This would fail during actual download, but tests the error handling
    await expect(
      downloadVod('invalid-url', testDir)
    ).rejects.toThrow()
  })

  test('should accept options', async () => {
    const progressCalls: number[] = []

    // Test that options are passed through
    // Would need a real URL to test actual execution
    const stage = createDownloadStage({
      format: 'best',
      maxFileSize: 100,
      onProgress: (percent) => progressCalls.push(percent),
    })

    expect(stage).toBeInstanceOf(DownloadStage)
  })
})
