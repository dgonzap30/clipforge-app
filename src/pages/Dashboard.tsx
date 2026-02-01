import { Film, Clock, TrendingUp, Zap } from 'lucide-react'
import { StatsCard } from '@/components/ui/StatsCard'
import { RecentClips } from '@/components/dashboard/RecentClips'
import { ProcessingQueue } from '@/components/dashboard/ProcessingQueue'

export function Dashboard() {
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
          value="127"
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          icon={Clock}
          label="Processing"
          value="3"
          sublabel="streams in queue"
        />
        <StatsCard
          icon={TrendingUp}
          label="Best Performer"
          value="24.3K"
          sublabel="views on TikTok"
        />
        <StatsCard
          icon={Zap}
          label="Clips Today"
          value="8"
          trend={{ value: 33, positive: true }}
        />
      </div>
      
      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentClips />
        </div>
        <div>
          <ProcessingQueue />
        </div>
      </div>
    </div>
  )
}
