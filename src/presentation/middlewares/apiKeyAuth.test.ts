import { describe, it, expect, vi } from 'vitest'
import { apiKeyAuth } from './apiKeyAuth'
import type { Request, Response } from 'express'

const makeReq = (apiKey?: string) => ({
  header: vi.fn((name: string) => name === 'x-api-key' ? apiKey : undefined),
}) as unknown as Request

const makeRes = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
  return res as unknown as Response
}

describe('apiKeyAuth', () => {
  it('calls next when API key matches', () => {
    const middleware = apiKeyAuth('secret-123')
    const next = vi.fn()

    middleware(makeReq('secret-123'), makeRes(), next)

    expect(next).toHaveBeenCalled()
  })

  it('returns 401 when API key is missing', () => {
    const middleware = apiKeyAuth('secret-123')
    const res = makeRes()
    const next = vi.fn()

    middleware(makeReq(undefined), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when API key is wrong', () => {
    const middleware = apiKeyAuth('secret-123')
    const res = makeRes()
    const next = vi.fn()

    middleware(makeReq('wrong-key'), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('skips auth when no API key is configured (dev mode)', () => {
    const middleware = apiKeyAuth(undefined)
    const next = vi.fn()

    middleware(makeReq(undefined), makeRes(), next)

    expect(next).toHaveBeenCalled()
  })
})
