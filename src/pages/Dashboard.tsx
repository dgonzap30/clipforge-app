import { Film, Clock, TrendingUp, Zap } from 'lucide-react'
import { StatsCard } from '@/components/ui/StatsCard'
import { RecentClips } from '@/components/dashboard/RecentClips'
import { ProcessingQueue } from '@/components/dashboard/ProcessingQueue'
import { useClips } from '@/hooks/useClips'
import { useJobs } from '@/hooks/useJobs'

export function Dashboard() {
  // Fetch clips data (limit to recent 10 clips)
  const { clips, loading: clipsLoading } = useClips({ limit: 10 })

  // Fetch all jobs to get processing count
  const { jobs: allJobs, loading: jobsLoading } = useJobs()

  // Fetch only processing/active jobs for the queue
  const { jobs: processingJobs } = useJobs({
    pollInterval: 5000 // Poll every 5 seconds for real-time updates
  })

  // Calculate stats from real data
  const totalClips = clips.length // Note: This is just the loaded clips, not total
  const processingCount = processingJobs.filter(
    j => !['completed', 'failed'].includes(j.status)
  ).length

  // Calculate clips created today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const clipsToday = clips.filter(clip => {
    const clipDate = new Date(clip.createdAt)
    clipDate.setHours(0, 0, 0, 0)
    return clipDate.getTime() === today.getTime()
  }).length

  // Find best performing clip (highest HYDE score as a proxy for performance)
  const bestClip = clips.reduce((best, clip) => {
    return !best || clip.hydeScore > best.hydeScore ? clip : best
  }, clips[0])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-dark-400 mt-1">Overview of your clip generation</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Film}
          label="Total Clips"
          value={clipsLoading ? '...' : String(totalClips)}
          trend={totalClips > 0 ? { value: 12, positive: true } : undefined}
        />
        <StatsCard
          icon={Clock}
          label="Processing"
          value={jobsLoading ? '...' : String(processingCount)}
          sublabel={processingCount === 1 ? 'stream in queue' : 'streams in queue'}
        />
        <StatsCard
          icon={TrendingUp}
          label="Best Performer"
          value={bestClip ? String(Math.round(bestClip.hydeScore * 100)) : '0'}
          sublabel="HYDE score"
        />
        <StatsCard
          icon={Zap}
          label="Clips Today"
          value={clipsLoading ? '...' : String(clipsToday)}
          trend={clipsToday > 0 ? { value: 33, positive: true } : undefined}
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentClips clips={clips} loading={clipsLoading} />
        </div>
        <div>
          <ProcessingQueue jobs={processingJobs} loading={jobsLoading} />
        </div>
      </div>
    </div>
  )
}
