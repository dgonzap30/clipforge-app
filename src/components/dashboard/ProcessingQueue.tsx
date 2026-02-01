import { ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

// Placeholder data
const processingItems = [
  { id: '1', title: 'Late Night Stream', progress: 67 },
  { id: '2', title: 'Ranked Grind', progress: 23 },
  { id: '3', title: 'Just Chatting', progress: 0 },
]

export function ProcessingQueue() {
  return (
    <div className="card">
      <div className="p-4 border-b border-dark-800 flex items-center justify-between">
        <h2 className="font-semibold">Processing</h2>
        <Link to="/queue" className="text-sm text-forge-400 hover:text-forge-300 flex items-center gap-1">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="p-4 space-y-4">
        {processingItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.progress > 0 ? (
                  <Loader2 className="w-4 h-4 text-forge-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-dark-600" />
                )}
                <span className="text-sm font-medium truncate">{item.title}</span>
              </div>
              <span className="text-sm text-dark-400">{item.progress}%</span>
            </div>
            <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-forge-500 transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        ))}
        
        {processingItems.length === 0 && (
          <p className="text-sm text-dark-500 text-center py-4">
            No streams processing
          </p>
        )}
      </div>
    </div>
  )
}
