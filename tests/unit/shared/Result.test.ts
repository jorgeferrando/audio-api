import { describe, it, expect } from 'vitest'
import { ok, err, Result } from '@shared/Result'

describe('Result', () => {
  describe('ok', () => {
    it('isOk returns true', () => {
      const result = ok(42)
      expect(result.isOk()).toBe(true)
    })

    it('isErr returns false', () => {
      const result = ok(42)
      expect(result.isErr()).toBe(false)
    })

    it('holds the value', () => {
      const result = ok('hello')
      if (result.isOk()) {
        expect(result.value).toBe('hello')
      }
    })
  })

  describe('err', () => {
    it('isErr returns true', () => {
      const result = err('something went wrong')
      expect(result.isErr()).toBe(true)
    })

    it('isOk returns false', () => {
      const result = err('something went wrong')
      expect(result.isOk()).toBe(false)
    })

    it('holds the error', () => {
      const result = err('not found')
      if (result.isErr()) {
        expect(result.error).toBe('not found')
      }
    })
  })

  describe('type narrowing', () => {
    it('narrows to Ok after isOk check', () => {
      const result: Result<number, string> = ok(10)
      if (result.isOk()) {
        expect(result.value).toBe(10)
      } else {
        throw new Error('should not reach here')
      }
    })

    it('narrows to Err after isErr check', () => {
      const result: Result<number, string> = err('fail')
      if (result.isErr()) {
        expect(result.error).toBe('fail')
      } else {
        throw new Error('should not reach here')
      }
    })
  })
})
