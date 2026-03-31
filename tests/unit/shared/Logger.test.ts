import { describe, it, expect, vi } from 'vitest'
import { logger } from '@shared/logger'

describe('Logger', () => {
  it('exposes info, warn, error methods', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('does not throw when logging an error with metadata', () => {
    expect(() =>
      logger.error('something failed', { error: new Error('boom'), id: '123' })
    ).not.toThrow()
  })

  it('does not throw when logging info with metadata', () => {
    expect(() =>
      logger.info('audio uploaded', { audioId: 'abc', size: 1024 })
    ).not.toThrow()
  })
})
