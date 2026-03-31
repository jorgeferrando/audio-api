import { describe } from 'vitest'
import { ConsoleLogger } from '@infrastructure/logger/ConsoleLogger'
import { testLoggerContract } from './loggerContract'

describe('ConsoleLogger', () => {
  testLoggerContract(() => new ConsoleLogger())
})
