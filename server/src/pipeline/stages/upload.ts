/**
 * Upload Stage
 *
 * Uploads finished clips to Supabase Storage and updates DB records
 */

import { PipelineContext, PipelineStage } from '../types'
import path from 'path'

// TODO: Import Supabase storage helpers when they're created
// import { upload } from '../../lib/storage'

export const uploadStage: PipelineStage = {
  name: 'upload',
  retryable: true,
  maxRetries: 3,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.captionedPaths || ctx.captionedPaths.length === 0) {
      console.log('[upload] No clips to upload, skipping')
      ctx.uploadedUrls = []
      ctx.progress = 100
      return ctx
    }

    console.log(`[upload] Uploading ${ctx.captionedPaths.length} clips to Supabase Storage`)

    const uploadedUrls: string[] = []
    const total = ctx.captionedPaths.length

    for (let i = 0; i < ctx.captionedPaths.length; i++) {
      const clipPath = ctx.captionedPaths[i]
      const fileName = path.basename(clipPath)
      const storagePath = `${ctx.userId}/${ctx.vodId}/${fileName}`

      console.log(`[upload] Uploading clip ${i + 1}/${total}: ${fileName}`)

      try {
        // TODO: Replace with actual Supabase upload when storage.ts exists
        // For now, just simulate upload
        // const url = await upload('clipforge-clips', storagePath, clipPath)

        // Simulated upload - in production this would upload to Supabase
        const url = `https://storage.supabase.co/clipforge-clips/${storagePath}`
        uploadedUrls.push(url)

        console.log(`[upload] Uploaded clip ${i + 1}/${total} to ${url}`)

        // TODO: Create clip record in Supabase DB
        // await supabase.from('clips').insert({
        //   user_id: ctx.userId,
        //   vod_id: ctx.vodId,
        //   video_path: storagePath,
        //   title: 'Clip from VOD',
        //   duration: ...,
        //   status: 'ready',
        // })

      } catch (error) {
        console.error(`[upload] Failed to upload clip ${clipPath}:`, error)
        throw error
      }

      // Scale upload to 85-100% of total progress
      ctx.progress = 85 + Math.floor(((i + 1) / total) * 15)
    }

    console.log(`[upload] Uploaded ${uploadedUrls.length} clips successfully`)

    ctx.uploadedUrls = uploadedUrls
    ctx.progress = 100

    return ctx
  },
}
