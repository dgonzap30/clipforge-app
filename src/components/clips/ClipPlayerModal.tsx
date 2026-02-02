import { X, Download, Share2, Edit } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Clip } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ClipPlayerModalProps {
  clip: Clip | null
  isOpen: boolean
  onClose: () => void
  onDownload?: (clip: Clip) => void
  onShare?: (clip: Clip) => void
}

export function ClipPlayerModal({ clip, isOpen, onClose, onDownload, onShare }: ClipPlayerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  if (!isOpen || !clip) return null

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1)
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl mx-4 bg-dark-900 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-semibold truncate">{clip.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
              <span>Duration: {formatDuration(clip.duration)}</span>
              <span>•</span>
              <span>HYDE Score: {formatScore(clip.hydeScore)}</span>
              <span>•</span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                clip.status === 'ready' && 'bg-green-500/20 text-green-400',
                clip.status === 'processing' && 'bg-yellow-500/20 text-yellow-400',
                clip.status === 'failed' && 'bg-red-500/20 text-red-400',
                clip.status === 'exported' && 'bg-blue-500/20 text-blue-400'
              )}>
                {clip.status}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black aspect-video">
          {clip.videoUrl ? (
            <video
              ref={videoRef}
              src={clip.videoUrl}
              controls
              autoPlay
              className="w-full h-full"
              poster={clip.thumbnailUrl}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-dark-500">
              {clip.status === 'processing' ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forge-500 mx-auto mb-3" />
                  <p>Processing video...</p>
                </div>
              ) : (
                <p>Video not available</p>
              )}
            </div>
          )}
        </div>

        {/* Signals Info */}
        {Object.keys(clip.signals).length > 0 && (
          <div className="p-4 border-t border-dark-800 bg-dark-850">
            <h3 className="text-sm font-medium mb-2 text-dark-400">Detection Signals</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {clip.signals.chatVelocity !== undefined && (
                <div className="bg-dark-800 rounded p-2">
                  <div className="text-xs text-dark-500">Chat Velocity</div>
                  <div className="text-lg font-semibold mt-1">{clip.signals.chatVelocity.toFixed(1)}</div>
                </div>
              )}
              {clip.signals.audioPeak !== undefined && (
                <div className="bg-dark-800 rounded p-2">
                  <div className="text-xs text-dark-500">Audio Peak</div>
                  <div className="text-lg font-semibold mt-1">{clip.signals.audioPeak.toFixed(1)}</div>
                </div>
              )}
              {clip.signals.faceReaction !== undefined && (
                <div className="bg-dark-800 rounded p-2">
                  <div className="text-xs text-dark-500">Face Reaction</div>
                  <div className="text-lg font-semibold mt-1">{clip.signals.faceReaction.toFixed(1)}</div>
                </div>
              )}
              {clip.signals.viewerClips !== undefined && (
                <div className="bg-dark-800 rounded p-2">
                  <div className="text-xs text-dark-500">Viewer Clips</div>
                  <div className="text-lg font-semibold mt-1">{clip.signals.viewerClips}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-t border-dark-800">
          <button className="btn-secondary flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Edit Title
          </button>

          {clip.status === 'ready' && (
            <>
              <button
                onClick={() => onDownload?.(clip)}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => onShare?.(clip)}
                className="btn-secondary flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </>
          )}

          <div className="flex-1" />

          <button onClick={onClose} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
