/**
 * Supabase Storage Helpers
 *
 * Provides upload, download, and URL generation for Storage buckets.
 */

import { supabase } from './supabase'
import { readFileSync } from 'fs'

export const BUCKETS = {
  CLIPS: 'clipforge-clips',
  TEMP: 'clipforge-temp',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

export interface UploadOptions {
  bucket: BucketName
  path: string
  file: string | Buffer
  contentType?: string
  cacheControl?: string
  upsert?: boolean
}

export interface UploadResult {
  path: string
  fullPath: string
  publicUrl?: string
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { bucket, path, file, contentType, cacheControl = '3600', upsert = true } = options

  let fileData: Buffer
  if (typeof file === 'string') {
    fileData = readFileSync(file)
  } else {
    fileData = file
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileData, {
      contentType,
      cacheControl,
      upsert,
    })

  if (error) {
    throw new Error(`Failed to upload file to ${bucket}/${path}: ${error.message}`)
  }

  const fullPath = data.path

  return {
    path,
    fullPath,
  }
}

/**
 * Download a file from Supabase Storage
 */
export async function downloadFile(bucket: BucketName, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path)

  if (error) {
    throw new Error(`Failed to download file from ${bucket}/${path}: ${error.message}`)
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Get a signed URL for private file access
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to create signed URL for ${bucket}/${path}: ${error.message}`)
  }

  return data.signedUrl
}

/**
 * Get a public URL for a file (works only if bucket is public)
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    throw new Error(`Failed to delete file from ${bucket}/${path}: ${error.message}`)
  }
}

/**
 * Delete multiple files from storage
 */
export async function deleteFiles(bucket: BucketName, paths: string[]): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove(paths)

  if (error) {
    throw new Error(`Failed to delete files from ${bucket}: ${error.message}`)
  }
}

/**
 * List files in a bucket path
 */
export async function listFiles(bucket: BucketName, path: string = '') {
  const { data, error } = await supabase.storage.from(bucket).list(path)

  if (error) {
    throw new Error(`Failed to list files in ${bucket}/${path}: ${error.message}`)
  }

  return data
}

/**
 * Copy a file within storage
 */
export async function copyFile(
  sourceBucket: BucketName,
  sourcePath: string,
  destBucket: BucketName,
  destPath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(sourceBucket)
    .copy(sourcePath, `${destBucket}/${destPath}`)

  if (error) {
    throw new Error(
      `Failed to copy file from ${sourceBucket}/${sourcePath} to ${destBucket}/${destPath}: ${error.message}`
    )
  }
}

/**
 * Move a file within storage
 */
export async function moveFile(
  sourceBucket: BucketName,
  sourcePath: string,
  destBucket: BucketName,
  destPath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(sourceBucket)
    .move(sourcePath, `${destBucket}/${destPath}`)

  if (error) {
    throw new Error(
      `Failed to move file from ${sourceBucket}/${sourcePath} to ${destBucket}/${destPath}: ${error.message}`
    )
  }
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(bucket: BucketName, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).download(path)

  return !error
}
