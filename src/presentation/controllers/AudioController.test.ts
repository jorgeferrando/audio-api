import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioController } from './AudioController'
import { AudioEffect } from '@domain/job/ProcessingJob'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import { JobStatus } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import { ok, err } from '@shared/Result'
import { ValidationError, NotFoundError } from '@shared/AppError'
import type { Request, Response, NextFunction } from 'express'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeUploadUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok({ audioTrackId: 'track-1', jobId: 'job-1' })),
})

const makeGetStatusUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok({
    audioTrackId:    'track-1',
    filename:        'song.mp3',
    mimeType:        'audio/mpeg',
    sizeInBytes:     1024,
    status:          AudioTrackStatus.PENDING,
    createdAt:       new Date(),
    job: {
      jobId:   'job-1',
      effect:  AudioEffect.NORMALIZE,
      status:  JobStatus.PENDING,
    },
  })),
})

const makeReq = (overrides: Partial<Request> = {}) => ({
  body:   {},
  params: {},
  file:   undefined,
  ...overrides,
}) as unknown as Request

const makeRes = () => {
  const res = {
    status:    vi.fn().mockReturnThis(),
    json:      vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AudioController', () => {
  let uploadUseCase: ReturnType<typeof makeUploadUseCase>
  let getStatusUseCase: ReturnType<typeof makeGetStatusUseCase>
  let controller: AudioController
  let next: NextFunction

  beforeEach(() => {
    uploadUseCase    = makeUploadUseCase()
    getStatusUseCase = makeGetStatusUseCase()
    controller       = new AudioController(
      uploadUseCase as unknown as UploadAudioUseCase,
      getStatusUseCase as unknown as GetAudioStatusUseCase,
    )
    next = vi.fn()
  })

  // ─── upload ────────────────────────────────────────────────────────────

  describe('upload()', () => {
    const validFile = {
      originalname: 'song.mp3',
      mimetype:     'audio/mpeg',
      size:         1024,
      path:         '/uploads/originals/abc.mp3',
    }

    it('returns 202 with audioTrackId and jobId on success', async () => {
      const req = makeReq({ file: validFile as any, body: { effect: 'NORMALIZE' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(res.status).toHaveBeenCalledWith(202)
      expect(res.json).toHaveBeenCalledWith({
        audioTrackId: 'track-1',
        jobId:        'job-1',
      })
    })

    it('calls next with ValidationError when no file uploaded', async () => {
      const req = makeReq({ body: { effect: 'NORMALIZE' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError))
    })

    it('calls next with ValidationError for invalid effect', async () => {
      const req = makeReq({ file: validFile as any, body: { effect: 'INVALID' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError))
    })

    it('passes file metadata from req.file to the use case', async () => {
      const req = makeReq({ file: validFile as any, body: { effect: 'REVERB' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(uploadUseCase.execute).toHaveBeenCalledWith({
        filename:    'song.mp3',
        mimeType:    'audio/mpeg',
        sizeInBytes: 1024,
        effect:      AudioEffect.REVERB,
        filePath:    '/uploads/originals/abc.mp3',
      })
    })
  })

  // ─── getStatus ─────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns 200 with the status DTO', async () => {
      const req = makeReq({ params: { id: 'track-1' } })
      const res = makeRes()

      await controller.getStatus(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ audioTrackId: 'track-1' })
      )
    })

    it('calls next with NotFoundError when track does not exist', async () => {
      getStatusUseCase.execute.mockResolvedValue(
        err(new NotFoundError('AudioTrack', 'unknown'))
      )
      const req = makeReq({ params: { id: 'unknown' } })
      const res = makeRes()

      await controller.getStatus(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))
    })
  })

  // ─── download ──────────────────────────────────────────────────────────

  describe('download()', () => {
    it('calls next with NOT_READY if track is not ready', async () => {
      const req = makeReq({ params: { id: 'track-1' } })
      const res = makeRes()

      await controller.download(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_READY' }))
    })

    it('calls next with NotFoundError if track does not exist', async () => {
      getStatusUseCase.execute.mockResolvedValue(
        err(new NotFoundError('AudioTrack', 'unknown'))
      )
      const req = makeReq({ params: { id: 'unknown' } })
      const res = makeRes()

      await controller.download(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))
    })
  })
})
