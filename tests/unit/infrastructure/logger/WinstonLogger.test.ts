import { describe, it, expect } from 'vitest'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { testLoggerContract } from './loggerContract'

describe('WinstonLogger', () => {
  testLoggerContract(() => new WinstonLogger('development'))

  describe('specific behavior', () => {
    it('uses debug level in development', () => {
      const logger = new WinstonLogger('development')
      expect(logger.level).toBe('debug')
    })

    it('uses info level in production', () => {
      const logger = new WinstonLogger('production')
      expect(logger.level).toBe('info')
    })
  })
})
