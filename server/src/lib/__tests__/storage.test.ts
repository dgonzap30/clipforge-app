import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { upload, download, getSignedUrl, deleteFile, listFiles, BUCKETS } from '../storage'

describe('Storage Helpers', () => {
  const testFilePath = `test/${Date.now()}/test-file.txt`
  const testContent = new Blob(['Hello, ClipForge!'], { type: 'text/plain' })

  afterAll(async () => {
    await deleteFile(BUCKETS.TEMP, testFilePath)
  })

  describe('upload', () => {
    test('should upload a file to the temp bucket', async () => {
      const result = await upload({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
        file: testContent,
        contentType: 'text/plain',
      })

      expect(result.success).toBe(true)
      expect(result.path).toBe(testFilePath)
      expect(result.error).toBeUndefined()
    })

    test('should handle upload errors gracefully', async () => {
      const result = await upload({
        bucket: 'invalid-bucket' as any,
        path: testFilePath,
        file: testContent,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should support upsert option', async () => {
      const result = await upload({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
        file: new Blob(['Updated content'], { type: 'text/plain' }),
        upsert: true,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('download', () => {
    test('should download a file from the temp bucket', async () => {
      await upload({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
        file: testContent,
      })

      const result = await download({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Blob)
      expect(result.error).toBeUndefined()

      const text = await result.data!.text()
      expect(text).toContain('ClipForge')
    })

    test('should handle download errors for non-existent files', async () => {
      const result = await download({
        bucket: BUCKETS.TEMP,
        path: 'non-existent-file.txt',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getSignedUrl', () => {
    test('should generate a signed URL with default expiration', async () => {
      await upload({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
        file: testContent,
      })

      const result = await getSignedUrl({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
      })

      expect(result.success).toBe(true)
      expect(result.url).toBeDefined()
      expect(result.url).toContain('token=')
      expect(result.error).toBeUndefined()
    })

    test('should generate a signed URL with custom expiration', async () => {
      const result = await getSignedUrl({
        bucket: BUCKETS.TEMP,
        path: testFilePath,
        expiresIn: 7200, // 2 hours
      })

      expect(result.success).toBe(true)
      expect(result.url).toBeDefined()
    })

    test('should handle errors for non-existent files', async () => {
      const result = await getSignedUrl({
        bucket: BUCKETS.TEMP,
        path: 'non-existent-file.txt',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('deleteFile', () => {
    test('should delete a file from the temp bucket', async () => {
      const deletePath = `test/${Date.now()}/delete-test.txt`

      await upload({
        bucket: BUCKETS.TEMP,
        path: deletePath,
        file: testContent,
      })

      const result = await deleteFile(BUCKETS.TEMP, deletePath)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()

      const downloadResult = await download({
        bucket: BUCKETS.TEMP,
        path: deletePath,
      })
      expect(downloadResult.success).toBe(false)
    })

    test('should handle deletion of non-existent files', async () => {
      const result = await deleteFile(BUCKETS.TEMP, 'non-existent-file.txt')

      expect(result.success).toBe(true)
    })
  })

  describe('listFiles', () => {
    test('should list files in a bucket folder', async () => {
      const folderPath = `test/${Date.now()}`

      await upload({
        bucket: BUCKETS.TEMP,
        path: `${folderPath}/file1.txt`,
        file: testContent,
      })

      await upload({
        bucket: BUCKETS.TEMP,
        path: `${folderPath}/file2.txt`,
        file: testContent,
      })

      const result = await listFiles(BUCKETS.TEMP, folderPath)

      expect(result.success).toBe(true)
      expect(result.files).toBeDefined()
      expect(Array.isArray(result.files)).toBe(true)

      await deleteFile(BUCKETS.TEMP, `${folderPath}/file1.txt`)
      await deleteFile(BUCKETS.TEMP, `${folderPath}/file2.txt`)
    })

    test('should support pagination options', async () => {
      const result = await listFiles(BUCKETS.TEMP, 'test', {
        limit: 10,
        offset: 0,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('bucket constants', () => {
    test('should have correct bucket names', () => {
      expect(BUCKETS.CLIPS).toBe('clipforge-clips')
      expect(BUCKETS.TEMP).toBe('clipforge-temp')
    })
  })
})
