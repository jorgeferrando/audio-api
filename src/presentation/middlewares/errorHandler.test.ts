import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from './errorHandler'
import { AppError, ValidationError, NotFoundError, DatabaseError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import type { Request, Response, NextFunction } from 'express'

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

const makeRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

describe('errorHandler', () => {
  const req  = {} as Request
  const next = vi.fn() as NextFunction
  const logger = makeLogger()
  const handler = errorHandler(logger)

  it('maps ValidationError to 400', () => {
    const res = makeRes()
    handler(new ValidationError('bad input'), req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'bad input',
    })
  })

  it('maps NotFoundError to 404', () => {
    const res = makeRes()
    handler(new NotFoundError('AudioTrack', 'abc'), req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('maps DatabaseError to 503', () => {
    const res = makeRes()
    handler(new DatabaseError('timeout'), req, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('maps unknown AppError codes to 500', () => {
    const res = makeRes()
    handler(new AppError('something', 'UNKNOWN_CODE'), req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('maps generic Error with message to 400', () => {
    const res = makeRes()
    handler(new Error('Invalid audio type: application/pdf'), req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Invalid audio type: application/pdf',
    })
  })

  it('maps non-Error objects to 500 without leaking internals', () => {
    const res = makeRes()
    handler({ weird: 'object' }, req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error:   'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
    expect(logger.error).toHaveBeenCalled()
  })
})
