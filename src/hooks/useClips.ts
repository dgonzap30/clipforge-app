import { useEffect, useState, useCallback } from 'react'
import { api, Clip } from '@/lib/api'

interface UseClipsOptions {
  status?: Clip['status']
  limit?: number
  offset?: number
  pollInterval?: number // ms, 0 to disable
}

export function useClips(options: UseClipsOptions = {}) {
  const { status, limit, offset, pollInterval = 0 } = options

  const [clips, setClips] = useState<Clip[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClips = useCallback(async () => {
    try {
      const response = await api.clips.list({ status, limit, offset })
      setClips(response.clips)
      setTotal(response.total)
      setHasMore(response.hasMore)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch clips:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch clips')
    } finally {
      setLoading(false)
    }
  }, [status, limit, offset])

  useEffect(() => {
    fetchClips()

    // Set up polling if enabled
    if (pollInterval > 0) {
      const interval = setInterval(() => {
        // Only poll if there are processing clips
        const hasProcessingClips = clips.some(
          c => c.status === 'processing'
        )
        if (hasProcessingClips || loading) {
          fetchClips()
        }
      }, pollInterval)

      return () => clearInterval(interval)
    }
  }, [fetchClips, pollInterval, clips, loading])

  const updateClip = async (id: string, data: Partial<Pick<Clip, 'title' | 'status'>>) => {
    const clip = await api.clips.update(id, data)
    setClips(prev => prev.map(c => c.id === id ? clip : c))
    return clip
  }

  const deleteClip = async (id: string) => {
    await api.clips.delete(id)
    setClips(prev => prev.filter(c => c.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  const bulkDelete = async (ids: string[]) => {
    const result = await api.clips.bulkDelete(ids)
    setClips(prev => prev.filter(c => !ids.includes(c.id)))
    setTotal(prev => Math.max(0, prev - result.deleted))
    return result
  }

  const bulkExport = async (ids: string[], platform: 'tiktok' | 'youtube' | 'instagram') => {
    return await api.clips.bulkExport(ids, platform)
  }

  return {
    clips,
    total,
    hasMore,
    loading,
    error,
    refresh: fetchClips,
    updateClip,
    deleteClip,
    bulkDelete,
    bulkExport,
  }
}
