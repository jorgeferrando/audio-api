import { describe, it, expect, vi } from 'vitest'
import { Readable, PassThrough } from 'stream'
import type { Request, Response } from 'express'
import { busboyUpload } from './busboyUpload'

/**
 * Builds a minimal multipart/form-data body from parts.
 * Each part is either { name, value } (field) or { name, filename, type, data } (file).
 */
function buildMultipart(boundary: string, parts: Array<
  { name: string; value: string } |
  { name: string; filename: string; type: string; data: Buffer }
>): Buffer {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if ('value' in part) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`
      ))
    } else {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
        `Content-Type: ${part.type}\r\n\r\n`
      ))
      chunks.push(part.data)
      chunks.push(Buffer.from('\r\n'))
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

function makeWavHeader(): Buffer {
  const buf = Buffer.alloc(44) // minimal WAV header
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)   // PCM
  buf.writeUInt16LE(1, 22)   // mono
  buf.writeUInt32LE(44100, 24)
  buf.writeUInt32LE(88200, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(0, 40)
  return buf
}

function makeReq(boundary: string, body: Buffer): Request {
  const stream = new PassThrough()
  stream.end(body)

  return Object.assign(stream, {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    },
    // Express request stubs
    body: {},
    params: {},
    query: {},
    uploadedFile: undefined,
  }) as unknown as Request
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    headersSent: false,
  }
  return res as typeof res & Response
}

describe('busboyUpload', () => {
  const middleware = busboyUpload()

  describe('happy path', () => {
    it('populates req.uploadedFile with stream, metadata, and form fields', async () => {
      const boundary = '----TestBoundary'
      const wavData = makeWavHeader()
      const body = buildMultipart(boundary, [
        { name: 'effect', value: 'NORMALIZE' },
        { name: 'file', filename: 'song.wav', type: 'audio/wav', data: wavData },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        res.status.mockImplementation(() => { resolve(); return res })
        middleware(req, res, next)
      })

      expect(next).toHaveBeenCalledOnce()
      expect(next).toHaveBeenCalledWith() // no error

      const uploaded = (req as any).uploadedFile
      expect(uploaded).toBeDefined()
      expect(uploaded.filename).toBe('song.wav')
      expect(uploaded.mimeType).toBe('audio/wav')
      expect(uploaded.stream).toBeInstanceOf(Readable)

      // Form fields populated on req.body
      expect((req as any).body.effect).toBe('NORMALIZE')
    })
  })

  describe('magic bytes validation — early fail', () => {
    it('rejects a PDF file with 400 VALIDATION_ERROR', async () => {
      const boundary = '----TestBoundary'
      const pdfData = Buffer.from('%PDF-1.4 some pdf content here')
      const body = buildMultipart(boundary, [
        { name: 'file', filename: 'evil.pdf', type: 'audio/mpeg', data: pdfData },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        res.json.mockImplementation(() => { resolve(); return res })
        middleware(req, res, next)
      })

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'VALIDATION_ERROR',
        message: 'file does not contain valid audio data',
      }))
    })

    it('rejects a text file disguised as audio', async () => {
      const boundary = '----TestBoundary'
      const txtData = Buffer.from('Hello world, this is not audio!')
      const body = buildMultipart(boundary, [
        { name: 'file', filename: 'fake.mp3', type: 'audio/mpeg', data: txtData },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        res.json.mockImplementation(() => { resolve(); return res })
        middleware(req, res, next)
      })

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('MIME type validation', () => {
    it('rejects file with non-audio MIME type', async () => {
      const boundary = '----TestBoundary'
      const wavData = makeWavHeader()
      const body = buildMultipart(boundary, [
        { name: 'file', filename: 'song.wav', type: 'application/pdf', data: wavData },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        res.json.mockImplementation(() => { resolve(); return res })
        middleware(req, res, next)
      })

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'VALIDATION_ERROR',
      }))
    })
  })

  describe('no file in request', () => {
    it('calls next without populating req.uploadedFile', async () => {
      const boundary = '----TestBoundary'
      const body = buildMultipart(boundary, [
        { name: 'effect', value: 'REVERB' },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        middleware(req, res, next)
      })

      expect(next).toHaveBeenCalledOnce()
      expect((req as any).uploadedFile).toBeUndefined()
      expect((req as any).body.effect).toBe('REVERB')
    })
  })

  describe('file size limit', () => {
    it('rejects files exceeding the size limit', async () => {
      const boundary = '----TestBoundary'
      // Create a WAV header followed by data that exceeds the limit indication
      // We test with a small custom limit via the factory parameter
      const smallLimitMiddleware = busboyUpload({ maxFileSize: 100 })

      const wavData = Buffer.alloc(200)
      makeWavHeader().copy(wavData) // valid WAV header at start
      const body = buildMultipart(boundary, [
        { name: 'file', filename: 'big.wav', type: 'audio/wav', data: wavData },
      ])

      const req = makeReq(boundary, body)
      const res = makeRes()
      const next = vi.fn()

      await new Promise<void>((resolve) => {
        next.mockImplementation(() => resolve())
        res.json.mockImplementation(() => { resolve(); return res })
        smallLimitMiddleware(req, res, next)
      })

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'UPLOAD_ERROR',
        message: expect.stringContaining('50MB') as string,
      }))
    })
  })
})
