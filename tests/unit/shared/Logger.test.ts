import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('Logger', () => {
  it('exposes info, warn, error methods', async () => {
    const { logger } = await import('@shared/logger')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('does not throw when logging an error with metadata', async () => {
    const { logger } = await import('@shared/logger')
    expect(() =>
      logger.error('something failed', { error: new Error('boom'), id: '123' })
    ).not.toThrow()
  })

  it('does not throw when logging info with metadata', async () => {
    const { logger } = await import('@shared/logger')
    expect(() =>
      logger.info('audio uploaded', { audioId: 'abc', size: 1024 })
    ).not.toThrow()
  })

  it('uses debug level in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { logger } = await import('@shared/logger')
    expect(logger.level).toBe('debug')
  })

  it('uses info level in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { logger } = await import('@shared/logger')
    expect(logger.level).toBe('info')
  })
})
