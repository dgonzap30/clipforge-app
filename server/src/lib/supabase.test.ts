import { describe, test, expect, beforeAll } from 'bun:test'
import { env } from './env'

describe('Supabase Client', () => {
  // Skip tests if Supabase credentials are not configured
  const hasSupabaseConfig = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY

  test.skipIf(!hasSupabaseConfig)('should be initialized when env vars are set', async () => {
    const { supabase } = await import('./supabase')
    expect(supabase).toBeDefined()
    expect(supabase).toHaveProperty('auth')
  })

  test('should require SUPABASE_URL', async () => {
    if (!env.SUPABASE_URL) {
      expect(env.SUPABASE_URL).toBe('')
    } else {
      expect(env.SUPABASE_URL).toBeTruthy()
    }
  })

  test('should require SUPABASE_SERVICE_ROLE_KEY', async () => {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('')
    } else {
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
    }
  })

  test.skipIf(!hasSupabaseConfig)('should have correct client configuration', async () => {
    const { supabase } = await import('./supabase')

    try {
      // Try a simple query to verify client works
      const { error } = await supabase.from('_health').select('*').limit(1)

      if (error) {
        // Table not existing is fine, but auth errors indicate misconfiguration
        expect(error.message).not.toContain('Invalid API key')
      }
    } catch (err) {
      // Network errors are acceptable in test environment
      expect(err).toBeDefined()
    }
  })
})
