import { useState } from 'react'
import { Plus, Pause, X, ExternalLink, RefreshCw, Trash2, AlertCircle, ArrowUpCircle } from 'lucide-react'
import { useJobs } from '@/hooks/useJobs'
import { VodBrowserModal } from '@/components/queue/VodBrowserModal'
import { ProcessingJob } from '@/lib/api'

export function Queue() {
  const { jobs, loading, error, refresh, cancelJob, retryJob, deleteJob, prioritizeJob } = useJobs()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleJobCreated = (job: ProcessingJob) => {
    // Job has been created, trigger refresh
    console.log('Job created:', job.id)
    refresh()
    setIsModalOpen(false)
  }

  const handleCancel = async (id: string) => {
    try {
      setActionLoading(id)
      setActionError(null)
      await cancelJob(id)
    } catch (err) {
      console.error('Failed to cancel job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to cancel job')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (id: string) => {
    try {
      setActionLoading(id)
      setActionError(null)
      await retryJob(id)
    } catch (err) {
      console.error('Failed to retry job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to retry job')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(id)
      setActionError(null)
      await deleteJob(id)
    } catch (err) {
      console.error('Failed to delete job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to delete job')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePrioritize = async (id: string) => {
    try {
      setActionLoading(id)
      setActionError(null)
      await prioritizeJob(id)
    } catch (err) {
      console.error('Failed to prioritize job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to prioritize job')
    } finally {
      setActionLoading(null)
    }
  }

  // Helper functions
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      queued: 'Queued',
      downloading: 'Downloading',
      analyzing: 'Analyzing',
      extracting: 'Extracting Clips',
      reframing: 'Reframing',
      captioning: 'Adding Captions',
      completed: 'Completed',
      failed: 'Failed',
    }
    return statusMap[status] || status
  }

  const isProcessing = (status: string) => {
    return ['downloading', 'analyzing', 'extracting', 'reframing', 'captioning'].includes(status)
  }

  // Group jobs by status
  // Only ONE job can be truly active (worker concurrency: 1)
  const processingJobs = jobs.filter(job => isProcessing(job.status))
  // Sort by updatedAt descending - most recent is the active one
  const sortedProcessing = [...processingJobs].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  const activeJob = sortedProcessing[0] || null
  const stalledJobs = sortedProcessing.slice(1) // Jobs that appear stuck

  const queuedJobs = jobs.filter(job => job.status === 'queued')
  const completedJobs = jobs.filter(job => job.status === 'completed')
  const failedJobs = jobs.filter(job => job.status === 'failed')
  const terminalJobs = [...completedJobs, ...failedJobs]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processing Queue</h1>
          <p className="text-dark-400 mt-1">Streams being analyzed for clips</p>
        </div>

        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add Stream
        </button>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 hover:bg-red-500/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Loading Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Queue list */}
      {loading && jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-dark-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <RefreshCw className="w-8 h-8 text-dark-500" />
          </div>
          <p className="text-dark-400">Loading queue...</p>
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-6">
          {/* Active Job (only one can be active with concurrency: 1) */}
          {activeJob && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wide flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-forge-500 animate-pulse" />
                Active
              </h2>
              <div className="card p-4 border-l-4 border-forge-500">
                <div className="flex items-center gap-4">
                  {/* Thumbnail placeholder */}
                  <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                    Thumbnail
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-medium truncate flex-1 min-w-0">{activeJob.title}</h3>
                      <a
                        href={activeJob.vodUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-dark-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-sm text-dark-400 mt-1">
                      {activeJob.channelLogin} • {Math.floor(activeJob.duration / 3600)}:{String(Math.floor((activeJob.duration % 3600) / 60)).padStart(2, '0')}:{String(activeJob.duration % 60).padStart(2, '0')}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-forge-400">{getStatusDisplay(activeJob.status)}</span>
                        <span className="text-dark-400">{Math.round(activeJob.progress)}%</span>
                      </div>
                      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forge-500 transition-all duration-300"
                          style={{ width: `${activeJob.progress}%` }}
                        />
                      </div>
                      {activeJob.currentStep && (
                        <p className="text-xs text-dark-500 mt-1 break-words">
                          {activeJob.currentStep}
                        </p>
                      )}
                      {activeJob.clipsFound > 0 && (
                        <p className="text-xs text-dark-500 mt-1">
                          {activeJob.clipsFound} potential clips found
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      className="btn-secondary p-2"
                      onClick={() => handleCancel(activeJob.id)}
                      disabled={actionLoading === activeJob.id}
                      title="Cancel job"
                    >
                      {actionLoading === activeJob.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      className="btn-ghost p-2 text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(activeJob.id)}
                      disabled={actionLoading === activeJob.id}
                      title="Delete job"
                    >
                      {actionLoading === activeJob.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stalled Jobs - jobs with processing status but not being worked on */}
          {stalledJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Stalled ({stalledJobs.length})
              </h2>
              {stalledJobs.map((job) => (
                <div key={job.id} className="card p-4 border-l-4 border-yellow-500/50 bg-yellow-500/5">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                      Thumbnail
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium truncate flex-1 min-w-0">{job.title}</h3>
                        <a
                          href={job.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-dark-400 hover:text-white transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-sm text-dark-400 mt-1">
                        {job.channelLogin} • {Math.floor(job.duration / 3600)}:{String(Math.floor((job.duration % 3600) / 60)).padStart(2, '0')}:{String(job.duration % 60).padStart(2, '0')}
                      </p>
                      <p className="text-xs text-yellow-400 mt-2">
                        This job appears stuck. Status: {getStatusDisplay(job.status)} • {Math.round(job.progress)}%
                      </p>
                      {job.currentStep && (
                        <p className="text-xs text-dark-500 mt-1 break-words">{job.currentStep}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="btn-secondary p-2"
                        onClick={() => handleCancel(job.id)}
                        disabled={actionLoading === job.id}
                        title="Cancel stalled job"
                      >
                        {actionLoading === job.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        className="btn-ghost p-2 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(job.id)}
                        disabled={actionLoading === job.id}
                        title="Delete job"
                      >
                        {actionLoading === job.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Queued Jobs */}
          {queuedJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wide">
                Queued ({queuedJobs.length})
              </h2>
              {queuedJobs.map((job, index) => (
                <div key={job.id} className="card p-4 group hover:border-forge-500/30 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Queue position */}
                    <div className="w-12 h-12 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-dark-400">#{index + 1}</span>
                    </div>

                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                      Thumbnail
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium truncate flex-1 min-w-0">{job.title}</h3>
                        <a
                          href={job.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-dark-400 hover:text-white transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-sm text-dark-400 mt-1">
                        {job.channelLogin} • {Math.floor(job.duration / 3600)}:{String(Math.floor((job.duration % 3600) / 60)).padStart(2, '0')}:{String(job.duration % 60).padStart(2, '0')}
                      </p>
                      <p className="text-xs text-dark-500 mt-1">{job.currentStep}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Process Next button - visible on hover */}
                      <button
                        className="btn-primary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handlePrioritize(job.id)}
                        disabled={actionLoading === job.id}
                        title="Process next"
                      >
                        {actionLoading === job.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        className="btn-ghost p-2 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(job.id)}
                        disabled={actionLoading === job.id}
                        title="Delete job"
                      >
                        {actionLoading === job.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed/Failed Jobs */}
          {terminalJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-dark-400 uppercase tracking-wide">
                Completed ({terminalJobs.length})
              </h2>
              {terminalJobs.map((job) => (
                <div key={job.id} className="card p-4 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                      Thumbnail
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium truncate flex-1 min-w-0">{job.title}</h3>
                        <a
                          href={job.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-dark-400 hover:text-white transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-sm text-dark-400 mt-1">
                        {job.channelLogin} • {Math.floor(job.duration / 3600)}:{String(Math.floor((job.duration % 3600) / 60)).padStart(2, '0')}:{String(job.duration % 60).padStart(2, '0')}
                      </p>

                      {job.status === 'completed' && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                            Completed
                          </div>
                          <p className="text-xs text-dark-500">
                            {job.clipsFound} clips generated
                          </p>
                        </div>
                      )}

                      {job.status === 'failed' && (
                        <div className="mt-2">
                          <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 inline-block">
                            Failed
                          </div>
                          {job.error && (
                            <p className="text-xs text-red-400 mt-1 break-words">{job.error}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {job.status === 'failed' && (
                        <button
                          className="btn-secondary p-2"
                          onClick={() => handleRetry(job.id)}
                          disabled={actionLoading === job.id}
                          title="Retry job"
                        >
                          {actionLoading === job.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        className="btn-ghost p-2 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(job.id)}
                        disabled={actionLoading === job.id}
                        title="Delete job"
                      >
                        {actionLoading === job.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-dark-800 rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-dark-500" />
          </div>
          <h3 className="text-lg font-medium">No streams in queue</h3>
          <p className="text-dark-400 mt-1">Add a Twitch VOD to start generating clips</p>
          <button
            className="btn-primary mt-4"
            onClick={() => setIsModalOpen(true)}
          >
            Add Your First Stream
          </button>
        </div>
      )}

      {/* VOD Browser Modal */}
      <VodBrowserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onJobCreated={handleJobCreated}
      />
    </div>
  )
}
