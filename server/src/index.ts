import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { validateEnv } from './lib/env'
import { authRoutes } from './routes/auth'
import { vodsRoutes } from './routes/vods'
import { clipsRoutes } from './routes/clips'
import { jobsRoutes } from './routes/jobs'
import { platformsRoutes } from './routes/platforms'
import { vodWorker as _vodWorker, closeWorker } from './queue/worker'
import { redisConnection } from './queue/connection'

// Validate environment variables on startup
validateEnv()

// Use Bun's shell for concise cleanup
import { $ } from 'bun'
import { existsSync } from 'fs'

// Startup cleanup of temporary files
async function cleanupTempFiles() {
  const tempDir = '/tmp/clipforge'
  if (existsSync(tempDir)) {
    console.log('🧹 Cleaning up temporary files in', tempDir)
    try {
      // Remove all contents but keep the directory
      await $`rm -rf ${tempDir}/*`.quiet()
      console.log('✅ Temporary files cleaned')
    } catch (err) {
      console.error('⚠️ Failed to clean temp files:', err)
    }
  } else {
    // Ensure directory exists
    await $`mkdir -p ${tempDir}`.quiet()
  }
}

// Clean on startup
cleanupTempFiles().catch(console.error)

const app = new Hono()

// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: corsOrigins,
  credentials: true,
}))

// Health check
app.get('/', (c) => c.json({
  status: 'ok',
  service: 'clipforge-api',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
}))

app.get('/health', (c) => c.json({ status: 'healthy' }))

// Routes
app.route('/api/auth', authRoutes)
app.route('/api/vods', vodsRoutes)
app.route('/api/clips', clipsRoutes)
app.route('/api/jobs', jobsRoutes)
app.route('/api/platforms', platformsRoutes)

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({
    error: 'Internal server error',
    message: err.message,
  }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Start server
const port = process.env.PORT || 8787

console.log(`🔥 ClipForge API running on http://localhost:${port}`)

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`)

  try {
    // Stop accepting new jobs
    await closeWorker()

    // Close Redis connection
    await redisConnection.quit()

    console.log('Shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

export default {
  port,
  fetch: app.fetch,
}
