import { supabase } from './supabase'

export const BUCKETS = {
  CLIPS: 'clipforge-clips',
  TEMP: 'clipforge-temp',
} as const

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS]

export interface UploadOptions {
  bucket: BucketName
  path: string
  file: File | Blob | Buffer
  contentType?: string
  upsert?: boolean
}

export interface DownloadOptions {
  bucket: BucketName
  path: string
}

export interface SignedUrlOptions {
  bucket: BucketName
  path: string
  expiresIn?: number
}

export interface StorageError {
  error: string
  details?: string
}

export interface UploadResult {
  success: boolean
  path?: string
  error?: string
}

export interface DownloadResult {
  success: boolean
  data?: Blob
  error?: string
}

export interface SignedUrlResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload a file to a Supabase Storage bucket
 */
export async function upload(options: UploadOptions): Promise<UploadResult> {
  const { bucket, path, file, contentType, upsert = false } = options

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert,
      })

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      path: data.path,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during upload',
    }
  }
}

/**
 * Download a file from a Supabase Storage bucket
 */
export async function download(options: DownloadOptions): Promise<DownloadResult> {
  const { bucket, path } = options

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during download',
    }
  }
}

/**
 * Get a signed URL for a file in a Supabase Storage bucket
 * @param expiresIn - Duration in seconds until the URL expires (default: 3600 = 1 hour)
 */
export async function getSignedUrl(options: SignedUrlOptions): Promise<SignedUrlResult> {
  const { bucket, path, expiresIn = 3600 } = options

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      url: data.signedUrl,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error generating signed URL',
    }
  }
}

/**
 * Delete a file from a Supabase Storage bucket
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during deletion',
    }
  }
}

/**
 * List files in a Supabase Storage bucket folder
 */
export async function listFiles(
  bucket: BucketName,
  folder: string = '',
  options: {
    limit?: number
    offset?: number
    sortBy?: { column: string; order: 'asc' | 'desc' }
  } = {}
) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, options)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      files: data,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error listing files',
    }
  }
}

/**
 * Get public URL for a file (for public buckets only)
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return data.publicUrl
}
