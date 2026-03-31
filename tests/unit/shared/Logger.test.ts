import { describe, it, expect, vi, afterEach } from 'vitest'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('WinstonLogger', () => {
  it('exposes info, warn, error, debug methods', () => {
    const logger = new WinstonLogger('development')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('does not throw when logging an error with metadata', () => {
    const logger = new WinstonLogger('development')
    expect(() =>
      logger.error('something failed', { error: new Error('boom'), id: '123' })
    ).not.toThrow()
  })

  it('does not throw when logging info with metadata', () => {
    const logger = new WinstonLogger('development')
    expect(() =>
      logger.info('audio uploaded', { audioId: 'abc', size: 1024 })
    ).not.toThrow()
  })

  it('uses debug level in development', () => {
    const logger = new WinstonLogger('development')
    expect(logger.level).toBe('debug')
  })

  it('uses info level in production', () => {
    const logger = new WinstonLogger('production')
    expect(logger.level).toBe('info')
  })
})
