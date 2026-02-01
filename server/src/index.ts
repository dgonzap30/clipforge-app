import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { authRoutes } from './routes/auth'
import { vodsRoutes } from './routes/vods'
import { clipsRoutes } from './routes/clips'
import { jobsRoutes } from './routes/jobs'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
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

export default {
  port,
  fetch: app.fetch,
}
