import { ArrowRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface RecentClipItem {
  id: string
  title: string
  game: string
  duration: string
  views: string
}

interface RecentClipsProps {
  clips?: RecentClipItem[]
}

export function RecentClips({ clips = [] }: RecentClipsProps) {
  return (
    <div className="card">
      <div className="p-4 border-b border-dark-800 flex items-center justify-between">
        <h2 className="font-semibold">Recent Clips</h2>
        <Link to="/clips" className="text-sm text-forge-400 hover:text-forge-300 flex items-center gap-1">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="divide-y divide-dark-800">
        {clips.length === 0 ? (
          <div className="p-8 text-center text-dark-400">
            <p>No clips yet. Process a VOD to generate clips!</p>
          </div>
        ) : (
          clips.map((clip) => (
          <div key={clip.id} className="p-4 flex items-center gap-4 hover:bg-dark-800/50 transition-colors">
            {/* Thumbnail */}
            <div className="w-24 h-14 bg-dark-800 rounded-lg flex-shrink-0 relative group cursor-pointer">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-4 h-4 text-white fill-white" />
                </div>
              </div>
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-xs font-mono">
                {clip.duration}
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{clip.title}</h3>
              <p className="text-sm text-dark-400">{clip.game}</p>
            </div>
            
            {/* Views */}
            <div className="text-right flex-shrink-0">
              <p className="font-medium">{clip.views}</p>
              <p className="text-xs text-dark-500">views</p>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  )
}
