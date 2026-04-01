import { describe, it, expect, vi } from 'vitest'
import { validateAudioMiddleware } from './validateAudio'
import type { Request, Response } from 'express'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, default: { ...actual, unlink: vi.fn() } }
})

const makeReq = (file?: { path: string }) => ({ file }) as unknown as Request
const makeRes = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
  return res as unknown as Response
}

describe('validateAudioMiddleware', () => {
  it('calls next when file is valid audio', async () => {
    const validator = vi.fn().mockResolvedValue(true)
    const next = vi.fn()

    await validateAudioMiddleware(validator)(makeReq({ path: '/tmp/x.mp3' }), makeRes(), next)

    expect(validator).toHaveBeenCalledWith('/tmp/x.mp3')
    expect(next).toHaveBeenCalled()
  })

  it('returns 400 when file is not valid audio', async () => {
    const validator = vi.fn().mockResolvedValue(false)
    const res = makeRes()
    const next = vi.fn()

    await validateAudioMiddleware(validator)(makeReq({ path: '/tmp/x.exe' }), res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }))
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when no file is present', async () => {
    const validator = vi.fn()
    const next = vi.fn()

    await validateAudioMiddleware(validator)(makeReq(), makeRes(), next)

    expect(validator).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
