import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()

  // Show loading spinner while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-forge-400 animate-spin mx-auto" />
          <p className="text-dark-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to connect page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/connect" replace />
  }

  // Render children if authenticated
  return <>{children}</>
}
