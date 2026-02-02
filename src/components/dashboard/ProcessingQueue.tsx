import { ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProcessingJob } from '@/lib/api'

interface ProcessingQueueProps {
  jobs: ProcessingJob[]
}

export function ProcessingQueue({ jobs }: ProcessingQueueProps) {
  return (
    <div className="card">
      <div className="p-4 border-b border-dark-800 flex items-center justify-between">
        <h2 className="font-semibold">Processing</h2>
        <Link to="/queue" className="text-sm text-forge-400 hover:text-forge-300 flex items-center gap-1">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {job.progress > 0 ? (
                  <Loader2 className="w-4 h-4 text-forge-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-dark-600" />
                )}
                <span className="text-sm font-medium truncate">{job.title}</span>
              </div>
              <span className="text-sm text-dark-400">{job.progress}%</span>
            </div>
            <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-forge-500 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        ))}

        {jobs.length === 0 && (
          <p className="text-sm text-dark-500 text-center py-4">
            No streams processing
          </p>
        )}

        {!loading && activeJobs.map((job) => (
          <div key={job.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {job.progress > 0 ? (
                  <Loader2 className="w-4 h-4 text-forge-400 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-dark-600 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-dark-400">{getStatusText(job.status)}</p>
                </div>
              </div>
              <span className="text-sm text-dark-400 flex-shrink-0 ml-2">
                {Math.round(job.progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-forge-500 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            {job.clipsFound > 0 && (
              <p className="text-xs text-dark-500">
                {job.clipsFound} {job.clipsFound === 1 ? 'clip' : 'clips'} found
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
