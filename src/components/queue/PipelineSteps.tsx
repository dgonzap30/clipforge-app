
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { JobStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PipelineStepsProps {
    status: JobStatus
    progress: number // 0-100 for current stage
}

interface Step {
    id: string
    label: string
    statuses: JobStatus[]
}

const STEPS: Step[] = [
    { id: 'download', label: 'Download', statuses: ['downloading'] },
    { id: 'analyze', label: 'Analyze', statuses: ['analyzing'] },
    { id: 'extract', label: 'Extract', statuses: ['extracting'] },
    { id: 'reframe', label: 'Reframe', statuses: ['reframing'] },
    { id: 'caption', label: 'Caption', statuses: ['captioning', 'processing'] }, // processing/effects grouped here or separate? 'processing' usually implies effects stage
]

export function PipelineSteps({ status, progress }: PipelineStepsProps) {
    // Determine current step index
    const getCurrentStepIndex = (s: JobStatus) => {
        if (s === 'completed') return STEPS.length
        if (s === 'failed') return -1 // Handle separately or show fail state on current
        if (s === 'queued') return -1
        return STEPS.findIndex(step => step.statuses.includes(s))
    }

    const currentStepIndex = getCurrentStepIndex(status)
    const isCompleted = status === 'completed'
    // const isFailed = status === 'failed' // Unused for now

    return (
        <div className="w-full flex items-center justify-between gap-1 text-xs">
            {STEPS.map((step, index) => {
                let state: 'pending' | 'active' | 'completed' = 'pending'

                if (isCompleted) {
                    state = 'completed'
                } else if (currentStepIndex > index) {
                    state = 'completed'
                } else if (currentStepIndex === index) {
                    state = 'active'
                }

                return (
                    <div key={step.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        {/* Icon/Indicator */}
                        <div className="relative flex items-center justify-center">
                            {/* Connector Line (Left) */}
                            {index > 0 && (
                                <div
                                    className={cn(
                                        "absolute right-[50%] top-1/2 -translate-y-1/2 w-[calc(100%+1rem)] h-0.5 -z-10",
                                        state === 'completed' || (state === 'active' && currentStepIndex > -1) // line to active is colored? Usually line BEHIND is colored.
                                            ? "bg-forge-500/30"
                                            : "bg-dark-700"
                                    )}
                                />
                            )}

                            <div
                                className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center border-2 bg-dark-900 transition-colors relative",
                                    state === 'completed' && "border-green-500 text-green-500 bg-green-500/10",
                                    state === 'active' && "border-forge-400 text-forge-400",
                                    state === 'pending' && "border-dark-700 text-dark-700"
                                )}
                                title={state === 'active' ? `${progress}%` : undefined}
                            >
                                {state === 'completed' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : state === 'active' ? (
                                    // Show mini loader or just the icon
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Circle className="w-3.5 h-3.5" />
                                )}
                            </div>
                        </div>

                        {/* Label */}
                        <span
                            className={cn(
                                "hidden sm:block font-medium truncate max-w-full px-1",
                                state === 'active' ? "text-white" : "text-dark-400"
                            )}
                        >
                            {step.label}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
