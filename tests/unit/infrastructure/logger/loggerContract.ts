import { describe, it, expect } from 'vitest'
import type { ILogger } from '@shared/ILogger'

export function testLoggerContract(createLogger: () => ILogger): void {
  describe('ILogger contract', () => {
    it('exposes info, warn, error, debug methods', () => {
      const logger = createLogger()
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.debug).toBe('function')
    })

    it('does not throw when logging error with metadata', () => {
      const logger = createLogger()
      expect(() =>
        logger.error('something failed', { error: new Error('boom'), id: '123' })
      ).not.toThrow()
    })

    it('does not throw when logging info with metadata', () => {
      const logger = createLogger()
      expect(() =>
        logger.info('audio uploaded', { audioId: 'abc', size: 1024 })
      ).not.toThrow()
    })

    it('does not throw when logging without metadata', () => {
      const logger = createLogger()
      expect(() => logger.warn('simple warning')).not.toThrow()
      expect(() => logger.debug('simple debug')).not.toThrow()
    })
  })
}
