import { ExternalLink, X, RotateCcw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { ProcessingJob, JobStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

interface JobCardProps {
  job: ProcessingJob
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
}

const STATUS_CONFIG: Record<JobStatus, {
  label: string
  color: string
  icon?: React.ComponentType<{ className?: string }>
}> = {
  queued: {
    label: 'Queued',
    color: 'text-dark-400',
  },
  downloading: {
    label: 'Downloading',
    color: 'text-blue-400',
    icon: Loader2,
  },
  analyzing: {
    label: 'Analyzing',
    color: 'text-forge-400',
    icon: Loader2,
  },
  extracting: {
    label: 'Extracting',
    color: 'text-purple-400',
    icon: Loader2,
  },
  reframing: {
    label: 'Reframing',
    color: 'text-indigo-400',
    icon: Loader2,
  },
  captioning: {
    label: 'Captioning',
    color: 'text-cyan-400',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    icon: AlertCircle,
  },
}

export function JobCard({ job, onCancel, onRetry, onDelete }: JobCardProps) {
  const statusConfig = STATUS_CONFIG[job.status]
  const StatusIcon = statusConfig.icon
  const isProcessing = !['queued', 'completed', 'failed'].includes(job.status)
  const isTerminal = ['completed', 'failed'].includes(job.status)
  const canCancel = !isTerminal && onCancel
  const canRetry = job.status === 'failed' && onRetry
  const canDelete = onDelete

  // Format duration from seconds to HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        {/* Thumbnail placeholder - could be replaced with actual thumbnail */}
        <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
          Thumbnail
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0">
          {/* Title and channel */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{job.title}</h3>
                <a
                  href={job.vodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark-400 hover:text-white transition-colors"
                  title="Open VOD"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-sm text-dark-400 mt-1">
                {job.channelLogin} • {formatDuration(job.duration)}
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3">
            {StatusIcon && (
              <StatusIcon
                className={cn(
                  'w-4 h-4',
                  statusConfig.color,
                  isProcessing && 'animate-spin'
                )}
              />
            )}
            <span className={cn('text-sm font-medium', statusConfig.color)}>
              {statusConfig.label}
              {job.currentStep && isProcessing && ` - ${job.currentStep}`}
            </span>
          </div>

          {/* Progress bar - only show for non-terminal states */}
          {!isTerminal && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-dark-400">
                  {job.status === 'queued' ? 'Waiting in queue...' : 'Processing...'}
                </span>
                <span className="text-dark-400">{job.progress}%</span>
              </div>
              <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    job.status === 'queued' ? 'bg-dark-600' : 'bg-forge-500'
                  )}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Clips found / Error message */}
          {job.status === 'completed' && (
            <p className="text-sm text-green-400">
              {job.clipsFound} {job.clipsFound === 1 ? 'clip' : 'clips'} found
            </p>
          )}

          {job.status === 'failed' && job.error && (
            <p className="text-sm text-red-400 mt-1">
              Error: {job.error}
            </p>
          )}

          {isProcessing && job.clipsFound > 0 && (
            <p className="text-xs text-dark-500 mt-1">
              {job.clipsFound} potential {job.clipsFound === 1 ? 'clip' : 'clips'} found
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-start gap-2 flex-shrink-0">
          {canRetry && (
            <button
              onClick={() => onRetry(job.id)}
              className="btn-secondary p-2"
              title="Retry job"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => onCancel(job.id)}
              className="btn-secondary p-2"
              title="Cancel job"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(job.id)}
              className="btn-ghost p-2 text-red-400 hover:text-red-300"
              title="Delete job"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
