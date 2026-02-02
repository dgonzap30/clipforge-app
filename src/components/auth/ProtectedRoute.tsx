import { ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/connect', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-forge-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
