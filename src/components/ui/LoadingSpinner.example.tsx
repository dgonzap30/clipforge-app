import { LoadingSpinner } from './LoadingSpinner'

/**
 * Usage examples for LoadingSpinner component
 */
export function LoadingSpinnerExamples() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Small</h3>
        <LoadingSpinner size="sm" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Medium (default)</h3>
        <LoadingSpinner size="md" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Large</h3>
        <LoadingSpinner size="lg" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Extra Large</h3>
        <LoadingSpinner size="xl" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">With custom className</h3>
        <LoadingSpinner className="text-blue-500" />
      </div>

      <div className="bg-dark-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-4">In a centered container</h3>
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    </div>
  )
}
