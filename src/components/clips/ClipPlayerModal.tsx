import { X, Play, Pause, Volume2, VolumeX, Maximize, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { clips } from '@/lib/api'

interface ClipPlayerModalProps {
  clipId: string
  isOpen: boolean
  onClose: () => void
}

export function ClipPlayerModal({ clipId, isOpen, onClose }: ClipPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [clip, setClip] = useState<any>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  // Fetch clip data and signed URL
  useEffect(() => {
    if (!isOpen || !clipId) return

    const fetchClip = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch clip metadata
        const data = await clips.get(clipId)
        setClip(data)

        // Fetch signed URL if clip is ready
        if (data.status === 'ready') {
          const urlData = await clips.getSignedUrl(clipId)
          setSignedUrl(urlData.url)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clip')
      } finally {
        setLoading(false)
      }
    }

    fetchClip()
  }, [clipId, isOpen])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 5)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'Escape':
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (!document.fullscreenElement) {
      video.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newTime = parseFloat(e.target.value)
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleDownload = () => {
    if (!signedUrl) return

    const link = document.createElement('a')
    link.href = signedUrl
    link.download = `${clip?.title || 'clip'}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white hover:text-forge-400 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal content */}
        <div className="bg-dark-900 rounded-lg overflow-hidden shadow-2xl">
          {loading ? (
            <div className="aspect-video flex items-center justify-center bg-dark-800">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-forge-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-dark-400">Loading clip...</p>
              </div>
            </div>
          ) : error ? (
            <div className="aspect-video flex items-center justify-center bg-dark-800">
              <div className="text-center">
                <p className="text-red-400 mb-2">Failed to load clip</p>
                <p className="text-sm text-dark-400">{error}</p>
              </div>
            </div>
          ) : clip?.status !== 'ready' ? (
            <div className="aspect-video flex items-center justify-center bg-dark-800">
              <div className="text-center">
                <p className="text-dark-400 mb-2">Clip is {clip?.status || 'not ready'}</p>
                <p className="text-sm text-dark-500">Please wait for processing to complete</p>
              </div>
            </div>
          ) : !signedUrl ? (
            <div className="aspect-video flex items-center justify-center bg-dark-800">
              <div className="text-center">
                <p className="text-dark-400">No video URL available</p>
              </div>
            </div>
          ) : (
            <>
              {/* Video player */}
              <div className="relative bg-black aspect-video group">
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  src={signedUrl}
                  onClick={togglePlayPause}
                />

                {/* Play/Pause overlay */}
                {!isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={togglePlayPause}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                      <Play className="w-10 h-10 text-white fill-white ml-1" />
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Progress bar */}
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 mb-3 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  {/* Control buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Play/Pause */}
                      <button
                        onClick={togglePlayPause}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white" />
                        )}
                      </button>

                      {/* Volume */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5 text-white" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-white" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-20 h-1 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>

                      {/* Time */}
                      <span className="text-sm text-white font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Download */}
                      <button
                        onClick={handleDownload}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Download clip"
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Fullscreen"
                      >
                        <Maximize className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clip info */}
              <div className="p-4 border-t border-dark-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{clip.title}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-dark-400">
                      <span>Duration: {formatTime(clip.duration)}</span>
                      <span>HYDE Score: {clip.hydeScore.toFixed(1)}</span>
                      {clip.signals.chatVelocity && (
                        <span>Chat: {clip.signals.chatVelocity.toFixed(1)}</span>
                      )}
                      {clip.signals.audioPeak && (
                        <span>Audio: {clip.signals.audioPeak.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-4 text-center text-sm text-dark-500">
          <span>Space: Play/Pause</span>
          <span className="mx-2">•</span>
          <span>←/→: Seek</span>
          <span className="mx-2">•</span>
          <span>M: Mute</span>
          <span className="mx-2">•</span>
          <span>F: Fullscreen</span>
          <span className="mx-2">•</span>
          <span>Esc: Close</span>
        </div>
      </div>
    </div>
  )
}
