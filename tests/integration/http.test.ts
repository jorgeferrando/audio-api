import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { NotFoundError, DatabaseError } from '@shared/AppError'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import { JobStatus } from '@domain/job/ProcessingJob'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

const statusDto = {
  audioTrackId: 'track-1',
  filename:     'song.mp3',
  mimeType:     'audio/mpeg',
  sizeInBytes:  1024,
  status:       AudioTrackStatus.PENDING,
  createdAt:    new Date('2024-01-01'),
  job: {
    jobId:   'job-1',
    effect:  AudioEffect.NORMALIZE,
    status:  JobStatus.PENDING,
  },
}

const makeUploadUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok({ audioTrackId: 'track-1', jobId: 'job-1' })),
})

const makeGetStatusUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok(statusDto)),
})

/**
 * Build a minimal Express app for testing GET routes and error handling.
 * Upload tests are done in controller unit tests because they need
 * multer + real file — the HTTP integration tests focus on the response
 * pipeline (routing → controller → errorHandler).
 */
function buildApp(getStatusOverride?: ReturnType<typeof makeGetStatusUseCase>) {
  const upload    = makeUploadUseCase()
  const getStatus = getStatusOverride ?? makeGetStatusUseCase()
  const controller = new AudioController(
    upload as unknown as UploadAudioUseCase,
    getStatus as unknown as GetAudioStatusUseCase,
  )
  const logger = makeLogger()
  const app = express()
  app.use(express.json())
  app.use('/api/v1/health', healthRoutes())
  app.use('/api/v1/audio',  audioRoutes(controller))
  app.use(errorHandler(logger))
  return app
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HTTP Integration', () => {

  describe('GET /api/v1/health', () => {
    it('returns 200 with { status: "ok" }', async () => {
      const res = await request(buildApp()).get('/api/v1/health')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok' })
    })
  })

  describe('GET /api/v1/audio/:id', () => {
    it('returns 200 with the status DTO', async () => {
      const res = await request(buildApp()).get('/api/v1/audio/track-1')
      expect(res.status).toBe(200)
      expect(res.body.audioTrackId).toBe('track-1')
      expect(res.body.job.effect).toBe('NORMALIZE')
    })

    it('returns 404 when audio track does not exist', async () => {
      const getStatus = makeGetStatusUseCase()
      getStatus.execute.mockResolvedValue(err(new NotFoundError('AudioTrack', 'unknown-id')))

      const res = await request(buildApp(getStatus)).get('/api/v1/audio/unknown-id')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('returns 503 when database is unavailable', async () => {
      const getStatus = makeGetStatusUseCase()
      getStatus.execute.mockResolvedValue(err(new DatabaseError('timeout')))

      const res = await request(buildApp(getStatus)).get('/api/v1/audio/track-1')
      expect(res.status).toBe(503)
      expect(res.body.error).toBe('DATABASE_ERROR')
    })
  })

  describe('GET /api/v1/audio/:id/download', () => {
    it('returns 409 when track is not ready', async () => {
      const res = await request(buildApp()).get('/api/v1/audio/track-1/download')
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('NOT_READY')
    })
  })

  describe('Unknown routes', () => {
    it('returns 404 for unmatched paths', async () => {
      const res = await request(buildApp()).get('/api/v1/nonexistent')
      expect(res.status).toBe(404)
    })
  })
})
