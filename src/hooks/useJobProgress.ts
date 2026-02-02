/**
 * useJobProgress Hook
 *
 * Subscribes to Supabase Realtime for live job progress updates.
 * Listens to changes on the jobs table and returns real-time progress data.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ProcessingJob } from '@/lib/api'

export interface UseJobProgressOptions {
  /**
   * Whether to fetch initial job data on mount
   * @default true
   */
  fetchInitial?: boolean
  /**
   * Callback fired when job updates are received
   */
  onUpdate?: (job: ProcessingJob) => void
  /**
   * Callback fired when job completes (status: completed or failed)
   */
  onComplete?: (job: ProcessingJob) => void
}

export interface UseJobProgressReturn {
  /**
   * Current job data with live updates
   */
  job: ProcessingJob | null
  /**
   * Loading state (true during initial fetch)
   */
  loading: boolean
  /**
   * Error message if subscription or fetch fails
   */
  error: string | null
  /**
   * Whether the Realtime subscription is active
   */
  subscribed: boolean
  /**
   * Manually refresh job data from the database
   */
  refresh: () => Promise<void>
}

/**
 * Hook for monitoring a single job's progress via Supabase Realtime
 *
 * @param jobId - The job ID to monitor, or null to unsubscribe
 * @param options - Configuration options
 * @returns Job data, loading state, and subscription status
 *
 * @example
 * ```tsx
 * function JobMonitor({ jobId }: { jobId: string }) {
 *   const { job, loading, error, subscribed } = useJobProgress(jobId, {
 *     onComplete: (job) => {
 *       if (job.status === 'completed') {
 *         toast.success('Job completed!')
 *       }
 *     }
 *   })
 *
 *   if (loading) return <Spinner />
 *   if (error) return <Error message={error} />
 *   if (!job) return null
 *
 *   return (
 *     <div>
 *       <h2>{job.title}</h2>
 *       <ProgressBar value={job.progress} />
 *       <p>{job.currentStep}</p>
 *       {subscribed && <Badge>Live</Badge>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useJobProgress(
  jobId: string | null,
  options: UseJobProgressOptions = {}
): UseJobProgressReturn {
  const { fetchInitial = true, onUpdate, onComplete } = options

  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [loading, setLoading] = useState(!!jobId && fetchInitial)
  const [error, setError] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)
  const onCompleteRef = useRef(onComplete)

  // Keep callback refs up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate
    onCompleteRef.current = onComplete
  }, [onUpdate, onComplete])

  /**
   * Transform Supabase row to ProcessingJob format
   */
  const transformJob = useCallback((row: any): ProcessingJob => {
    return {
      id: row.id,
      vodId: row.vod_id,
      vodUrl: row.vod_url,
      title: row.title,
      channelLogin: row.channel_login,
      duration: row.duration,
      status: row.status,
      progress: row.progress,
      currentStep: row.current_step,
      clipsFound: row.clips_found,
      clipIds: row.clip_ids || [],
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      settings: {
        minDuration: row.settings.min_duration,
        maxDuration: row.settings.max_duration,
        sensitivity: row.settings.sensitivity,
        chatAnalysis: row.settings.chat_analysis,
        audioPeaks: row.settings.audio_peaks,
        faceReactions: row.settings.face_reactions,
        autoCaptions: row.settings.auto_captions,
        outputFormat: row.settings.output_format,
      },
    }
  }, [])

  /**
   * Fetch job data from the database
   */
  const refresh = useCallback(async () => {
    if (!jobId) {
      setJob(null)
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError) throw fetchError

      if (data) {
        const transformedJob = transformJob(data)
        setJob(transformedJob)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to fetch job:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch job')
    } finally {
      setLoading(false)
    }
  }, [jobId, transformJob])

  /**
   * Set up Realtime subscription
   */
  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setLoading(false)
      setSubscribed(false)
      return
    }

    // Fetch initial data if requested
    if (fetchInitial) {
      refresh()
    } else {
      setLoading(false)
    }

    // Create channel for this specific job
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (payload.new) {
            const updatedJob = transformJob(payload.new)
            setJob(updatedJob)
            setError(null)

            // Call update callback
            onUpdateRef.current?.(updatedJob)

            // Check if job completed
            if (
              updatedJob.status === 'completed' ||
              updatedJob.status === 'failed'
            ) {
              onCompleteRef.current?.(updatedJob)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          setJob(null)
          setError('Job was deleted')
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSubscribed(true)
        } else if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to job updates')
          setSubscribed(false)
        } else if (status === 'TIMED_OUT') {
          setError('Subscription timed out')
          setSubscribed(false)
        } else if (status === 'CLOSED') {
          setSubscribed(false)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or jobId change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setSubscribed(false)
    }
  }, [jobId, fetchInitial, refresh, transformJob])

  return {
    job,
    loading,
    error,
    subscribed,
    refresh,
  }
}

export default useJobProgress
