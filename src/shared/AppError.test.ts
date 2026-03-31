import { describe, it, expect } from 'vitest'
import { AppError, NotFoundError, ValidationError, ConflictError } from '@shared/AppError'

describe('AppError', () => {
  it('holds message and code', () => {
    const error = new AppError('something went wrong', 'GENERIC_ERROR')
    expect(error.message).toBe('something went wrong')
    expect(error.code).toBe('GENERIC_ERROR')
  })

  it('is an instance of Error', () => {
    const error = new AppError('oops', 'GENERIC_ERROR')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('NotFoundError', () => {
  it('has correct code and message', () => {
    const error = new NotFoundError('AudioTrack', 'abc-123')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe("AudioTrack 'abc-123' not found")
  })

  it('is an instance of AppError', () => {
    expect(new NotFoundError('AudioTrack', 'abc-123')).toBeInstanceOf(AppError)
  })
})

describe('ValidationError', () => {
  it('has correct code and message', () => {
    const error = new ValidationError('duration must be positive')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('duration must be positive')
  })

  it('is an instance of AppError', () => {
    expect(new ValidationError('bad input')).toBeInstanceOf(AppError)
  })
})

describe('ConflictError', () => {
  it('has correct code and message', () => {
    const error = new ConflictError('AudioTrack', 'abc-123')
    expect(error.code).toBe('CONFLICT')
    expect(error.message).toBe("AudioTrack 'abc-123' already exists")
  })

  it('is an instance of AppError', () => {
    expect(new ConflictError('AudioTrack', 'abc-123')).toBeInstanceOf(AppError)
  })
})
