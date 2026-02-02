/**
 * Upload Stage
 *
 * Uploads finished clips to Supabase Storage and updates clip records with paths.
 */

import { PipelineContext, PipelineStage } from '../types'
import { uploadFile, getSignedUrl, BUCKETS } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { existsSync, statSync } from 'fs'
import { basename } from 'path'

export interface UploadStageOptions {
  generatePublicUrls?: boolean
  signedUrlExpiry?: number // seconds
}

/**
 * Upload clips to Supabase Storage
 *
 * This stage:
 * 1. Uploads video files to clipforge-clips bucket
 * 2. Uploads thumbnail files to clipforge-clips bucket
 * 3. Updates clip records in Supabase DB with storage paths
 * 4. Generates signed URLs for access
 */
export async function uploadStage(
  context: PipelineContext,
  options: UploadStageOptions = {}
): Promise<PipelineContext> {
  const { generatePublicUrls = false, signedUrlExpiry = 86400 } = options

  context.currentStage = 'upload'
  context.progress = 0

  // Get clips to upload from previous stages
  const clipsToUpload = context.captionedClips || context.reframedClips || context.extractedClips

  if (!clipsToUpload || clipsToUpload.length === 0) {
    throw new Error('No clips available to upload')
  }

  const uploadedClips: PipelineContext['uploadedClips'] = []
  const totalClips = clipsToUpload.length

  for (let i = 0; i < clipsToUpload.length; i++) {
    const clip = clipsToUpload[i]
    const clipProgress = ((i + 1) / totalClips) * 100

    try {
      // Determine video path (use captioned if available, otherwise reframed/extracted)
      const videoPath = clip.path
      if (!existsSync(videoPath)) {
        console.warn(`Video file not found for clip ${clip.clipId}: ${videoPath}`)
        continue
      }

      // Generate storage paths
      const timestamp = Date.now()
      const videoFileName = `${clip.clipId}_${timestamp}.mp4`
      const thumbnailFileName = `${clip.clipId}_${timestamp}_thumb.jpg`

      const videoStoragePath = `${context.userId}/${context.jobId}/${videoFileName}`
      const thumbnailStoragePath = `${context.userId}/${context.jobId}/${thumbnailFileName}`

      // Upload video file
      console.log(`Uploading video for clip ${clip.clipId}...`)
      const videoUploadResult = await uploadFile({
        bucket: BUCKETS.CLIPS,
        path: videoStoragePath,
        file: videoPath,
        contentType: 'video/mp4',
        cacheControl: '31536000', // 1 year
      })

      // Find and upload thumbnail
      let thumbnailUploadResult
      const thumbnailPath = findThumbnailPath(videoPath, context.extractedClips || [])

      if (thumbnailPath && existsSync(thumbnailPath)) {
        console.log(`Uploading thumbnail for clip ${clip.clipId}...`)
        thumbnailUploadResult = await uploadFile({
          bucket: BUCKETS.CLIPS,
          path: thumbnailStoragePath,
          file: thumbnailPath,
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        })
      }

      // Generate URLs
      const videoUrl = await getSignedUrl(
        BUCKETS.CLIPS,
        videoUploadResult.fullPath,
        signedUrlExpiry
      )

      const thumbnailUrl = thumbnailUploadResult
        ? await getSignedUrl(BUCKETS.CLIPS, thumbnailUploadResult.fullPath, signedUrlExpiry)
        : undefined

      // Update clip record in database
      const clipData = {
        id: clip.clipId,
        job_id: context.jobId,
        user_id: context.userId,
        vod_id: context.vodId,
        title: extractClipTitle(context.vodTitle, i),
        video_path: videoUploadResult.fullPath,
        thumbnail_path: thumbnailUploadResult?.fullPath,
        status: 'ready',
        duration: calculateDuration(context.extractedClips, clip.clipId),
        hyde_score: getClipHydeScore(context.moments, clip.clipId, context.extractedClips),
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('clips')
        .upsert(clipData, { onConflict: 'id' })

      if (updateError) {
        console.error(`Failed to update clip ${clip.clipId} in database:`, updateError)
        throw new Error(`Database update failed for clip ${clip.clipId}: ${updateError.message}`)
      }

      uploadedClips.push({
        clipId: clip.clipId,
        videoPath: videoUploadResult.fullPath,
        thumbnailPath: thumbnailUploadResult?.fullPath || '',
        videoUrl,
        thumbnailUrl: thumbnailUrl || '',
      })

      // Update progress
      context.progress = clipProgress
      console.log(`Upload progress: ${clipProgress.toFixed(1)}%`)
    } catch (error) {
      console.error(`Failed to upload clip ${clip.clipId}:`, error)
      // Continue with other clips even if one fails
      // Log error but don't stop the entire upload process
    }
  }

  if (uploadedClips.length === 0) {
    throw new Error('Failed to upload any clips')
  }

  context.uploadedClips = uploadedClips
  context.progress = 100

  console.log(`Successfully uploaded ${uploadedClips.length} of ${totalClips} clips`)

  return context
}

/**
 * Find the thumbnail path for a given video path
 */
function findThumbnailPath(videoPath: string, extractedClips: any[]): string | undefined {
  // Try to find corresponding thumbnail from extractedClips
  const clip = extractedClips.find(c => c.path === videoPath || c.id === basename(videoPath, '.mp4'))

  if (clip?.thumbnailPath) {
    return clip.thumbnailPath
  }

  // Fallback: look for _thumb.jpg variant
  const thumbPath = videoPath.replace(/\.mp4$/, '_thumb.jpg')
  if (existsSync(thumbPath)) {
    return thumbPath
  }

  return undefined
}

/**
 * Extract a title for the clip
 */
function extractClipTitle(vodTitle: string, index: number): string {
  return `${vodTitle} - Clip ${index + 1}`
}

/**
 * Calculate clip duration from extracted clips data
 */
function calculateDuration(extractedClips: any[] | undefined, clipId: string): number {
  if (!extractedClips) return 0

  const clip = extractedClips.find(c => c.id === clipId)
  return clip?.duration || 0
}

/**
 * Get HYDE score for a clip
 */
function getClipHydeScore(
  moments: any[] | undefined,
  clipId: string,
  extractedClips: any[] | undefined
): number {
  if (!moments || !extractedClips) return 0

  const clip = extractedClips.find(c => c.id === clipId)
  if (!clip?.moment) return 0

  return clip.moment.score || 0
}

/**
 * Upload stage factory
 */
export function createUploadStage(options: UploadStageOptions = {}): PipelineStage {
  return {
    name: 'upload',
    execute: async (context: PipelineContext) => {
      return await uploadStage(context, options)
    },
    cleanup: async (context: PipelineContext) => {
      // Cleanup is handled by the orchestrator
      // This stage doesn't need to clean up uploaded files
      console.log('Upload stage cleanup - no action needed')
    },
  }
}

export default createUploadStage
