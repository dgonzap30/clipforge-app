import { useEffect, useState, useCallback } from 'react'
import { api, VOD } from '@/lib/api'

interface UseVodsOptions {
  channel?: string // channel login to fetch VODs for
  pollInterval?: number // ms, 0 to disable
}

export function useVods(options: UseVodsOptions = {}) {
  const { channel, pollInterval = 0 } = options

  const [vods, setVods] = useState<VOD[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [user, setUser] = useState<{ id: string; login: string; displayName: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVods = useCallback(async () => {
    try {
      const response = channel
        ? await api.vods.getByChannel(channel)
        : await api.vods.getMine()

      setVods(response.vods)
      setCursor(response.pagination.cursor)

      if ('user' in response) {
        setUser(response.user)
      } else if ('channel' in response) {
        setUser({
          id: response.channel.id,
          login: response.channel.login,
          displayName: response.channel.displayName,
        })
      }

      setError(null)
    } catch (err) {
      console.error('Failed to fetch VODs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch VODs')
    } finally {
      setLoading(false)
    }
  }, [channel])

  useEffect(() => {
    fetchVods()

    // Set up polling if enabled
    if (pollInterval > 0) {
      const interval = setInterval(() => {
        fetchVods()
      }, pollInterval)

      return () => clearInterval(interval)
    }
  }, [fetchVods, pollInterval])

  return {
    vods,
    cursor,
    user,
    loading,
    error,
    refresh: fetchVods,
  }
}

/**
 * Hook for fetching a single VOD by ID
 */
export function useVod(vodId: string | null) {
  const [vod, setVod] = useState<VOD & {
    description: string
    mutedSegments: Array<{ duration: number; offset: number }> | null
    channel: { id: string; login: string; displayName: string }
  } | null>(null)
  const [loading, setLoading] = useState(!!vodId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!vodId) {
      setVod(null)
      setLoading(false)
      return
    }

    let mounted = true

    const fetchVod = async () => {
      try {
        const fetchedVod = await api.vods.getById(vodId)
        if (mounted) {
          setVod(fetchedVod)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to fetch VOD:', err)
          setError(err instanceof Error ? err.message : 'Failed to fetch VOD')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchVod()

    return () => {
      mounted = false
    }
  }, [vodId])

  return { vod, loading, error }
}
