import { $ } from 'bun'
import { existsSync } from 'fs'

import { validateEnv } from './lib/env'
import { vodWorker, closeWorker } from './queue/worker'
import { redisConnection } from './queue/connection'

validateEnv()

async function ensureTempDir() {
  const tempDir = '/tmp/clipforge'
  if (existsSync(tempDir)) {
    console.log('🧹 Cleaning up temporary files in', tempDir)
    try {
      await $`rm -rf ${tempDir}/*`.quiet()
    } catch (err) {
      console.error('⚠️ Failed to clean temp files:', err)
    }
  } else {
    await $`mkdir -p ${tempDir}`.quiet()
  }
}

await ensureTempDir()

console.log(`🛠  ClipForge worker started (pid ${process.pid})`)

// Reference the worker so the module side effects stick.
void vodWorker

async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, shutting worker down...`)
  try {
    await closeWorker()
    await redisConnection.quit()
    console.log('Worker shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('Error during worker shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
