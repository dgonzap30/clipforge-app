import { useEffect, useState, useCallback } from 'react'
import { api, ProcessingJob, JobStatus } from '@/lib/api'

interface UseJobsOptions {
  status?: JobStatus
  pollInterval?: number // ms, 0 to disable
}

export function useJobs(options: UseJobsOptions = {}) {
  const { status, pollInterval = 5000 } = options
  
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchJobs = useCallback(async () => {
    try {
      const { jobs: fetchedJobs } = await api.jobs.list(status)
      setJobs(fetchedJobs)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }, [status])
  
  useEffect(() => {
    fetchJobs()
    
    // Set up polling if enabled and there are active jobs
    if (pollInterval > 0) {
      const interval = setInterval(() => {
        // Only poll if there are non-terminal jobs
        const hasActiveJobs = jobs.some(
          j => !['completed', 'failed'].includes(j.status)
        )
        if (hasActiveJobs || loading) {
          fetchJobs()
        }
      }, pollInterval)
      
      return () => clearInterval(interval)
    }
  }, [fetchJobs, pollInterval, jobs, loading])
  
  const createJob = async (data: Parameters<typeof api.jobs.create>[0]) => {
    const job = await api.jobs.create(data)
    setJobs(prev => [job, ...prev])
    return job
  }
  
  const cancelJob = async (id: string) => {
    const job = await api.jobs.cancel(id)
    setJobs(prev => prev.map(j => j.id === id ? job : j))
    return job
  }
  
  const retryJob = async (id: string) => {
    const job = await api.jobs.retry(id)
    setJobs(prev => prev.map(j => j.id === id ? job : j))
    return job
  }
  
  const deleteJob = async (id: string) => {
    await api.jobs.delete(id)
    setJobs(prev => prev.filter(j => j.id !== id))
  }
  
  return {
    jobs,
    loading,
    error,
    refresh: fetchJobs,
    createJob,
    cancelJob,
    retryJob,
    deleteJob,
  }
}

/**
 * Hook for watching a single job's progress
 */
export function useJobProgress(jobId: string | null, pollInterval = 2000) {
  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [loading, setLoading] = useState(!!jobId)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setLoading(false)
      return
    }
    
    let mounted = true
    
    const fetchJob = async () => {
      try {
        const fetchedJob = await api.jobs.get(jobId)
        if (mounted) {
          setJob(fetchedJob)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to fetch job:', err)
          setError(err instanceof Error ? err.message : 'Failed to fetch job')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    fetchJob()
    
    // Poll until job is terminal
    const interval = setInterval(() => {
      if (job && ['completed', 'failed'].includes(job.status)) {
        clearInterval(interval)
        return
      }
      fetchJob()
    }, pollInterval)
    
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [jobId, pollInterval])
  
  return { job, loading, error }
}
