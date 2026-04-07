import { describe, it, expect } from 'vitest'
import { isValidUUID } from './isValidUUID'

describe('isValidUUID', () => {
  it('returns true for a valid v4 UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('returns false for an empty string', () => {
    expect(isValidUUID('')).toBe(false)
  })

  it('returns false for a random string', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
  })

  it('returns false for SQL injection', () => {
    expect(isValidUUID("'; DROP TABLE audio;--")).toBe(false)
  })

  it('returns false for a UUID without dashes', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })
})
