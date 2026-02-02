import { supabase } from './supabase'

const CLIPS_BUCKET = 'clipforge-clips'
const TEMP_BUCKET = 'clipforge-temp'

/**
 * Generate a signed URL for a file in Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The file path in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!path) {
    return null
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Error generating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Unexpected error generating signed URL:', error)
    return null
  }
}

/**
 * Upload a file to Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The destination path in the bucket
 * @param file - The file data (Buffer, ReadableStream, etc.)
 * @param contentType - Optional content type
 * @returns Path of uploaded file or null if error
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Blob | Buffer | ArrayBuffer,
  contentType?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error('Error uploading file:', error)
      return null
    }

    return data.path
  } catch (error) {
    console.error('Unexpected error uploading file:', error)
    return null
  }
}

/**
 * Download a file from Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The file path in the bucket
 * @returns File blob or null if error
 */
export async function downloadFile(
  bucket: string,
  path: string
): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)

    if (error) {
      console.error('Error downloading file:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error downloading file:', error)
    return null
  }
}

/**
 * Delete a file from Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The file path in the bucket
 * @returns True if successful, false otherwise
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('Error deleting file:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Unexpected error deleting file:', error)
    return false
  }
}

// Convenience functions for specific buckets
export const clips = {
  getSignedUrl: (path: string, expiresIn?: number) =>
    getSignedUrl(CLIPS_BUCKET, path, expiresIn),
  upload: (path: string, file: Blob | Buffer | ArrayBuffer, contentType?: string) =>
    uploadFile(CLIPS_BUCKET, path, file, contentType),
  download: (path: string) => downloadFile(CLIPS_BUCKET, path),
  delete: (path: string) => deleteFile(CLIPS_BUCKET, path),
}

export const temp = {
  getSignedUrl: (path: string, expiresIn?: number) =>
    getSignedUrl(TEMP_BUCKET, path, expiresIn),
  upload: (path: string, file: Blob | Buffer | ArrayBuffer, contentType?: string) =>
    uploadFile(TEMP_BUCKET, path, file, contentType),
  download: (path: string) => downloadFile(TEMP_BUCKET, path),
  delete: (path: string) => deleteFile(TEMP_BUCKET, path),
}
