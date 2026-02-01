import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
  trend?: {
    value: number
    positive: boolean
  }
}

export function StatsCard({ icon: Icon, label, value, sublabel, trend }: StatsCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-xl bg-forge-500/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-forge-400" />
        </div>
        {trend && (
          <span className={cn(
            'text-sm font-medium',
            trend.positive ? 'text-green-400' : 'text-red-400'
          )}>
            {trend.positive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
      
      <div className="mt-4">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-dark-400 text-sm mt-1">
          {sublabel || label}
        </p>
      </div>
    </div>
  )
}
