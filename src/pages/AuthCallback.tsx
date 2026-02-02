import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL params
        const params = new URLSearchParams(window.location.search)
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')

        if (errorParam) {
          setError(errorDescription || errorParam)
          // Redirect to connect page after showing error
          setTimeout(() => navigate('/connect'), 3000)
          return
        }

        // Check for auth success parameter (for cookie-based flow)
        const authSuccess = params.get('auth')
        const user = params.get('user')

        if (authSuccess === 'success') {
          console.log('Authentication successful for user:', user)
          // Redirect to dashboard on success
          navigate('/')
          return
        }

        // If using Supabase Auth with hash fragments
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken) {
          // Supabase Auth flow - session will be handled by Supabase client
          console.log('Supabase Auth callback received')
          navigate('/')
          return
        }

        // If no recognizable auth params, redirect to connect page
        setError('No authentication data received')
        setTimeout(() => navigate('/connect'), 2000)
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setTimeout(() => navigate('/connect'), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg font-semibold">Authentication Failed</div>
          <p className="text-dark-400">{error}</p>
          <p className="text-dark-500 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-forge-400 animate-spin mx-auto" />
        <p className="text-dark-400">Completing authentication...</p>
      </div>
    </div>
  )
}
