import { Play, Download, Share2, Trash2, Edit2, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Clip } from '@/lib/api'

interface ClipCardProps {
  clip: Clip
  onPlay?: (clip: Clip) => void
  onEdit?: (clip: Clip) => void
  onDownload?: (clip: Clip) => void
  onShare?: (clip: Clip) => void
  onDelete?: (clip: Clip) => void
  className?: string
}

/**
 * Format duration in seconds to MM:SS format
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get status badge configuration based on clip status
 */
function getStatusConfig(status: Clip['status']) {
  switch (status) {
    case 'processing':
      return {
        icon: Loader2,
        label: 'Processing',
        className: 'bg-blue-500/10 text-blue-400',
        iconClassName: 'animate-spin',
      }
    case 'ready':
      return {
        icon: CheckCircle2,
        label: 'Ready',
        className: 'bg-green-500/10 text-green-400',
        iconClassName: '',
      }
    case 'exported':
      return {
        icon: CheckCircle2,
        label: 'Exported',
        className: 'bg-forge-500/10 text-forge-400',
        iconClassName: '',
      }
    case 'failed':
      return {
        icon: AlertCircle,
        label: 'Failed',
        className: 'bg-red-500/10 text-red-400',
        iconClassName: '',
      }
  }
}

export function ClipCard({
  clip,
  onPlay,
  onEdit,
  onDownload,
  onShare,
  onDelete,
  className,
}: ClipCardProps) {
  const statusConfig = getStatusConfig(clip.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className={cn('card overflow-hidden group', className)}>
      {/* Thumbnail Section */}
      <div className="relative aspect-video bg-dark-800">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-dark-600" />
          </div>
        )}

        {/* Play Button Overlay */}
        {clip.status === 'ready' && onPlay && (
          <button
            onClick={() => onPlay(clip)}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
            aria-label="Play clip"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </button>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-mono font-medium">
          {formatDuration(clip.duration)}
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <div className={cn(
            'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5',
            statusConfig.className
          )}>
            <StatusIcon className={cn('w-3.5 h-3.5', statusConfig.iconClassName)} />
            {statusConfig.label}
          </div>
        </div>

        {/* HYDE Score Badge */}
        {clip.hydeScore >= 70 && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-forge-500/90 backdrop-blur-sm rounded text-xs font-bold">
            {Math.round(clip.hydeScore)}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-base line-clamp-2 mb-2" title={clip.title}>
          {clip.title}
        </h3>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-dark-400 mb-4">
          <span>Score: {Math.round(clip.hydeScore)}</span>
          {clip.signals.chatVelocity !== undefined && (
            <span>Chat: {Math.round(clip.signals.chatVelocity)}</span>
          )}
          {clip.signals.audioPeak !== undefined && (
            <span>Audio: {Math.round(clip.signals.audioPeak)}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(clip)}
              className="flex-1 px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              aria-label="Edit clip"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}

          {onDownload && clip.status === 'ready' && (
            <button
              onClick={() => onDownload(clip)}
              className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              aria-label="Download clip"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {onShare && clip.status === 'ready' && (
            <button
              onClick={() => onShare(clip)}
              className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              aria-label="Share clip"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(clip)}
              className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-red-500/20 text-red-400 transition-colors"
              aria-label="Delete clip"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
