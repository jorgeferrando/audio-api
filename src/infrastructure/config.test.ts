import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig } from './config'

const REQUIRED_ENV = {
  MONGODB_URI:      'mongodb://localhost:27017/test',
  REDIS_URL:        'redis://localhost:6379',
  RABBITMQ_URL:     'amqp://guest:guest@localhost:5672',
  MINIO_ENDPOINT:   'localhost',
  MINIO_ACCESS_KEY: 'access',
  MINIO_SECRET_KEY: 'secret',
}

describe('loadConfig', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => { originalEnv = { ...process.env } })
  afterEach(() => { process.env = originalEnv })

  function setEnv(overrides: Record<string, string | undefined> = {}): void {
    // Clear all config keys first
    for (const key of Object.keys(REQUIRED_ENV)) delete process.env[key]
    delete process.env.NODE_ENV
    delete process.env.PORT
    delete process.env.MINIO_PORT
    delete process.env.MINIO_BUCKET
    delete process.env.API_KEY
    delete process.env.SHUTDOWN_TIMEOUT_MS

    Object.assign(process.env, REQUIRED_ENV, overrides)
  }

  it('parses valid configuration with defaults', () => {
    setEnv()
    const config = loadConfig()

    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/test')
    expect(config.NODE_ENV).toBe('development')
    expect(config.PORT).toBe(3000)
    expect(config.MINIO_PORT).toBe(9000)
    expect(config.MINIO_BUCKET).toBe('audio-api')
    expect(config.API_KEY).toBeUndefined()
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(25_000)
  })

  it('respects explicit values over defaults', () => {
    setEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      MINIO_PORT: '9001',
      MINIO_BUCKET: 'custom-bucket',
      API_KEY: 'my-key',
      SHUTDOWN_TIMEOUT_MS: '30000',
    })
    const config = loadConfig()

    expect(config.NODE_ENV).toBe('production')
    expect(config.PORT).toBe(8080)
    expect(config.MINIO_PORT).toBe(9001)
    expect(config.MINIO_BUCKET).toBe('custom-bucket')
    expect(config.API_KEY).toBe('my-key')
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(30_000)
  })

  it('coerces MINIO_PORT string to number', () => {
    setEnv({ MINIO_PORT: '4567' })
    expect(loadConfig().MINIO_PORT).toBe(4567)
  })

  it('throws when MONGODB_URI is missing', () => {
    setEnv()
    delete process.env.MONGODB_URI
    expect(() => loadConfig()).toThrow()
  })

  it('throws when REDIS_URL is missing', () => {
    setEnv()
    delete process.env.REDIS_URL
    expect(() => loadConfig()).toThrow()
  })

  it('throws when RABBITMQ_URL is missing', () => {
    setEnv()
    delete process.env.RABBITMQ_URL
    expect(() => loadConfig()).toThrow()
  })

  it('throws when MINIO_ACCESS_KEY is missing', () => {
    setEnv()
    delete process.env.MINIO_ACCESS_KEY
    expect(() => loadConfig()).toThrow()
  })

  it('throws when MINIO_SECRET_KEY is missing', () => {
    setEnv()
    delete process.env.MINIO_SECRET_KEY
    expect(() => loadConfig()).toThrow()
  })

  it('rejects invalid NODE_ENV', () => {
    setEnv({ NODE_ENV: 'staging' })
    expect(() => loadConfig()).toThrow()
  })
})
