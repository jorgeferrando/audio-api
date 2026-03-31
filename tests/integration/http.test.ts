import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '@infrastructure/http/app'
import { AudioController } from '@presentation/controllers/AudioController'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { NotFoundError, ValidationError, DatabaseError } from '@shared/AppError'
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

// ─── Setup ───────────────────────────────────────────────────────────────────

function buildApp(
  uploadOverride?: ReturnType<typeof makeUploadUseCase>,
  getStatusOverride?: ReturnType<typeof makeGetStatusUseCase>,
) {
  const upload    = uploadOverride ?? makeUploadUseCase()
  const getStatus = getStatusOverride ?? makeGetStatusUseCase()
  const controller = new AudioController(
    upload as unknown as UploadAudioUseCase,
    getStatus as unknown as GetAudioStatusUseCase,
  )
  return createApp(controller, makeLogger())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HTTP Integration', () => {

  // ─── Health ────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns 200 with { status: "ok" }', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/v1/health')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok' })
    })
  })

  // ─── Upload ────────────────────────────────────────────────────────────

  describe('POST /api/v1/audio', () => {
    const validBody = {
      filename:    'song.mp3',
      mimeType:    'audio/mpeg',
      sizeInBytes: 1048576,
      effect:      'NORMALIZE',
    }

    it('returns 202 with audioTrackId and jobId', async () => {
      const app = buildApp()

      const res = await request(app)
        .post('/api/v1/audio')
        .send(validBody)

      expect(res.status).toBe(202)
      expect(res.body).toEqual({ audioTrackId: 'track-1', jobId: 'job-1' })
    })

    it('returns 400 when filename is missing', async () => {
      const app = buildApp()

      const res = await request(app)
        .post('/api/v1/audio')
        .send({ ...validBody, filename: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when effect is invalid', async () => {
      const app = buildApp()

      const res = await request(app)
        .post('/api/v1/audio')
        .send({ ...validBody, effect: 'WARP_SPEED' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when sizeInBytes is negative', async () => {
      const app = buildApp()

      const res = await request(app)
        .post('/api/v1/audio')
        .send({ ...validBody, sizeInBytes: -1 })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('returns 503 when use case returns DatabaseError', async () => {
      const upload = makeUploadUseCase()
      upload.execute.mockResolvedValue(err(new DatabaseError('connection lost')))
      const app = buildApp(upload)

      const res = await request(app)
        .post('/api/v1/audio')
        .send(validBody)

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('DATABASE_ERROR')
    })
  })

  // ─── Get Status ────────────────────────────────────────────────────────

  describe('GET /api/v1/audio/:id', () => {
    it('returns 200 with the status DTO', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/v1/audio/track-1')

      expect(res.status).toBe(200)
      expect(res.body.audioTrackId).toBe('track-1')
      expect(res.body.filename).toBe('song.mp3')
      expect(res.body.job.effect).toBe('NORMALIZE')
    })

    it('returns 404 when audio track does not exist', async () => {
      const getStatus = makeGetStatusUseCase()
      getStatus.execute.mockResolvedValue(
        err(new NotFoundError('AudioTrack', 'unknown-id'))
      )
      const app = buildApp(undefined, getStatus)

      const res = await request(app).get('/api/v1/audio/unknown-id')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
      expect(res.body.message).toContain('unknown-id')
    })
  })

  // ─── 404 for unknown routes ────────────────────────────────────────────

  describe('Unknown routes', () => {
    it('returns 404 for unmatched paths', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/v1/nonexistent')

      expect(res.status).toBe(404)
    })
  })
})
