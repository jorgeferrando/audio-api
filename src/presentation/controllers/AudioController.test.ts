import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'stream'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    default: {
      ...actual,
      createReadStream: vi.fn().mockReturnValue(Readable.from(Buffer.from('audio'))),
      unlinkSync: vi.fn(),
    },
  }
})

import { AudioController } from './AudioController'
import { AudioEffect } from '@domain/job/ProcessingJob'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import { JobStatus } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'
import type { IFileStorage } from '@application/storage/IFileStorage'
import { ok, err } from '@shared/Result'
import { ValidationError, AppError, StorageError } from '@shared/AppError'
import type { Request, Response, NextFunction } from 'express'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeUploadUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok({ audioTrackId: 'track-1', jobId: 'job-1' })),
})

const makeGetStatusUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok({
    audioTrackId: 'track-1', filename: 'song.mp3', mimeType: 'audio/mpeg',
    sizeInBytes: 1024, status: AudioTrackStatus.PENDING, downloadReady: false,
    createdAt: new Date(),
    job: { jobId: 'job-1', effect: AudioEffect.NORMALIZE, status: JobStatus.PENDING },
  })),
})

const makeDownloadUseCase = () => ({
  execute: vi.fn().mockResolvedValue(err(new AppError('Audio is not ready for download', 'NOT_READY'))),
})

const makeFileStorage = (): IFileStorage => ({
  upload: vi.fn().mockResolvedValue(ok(undefined)),
  download: vi.fn().mockResolvedValue(ok(Readable.from(Buffer.from('audio')))),
  delete: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeReq = (overrides: Partial<Request> = {}) => ({
  body: {}, params: {}, file: undefined, ...overrides,
}) as unknown as Request

const makeRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(), emit: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AudioController', () => {
  let uploadUseCase: ReturnType<typeof makeUploadUseCase>
  let getStatusUseCase: ReturnType<typeof makeGetStatusUseCase>
  let downloadUseCase: ReturnType<typeof makeDownloadUseCase>
  let fileStorage: IFileStorage
  let controller: AudioController
  let next: NextFunction

  beforeEach(() => {
    uploadUseCase    = makeUploadUseCase()
    getStatusUseCase = makeGetStatusUseCase()
    downloadUseCase  = makeDownloadUseCase()
    fileStorage      = makeFileStorage()
    controller       = new AudioController(
      uploadUseCase as unknown as UploadAudioUseCase,
      getStatusUseCase as unknown as GetAudioStatusUseCase,
      downloadUseCase as unknown as DownloadAudioUseCase,
      fileStorage,
    )
    next = vi.fn()
  })

  describe('upload()', () => {
    const validFile = {
      originalname: 'song.mp3', mimetype: 'audio/mpeg',
      size: 1024, path: '/tmp/upload-abc.mp3',
    }

    it('uploads file to storage then returns 202', async () => {
      const req = makeReq({ file: validFile as any, body: { effect: 'NORMALIZE' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(fileStorage.upload).toHaveBeenCalledOnce()
      expect(res.status).toHaveBeenCalledWith(202)
      expect(res.json).toHaveBeenCalledWith({ audioTrackId: 'track-1', jobId: 'job-1' })
    })

    it('passes storage key (not local path) to the use case', async () => {
      const req = makeReq({ file: validFile as any, body: { effect: 'REVERB' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      const callArgs = uploadUseCase.execute.mock.calls[0][0]
      expect(callArgs.filePath).toMatch(/^originals\//)
      expect(callArgs.filePath).toMatch(/\.mp3$/)
    })

    it('calls next with StorageError when upload to storage fails', async () => {
      vi.mocked(fileStorage.upload).mockResolvedValue(err(new StorageError('connection refused')))
      const req = makeReq({ file: validFile as any, body: { effect: 'NORMALIZE' } })
      const res = makeRes()

      await controller.upload(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(StorageError))
      expect(uploadUseCase.execute).not.toHaveBeenCalled()
    })

    it('calls next with ValidationError when no file uploaded', async () => {
      await controller.upload(makeReq({ body: { effect: 'NORMALIZE' } }), makeRes(), next)
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError))
    })

    it('calls next with ValidationError for invalid effect', async () => {
      await controller.upload(makeReq({ file: validFile as any, body: { effect: 'X' } }), makeRes(), next)
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError))
    })
  })

  describe('getStatus()', () => {
    it('returns 200 with the status DTO', async () => {
      const res = makeRes()
      await controller.getStatus(makeReq({ params: { id: 'track-1' } }), res, next)
      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('download()', () => {
    it('calls next with NOT_READY when track is not processed yet', async () => {
      await controller.download(makeReq({ params: { id: 'track-1' } }), makeRes(), next)
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_READY' }))
    })

    it('streams file from storage when track is ready', async () => {
      downloadUseCase.execute.mockResolvedValue(ok({
        filePath: 'processed/abc.mp3', filename: 'song.mp3', mimeType: 'audio/mpeg',
      }))
      const res = makeRes()
      await controller.download(makeReq({ params: { id: 'track-1' } }), res, next)

      expect(fileStorage.download).toHaveBeenCalledWith('processed/abc.mp3')
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg')
    })

    it('calls next with StorageError when download from storage fails', async () => {
      downloadUseCase.execute.mockResolvedValue(ok({
        filePath: 'processed/abc.mp3', filename: 'song.mp3', mimeType: 'audio/mpeg',
      }))
      vi.mocked(fileStorage.download).mockResolvedValue(err(new StorageError('not found')))

      await controller.download(makeReq({ params: { id: 'track-1' } }), makeRes(), next)
      expect(next).toHaveBeenCalledWith(expect.any(StorageError))
    })
  })
})
