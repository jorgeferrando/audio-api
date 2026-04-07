import { describe, it, expect, vi } from 'vitest'
import { correlationId } from './correlationId'
import type { Request, Response, NextFunction } from 'express'

function makeReqRes(requestId?: string) {
  const req = {
    headers: requestId ? { 'x-request-id': requestId } : {},
  } as unknown as Request

  const res = {
    setHeader: vi.fn(),
  } as unknown as Response

  const next: NextFunction = vi.fn()

  return { req, res, next }
}

describe('correlationId middleware', () => {
  const middleware = correlationId()

  it('generates a UUID when X-Request-Id header is absent', () => {
    const { req, res, next } = makeReqRes()
    middleware(req, res, next)

    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.correlationId)
    expect(next).toHaveBeenCalled()
  })

  it('reuses the X-Request-Id header when present', () => {
    const { req, res, next } = makeReqRes('existing-id-123')
    middleware(req, res, next)

    expect(req.correlationId).toBe('existing-id-123')
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id-123')
  })
})
