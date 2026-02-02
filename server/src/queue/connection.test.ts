import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createRedisConnection, redisConnection } from './connection'
import IORedis from 'ioredis'

describe('Redis Connection Factory', () => {
  let connection: IORedis

  afterEach(() => {
    if (connection) {
      connection.disconnect()
    }
  })

  test('createRedisConnection returns IORedis instance', () => {
    connection = createRedisConnection() as IORedis
    expect(connection).toBeInstanceOf(IORedis)
  })

  test('connection has required BullMQ options', () => {
    connection = createRedisConnection() as IORedis
    expect(connection.options.maxRetriesPerRequest).toBe(null)
    expect(connection.options.enableReadyCheck).toBe(false)
  })

  test('connection uses REDIS_URL from env', () => {
    connection = createRedisConnection() as IORedis
    // Default URL is redis://localhost:6379
    expect(connection.options.host).toBe('localhost')
    expect(connection.options.port).toBe(6379)
  })

  test('connection has retry strategy', () => {
    connection = createRedisConnection() as IORedis
    expect(connection.options.retryStrategy).toBeDefined()

    if (connection.options.retryStrategy) {
      // Test exponential backoff
      const delay1 = connection.options.retryStrategy(1)
      const delay2 = connection.options.retryStrategy(2)
      const delay100 = connection.options.retryStrategy(100)

      expect(delay1).toBe(50)
      expect(delay2).toBe(100)
      expect(delay100).toBe(3000) // Max delay
    }
  })

  test('singleton connection is exported', () => {
    expect(redisConnection).toBeInstanceOf(IORedis)
  })

  test('connection parses default Redis URL correctly', () => {
    connection = createRedisConnection() as IORedis

    // With default REDIS_URL of 'redis://localhost:6379'
    expect(connection.options.host).toBe('localhost')
    expect(connection.options.port).toBe(6379)
    expect(connection.options.db).toBe(0)
  })
})
