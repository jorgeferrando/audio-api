import { describe, it, expect } from 'vitest'
import { STATUS, EFFECTS, POLL_INTERVAL_MS } from './constants.js'

describe('constants', () => {
  it('STATUS has all expected values', () => {
    expect(STATUS.PENDING).toBe('PENDING')
    expect(STATUS.PROCESSING).toBe('PROCESSING')
    expect(STATUS.READY).toBe('READY')
    expect(STATUS.FAILED).toBe('FAILED')
    expect(STATUS.COMPLETED).toBe('COMPLETED')
  })

  it('EFFECTS has 5 entries with value and label', () => {
    expect(EFFECTS).toHaveLength(5)
    for (const effect of EFFECTS) {
      expect(effect).toHaveProperty('value')
      expect(effect).toHaveProperty('label')
      expect(typeof effect.value).toBe('string')
      expect(typeof effect.label).toBe('string')
    }
  })

  it('POLL_INTERVAL_MS is a positive number', () => {
    expect(POLL_INTERVAL_MS).toBeGreaterThan(0)
  })
})
