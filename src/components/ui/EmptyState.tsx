import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-dark-500" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {title}
      </h3>

      <p className="text-dark-400 text-sm max-w-md mb-6">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
